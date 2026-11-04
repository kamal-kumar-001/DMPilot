import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeeFreeService } from './feefree.service';
import { ConfigService } from '@nestjs/config';
import { Plan, Subscription } from '@prisma/client';
const PREFIX = 'feefree_service_grant:';
type Grant = {
  grantId: string;
  merchantId: string;
  sessionId: string;
  orderId: string;
  amountPaise: number;
  baseAmountPaise: number;
  currency: string;
  serviceKind: string;
  state: string;
  revision: number;
  issuedAt: string;
  expiresAt: null;
  provenance: string;
  bankVerified: false;
  paymentStatus: string;
  eventId?: string;
};
@Injectable()
export class ServiceAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feefree: FeeFreeService,
    private readonly config: ConfigService,
  ) {}
  enabled() {
    // Merchant-owned provider settings and per-order enrollment select this lane.
    // A connection alone never grants access; explicit false is an emergency stop.
    if (this.config.get('FEEFREE_SERVICE_ACCESS_ENABLED') === 'false') return false;
    if ((this.config.get('BILLING_PROVIDER') || '').trim().toLowerCase() !== 'feefree')
      return false;
    const url = this.config.get('FEEFREE_API_URL');
    try {
      const parsed = new URL(url || '');
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
        return false;
    } catch {
      return false;
    }
    return Boolean(this.config.get('FEEFREE_API_KEY') && this.config.get('FEEFREE_WEBHOOK_SECRET'));
  }
  private key(id: string) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(id))
      throw new BadRequestException('Invalid service grant id');
    return PREFIX + id;
  }
  private validate(g: Grant) {
    if (
      !g ||
      g.serviceKind !== 'REVOCABLE_SUBSCRIPTION' ||
      g.currency !== 'INR' ||
      g.bankVerified !== false ||
      g.paymentStatus !== 'UNVERIFIED' ||
      g.provenance !== 'MAILBOX_OBSERVED_UNVERIFIED_BANK' ||
      g.expiresAt !== null ||
      !['PROVISIONAL', 'REVOKED'].includes(g.state) ||
      g.revision !== (g.state === 'PROVISIONAL' ? 1 : 2) ||
      !Number.isFinite(Date.parse(g.issuedAt)) ||
      Date.parse(g.issuedAt) > Date.now() + 300000
    )
      throw new BadRequestException('Invalid service access contract');
    this.key(g.grantId);
  }
  private same(a: Grant, b: Grant) {
    return [
      'grantId',
      'merchantId',
      'sessionId',
      'orderId',
      'amountPaise',
      'baseAmountPaise',
      'currency',
      'serviceKind',
      'issuedAt',
      'expiresAt',
      'provenance',
      'bankVerified',
      'paymentStatus',
    ].every((k) => (a as any)[k] === (b as any)[k]);
  }
  async accept(event: string, eventId: string, g: Grant) {
    if (!this.enabled()) throw new BadRequestException('Service access integration is disabled');
    this.validate(g);
    if (
      !eventId ||
      eventId.length > 160 ||
      event !==
        (g.state === 'PROVISIONAL' ? 'service.access.provisional' : 'service.access.revoked')
    )
      throw new BadRequestException('Service event mismatch');
    const live = await this.feefree.getServiceGrant(g.grantId);
    this.validate(live);
    if (!this.same(g, live) || live.revision < g.revision)
      throw new BadRequestException('Grant lookup does not match event');
    const session = await this.prisma.paymentSession.findUnique({
      where: { sessionId: g.sessionId },
    });
    if (
      !session ||
      session.provider !== 'feefree' ||
      session.orderId !== g.orderId ||
      session.currency !== g.currency ||
      session.amountPaise !== g.amountPaise ||
      session.baseAmountPaise !== g.baseAmountPaise ||
      session.plan === Plan.FREE
    )
      throw new BadRequestException('Unknown or mismatched service checkout');
    const enrollment = await this.prisma.systemSetting.findUnique({
      where: { key: 'feefree_service_order:' + g.sessionId },
    });
    if (!enrollment) throw new BadRequestException('Checkout was not enrolled for service access');
    const key = this.key(g.grantId);
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.systemSetting.findUnique({ where: { key } });
      const old = row ? JSON.parse(row.value) : null;
      if (old && !this.same(old.grant, g)) throw new ConflictException('Grant identity changed');
      if (old?.grant.state === 'REVOKED') return;
      const grant = live.state === 'REVOKED' ? live : g;
      const periodEnd =
        old?.periodEnd ||
        new Date(
          Date.parse(g.issuedAt) + (session.cycle === 'YEARLY' ? 365 : 30) * 86400000,
        ).toISOString();
      const value = JSON.stringify({
        grant,
        userId: session.userId,
        plan: session.plan,
        cycle: session.cycle,
        periodEnd,
        eventId,
        receivedAt: new Date().toISOString(),
      });
      if (row) {
        const r = await tx.systemSetting.updateMany({
          where: { key, value: row.value },
          data: { value },
        });
        if (r.count !== 1) throw new ConflictException('Concurrent grant update; retry');
      } else await tx.systemSetting.create({ data: { key, value } });
    });
    return { handled: true, eventId, grantId: g.grantId, revision: g.revision };
  }
  async effective(base: Subscription): Promise<Subscription & Record<string, any>> {
    if (!this.enabled()) return base;
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: PREFIX }, value: { contains: JSON.stringify(base.userId) } },
    });
    const candidates = rows
      .map((r) => JSON.parse(r.value))
      .filter(
        (r) =>
          r.userId === base.userId &&
          r.grant.state === 'PROVISIONAL' &&
          Date.parse(r.periodEnd) > Date.now(),
      );
    const rank: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };
    let selected: any = null;
    for (const row of candidates) {
      try {
        const live = await this.feefree.getServiceGrant(row.grant.grantId);
        this.validate(live);
        if (!this.same(live, row.grant) || live.state !== 'PROVISIONAL') continue;
        if (!selected || rank[row.plan] > rank[selected.plan]) selected = row;
      } catch {
        continue;
      } // unavailable evidence never supplies rights
    }
    if (!selected || rank[base.plan] >= rank[selected.plan]) return base;
    return {
      ...base,
      status: 'ACTIVE',
      plan: selected.plan,
      cycle: selected.cycle,
      expiresAt: new Date(selected.periodEnd),
      accessSource: 'EMAIL_OBSERVED',
      bankVerified: false,
      paymentStatus: 'UNVERIFIED',
      serviceGrantId: selected.grant.grantId,
      serviceAccessRevocable: true,
    };
  }
  async enroll(sessionId: string) {
    const enrollment = await this.feefree.enrollServiceOrder(sessionId);
    if (
      enrollment.sessionId !== sessionId ||
      enrollment.serviceKind !== 'REVOCABLE_SUBSCRIPTION' ||
      enrollment.bankVerified !== false
    )
      throw new BadRequestException('Invalid enrollment response');
    await this.prisma.systemSetting.upsert({
      where: { key: 'feefree_service_order:' + sessionId },
      create: { key: 'feefree_service_order:' + sessionId, value: 'enrolled' },
      update: {},
    });
  }
  async list() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: PREFIX } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => JSON.parse(r.value));
  }
  async revoke(id: string) {
    this.key(id);
    const live = await this.feefree.revokeServiceGrant(id);
    return this.accept('service.access.revoked', live.eventId || `operator:${id}:2`, live);
  }
}
