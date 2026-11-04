import {
  Injectable,
  BadRequestException,
  ConflictException,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';

type Rule = {
  id: string;
  name: string;
  trigger: 'MEMBERSHIP_EXPIRING';
  daysBefore: number;
  subject: string;
  body: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  enabledAt?: string;
  enabledBy?: string;
};
const KEY = 'email_automations_drafts_v1';
const HISTORY = 'email_automation_delivery:';
const TOKENS = ['name', 'plan', 'expiresAt', 'daysLeft'];
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
@Injectable()
export class EmailAutomationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mail?: MailService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private initial(): Rule[] {
    return [
      {
        id: 'membership-expiring',
        name: 'Membership expiring within five days',
        trigger: 'MEMBERSHIP_EXPIRING',
        daysBefore: 5,
        status: 'DRAFT',
        subject: 'Your DMPilot {{plan}} plan expires soon',
        body: 'Hello {{name}},\n\nYour {{plan}} plan expires on {{expiresAt}} (in {{daysLeft}} days). Review your membership in DMPilot Settings > Billing.\n\nThe DMPilot team',
      },
    ];
  }
  private async state(db: any = this.prisma) {
    const row = await db.systemSetting.findUnique({ where: { key: KEY } });
    return { row, saved: row ? JSON.parse(row.value) : { revision: 0, rules: this.initial() } };
  }
  async list() {
    const { saved } = await this.state();
    return {
      ...saved,
      sendingEnabled: true,
      transport: this.mail?.automationReadiness() || {
        ready: false,
        message: 'Email transport is unavailable',
      },
      supportedTriggers: ['MEMBERSHIP_EXPIRING'],
      tokens: TOKENS,
    };
  }
  validate(input: any): Rule {
    if (!input || typeof input !== 'object') throw new BadRequestException('Missing draft rule');
    if (
      (input.status && !['DRAFT', 'PAUSED'].includes(input.status)) ||
      input.enabled ||
      input.sendingEnabled
    )
      throw new BadRequestException('Use review and enable to activate a saved rule.');
    if (input.trigger !== 'MEMBERSHIP_EXPIRING')
      throw new BadRequestException('Unsupported recipient rule');
    if (!Number.isInteger(input.daysBefore) || input.daysBefore < 1 || input.daysBefore > 30)
      throw new BadRequestException('Choose 1 to 30 days before expiry');
    for (const [key, max] of [
      ['name', 120],
      ['subject', 200],
      ['body', 10000],
    ] as const) {
      if (
        typeof input[key] !== 'string' ||
        !input[key].trim() ||
        input[key].length > max ||
        (key !== 'body' && /[\r\n]/.test(input[key]))
      )
        throw new BadRequestException(`Invalid ${key}`);
    }
    for (const match of `${input.subject}\n${input.body}`.matchAll(/{{(.*?)}}/g))
      if (!TOKENS.includes(match[1].trim()))
        throw new BadRequestException(`Unsupported placeholder: ${match[1]}`);
    return {
      id:
        typeof input.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(input.id)
          ? input.id
          : randomUUID(),
      name: input.name.trim(),
      trigger: input.trigger,
      daysBefore: input.daysBefore,
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: 'DRAFT',
    };
  }
  private async write(db: any, row: any, saved: any) {
    const value = JSON.stringify(saved);
    if (row) {
      const r = await db.systemSetting.updateMany({
        where: { key: KEY, value: row.value },
        data: { value },
      });
      if (r.count !== 1) throw new ConflictException('Rules changed. Reload before saving.');
    } else await db.systemSetting.create({ data: { key: KEY, value } });
  }
  async save(input: any) {
    const rule = this.validate(input?.rule);
    return this.prisma.$transaction(async (tx) => {
      const { row, saved } = await this.state(tx);
      if (input.revision !== saved.revision)
        throw new ConflictException('Rules changed. Reload before saving.');
      const old = saved.rules.find((r: Rule) => r.id === rule.id);
      if (old?.status === 'ACTIVE' || old?.status === 'PAUSED') rule.status = 'PAUSED';
      const rules = saved.rules.filter((r: Rule) => r.id !== rule.id);
      if (rules.length >= 30) throw new BadRequestException('Maximum 30 rules');
      rules.push(rule);
      const next = { revision: saved.revision + 1, rules };
      await this.write(tx, row, next);
      return { ...next, sendingEnabled: true };
    });
  }
  private criteria(rule: Rule, asOf: Date): Prisma.SubscriptionWhereInput {
    return {
      plan: { in: ['PRO', 'ENTERPRISE'] },
      status: 'ACTIVE',
      expiresAt: { gt: asOf, lte: new Date(asOf.getTime() + rule.daysBefore * 86400000) },
      user: { role: 'CREATOR', isVerified: true, deleteRequest: { is: null } },
    };
  }
  private render(rule: Rule, row: any, asOf: Date) {
    const daysLeft = Math.ceil((row.expiresAt.getTime() - asOf.getTime()) / 86400000);
    const values: Record<string, string> = {
      name: row.user.name || 'Creator',
      plan: row.plan === 'ENTERPRISE' ? 'Agency' : 'Pro',
      expiresAt: row.expiresAt.toISOString(),
      daysLeft: String(daysLeft),
    };
    const render = (s: string) => s.replace(/{{\s*(\w+)\s*}}/g, (_, k) => values[k]);
    return {
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      plan: values.plan,
      expiresAt: row.expiresAt,
      reason: `Active ${values.plan} membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      wouldBeDueAt: new Date(row.expiresAt.getTime() - rule.daysBefore * 86400000),
      scheduledAt: null,
      status: 'PREVIEW_ONLY',
      subject: render(rule.subject),
      body: render(rule.body),
    };
  }
  async preview(input: any) {
    const rule = this.validate(
      input?.rule?.status === 'ACTIVE' ? { ...input.rule, status: 'DRAFT' } : input?.rule,
    );
    const page =
      Number.isInteger(input.page) && input.page > 0 && input.page <= 10000 ? input.page : 1;
    const asOf = new Date(),
      where: any = this.criteria(rule, asOf);
    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * 25,
        take: 25,
        select: {
          id: true,
          plan: true,
          expiresAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);
    return {
      asOf,
      total,
      page,
      pageSize: 25,
      sendingEnabled: true,
      criteria:
        'Verified creator accounts with an active paid membership expiring after now and within the selected window. Accounts with deletion requests are excluded.',
      recipients: rows.map((row) => this.render(rule, row, asOf)),
    };
  }
  async review(input: any, adminId: string) {
    const { saved } = await this.state();
    if (saved.revision !== input.revision)
      throw new ConflictException('Rules changed. Reload and review again.');
    const rule = saved.rules.find((r: Rule) => r.id === input.id);
    if (!rule) throw new BadRequestException('Unknown rule');
    const preview = await this.preview({ rule, page: 1 });
    const token = randomUUID();
    await this.prisma.systemSetting.create({
      data: {
        key: 'email_automation_review:' + token,
        value: JSON.stringify({
          adminId,
          id: rule.id,
          revision: saved.revision,
          fingerprint: digest(JSON.stringify(rule)),
          expiresAt: Date.now() + 15 * 60000,
        }),
      },
    });
    return {
      ...preview,
      rule,
      reviewToken: token,
      from: this.mail?.automationReadiness().from,
      ongoing:
        'Enabling sends this saved template once per creator and membership expiry, including future creators who qualify. It starts on the next scheduler check, including creators already in the window.',
    };
  }
  async setStatus(input: any, adminId: string) {
    if (!['ACTIVE', 'PAUSED'].includes(input.status))
      throw new BadRequestException('Choose Enable or Pause');
    if (input.status === 'ACTIVE' && !this.mail?.automationReadiness().ready)
      throw new BadRequestException('Email transport is not configured.');
    return this.prisma.$transaction(async (tx) => {
      const { row, saved } = await this.state(tx);
      if (saved.revision !== input.revision)
        throw new ConflictException('Rules changed. Review again.');
      const rule = saved.rules.find((r: Rule) => r.id === input.id);
      if (!rule) throw new BadRequestException('Unknown rule');
      if (input.status === 'ACTIVE') {
        const key = 'email_automation_review:' + input.reviewToken;
        const record = await tx.systemSetting.findUnique({ where: { key } });
        const review = record ? JSON.parse(record.value) : null;
        if (
          !review ||
          review.adminId !== adminId ||
          review.id !== rule.id ||
          review.revision !== saved.revision ||
          review.fingerprint !== digest(JSON.stringify(rule)) ||
          review.expiresAt < Date.now()
        )
          throw new BadRequestException(
            'Preview the saved email and recipient rule again before enabling.',
          );
        await tx.systemSetting.delete({ where: { key } });
        rule.enabledAt = new Date().toISOString();
        rule.enabledBy = adminId;
      }
      rule.status = input.status;
      const next = { revision: saved.revision + 1, rules: saved.rules };
      await this.write(tx, row, next);
      return { ...next, sendingEnabled: true };
    });
  }
  async history(page = 1) {
    page = Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
    const where = { key: { startsWith: HISTORY } };
    const [total, rows] = await Promise.all([
      this.prisma.systemSetting.count({ where }),
      this.prisma.systemSetting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 25,
        skip: (page - 1) * 25,
      }),
    ]);
    return { total, page, pageSize: 25, rows: rows.map((r) => JSON.parse(r.value)) };
  }
  /** Bounded periodic sweep, no queue backlog and no automatic retries of uncertain sends. */
  async tick() {
    if (this.busy || !this.mail?.automationReadiness().ready) return;
    this.busy = true;
    try {
      const { saved } = await this.state();
      const active: Rule[] = saved.rules.filter((r: Rule) => r.status === 'ACTIVE');
      if (!active.length) return;
      const start = Math.floor(Date.now() / 60000) % active.length;
      let budget = 25;
      for (let i = 0; i < active.length && budget > 0; i++) {
        const rule = active[(start + i) % active.length];
        const cursorKey = 'email_automation_cursor:' + rule.id;
        const cursorRow = await this.prisma.systemSetting.findUnique({ where: { key: cursorKey } });
        const cursor = cursorRow?.value || '';
        const rows = await this.prisma.subscription.findMany({
          where: { ...this.criteria(rule, new Date()), ...(cursor ? { id: { gt: cursor } } : {}) },
          orderBy: { id: 'asc' },
          take: budget,
          include: { user: true },
        });
        for (const row of rows) {
          await this.deliver(rule, row);
          budget--;
        }
        await this.prisma.systemSetting.upsert({
          where: { key: cursorKey },
          create: { key: cursorKey, value: rows.length ? rows[rows.length - 1].id : '' },
          update: { value: rows.length ? rows[rows.length - 1].id : '' },
        });
      }
    } finally {
      this.busy = false;
    }
  }
  private async deliver(snapshot: Rule, candidate: any) {
    const { saved } = await this.state();
    const rule = saved.rules.find((r: Rule) => r.id === snapshot.id);
    if (
      !rule ||
      rule.status !== 'ACTIVE' ||
      digest(JSON.stringify(rule)) !== digest(JSON.stringify(snapshot))
    )
      return;
    const row = await this.prisma.subscription.findFirst({
      where: {
        AND: [
          this.criteria(rule, new Date()),
          { id: candidate.id, expiresAt: candidate.expiresAt },
        ],
      },
      include: { user: true },
    });
    if (!row || !row.expiresAt) return;
    const rendered = this.render(rule, row, new Date());
    const id = digest([rule.id, row.userId, row.id, row.expiresAt.toISOString()].join(':'));
    const key = HISTORY + id;
    const entry: any = {
      id,
      ruleId: rule.id,
      ruleName: rule.name,
      userId: row.userId,
      email: row.user.email,
      subject: rendered.subject,
      body: rendered.body,
      expiresAt: row.expiresAt.toISOString(),
      from: this.mail!.automationReadiness().from,
      status: 'SENDING',
      attemptedAt: new Date().toISOString(),
    };
    try {
      await this.prisma.systemSetting.create({ data: { key, value: JSON.stringify(entry) } });
    } catch (e: any) {
      if (e.code === 'P2002') return;
      throw e;
    }
    // A crash after claiming is deliberately not retried: provider acceptance may be unknown.
    const current = (await this.state()).saved.rules.find((r: Rule) => r.id === rule.id);
    const eligible = await this.prisma.subscription.findFirst({
      where: {
        AND: [this.criteria(rule, new Date()), { id: row.id, expiresAt: row.expiresAt }],
        userId: row.userId,
        plan: row.plan,
        user: {
          role: 'CREATOR',
          isVerified: true,
          deleteRequest: { is: null },
          email: row.user.email,
        },
      },
    });
    if (
      !current ||
      current.status !== 'ACTIVE' ||
      JSON.stringify(current) !== JSON.stringify(rule) ||
      !eligible
    ) {
      entry.status = 'SKIPPED';
      entry.detail = 'Rule paused/edited or creator no longer qualifies';
    } else {
      try {
        const result = await this.mail!.sendAutomationEmail(
          row.user.email,
          rendered.subject,
          rendered.body,
          `<automation-${id}@dmpilot.org>`,
        );
        entry.status = 'ACCEPTED';
        entry.provider = result.provider;
        entry.reference = result.reference;
        entry.completedAt = new Date().toISOString();
      } catch {
        entry.status = 'UNKNOWN';
        entry.detail =
          'Provider acceptance could not be confirmed. No automatic retry to avoid duplicates.';
      }
    }
    await this.prisma.systemSetting.update({
      where: { key },
      data: { value: JSON.stringify(entry) },
    });
  }
}
