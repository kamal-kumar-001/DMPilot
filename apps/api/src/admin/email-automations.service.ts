import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type Rule = {
  id: string;
  name: string;
  trigger: 'MEMBERSHIP_EXPIRING';
  daysBefore: number;
  subject: string;
  body: string;
  status: 'DRAFT';
};
const KEY = 'email_automations_drafts_v1';
const TOKENS = ['name', 'plan', 'expiresAt', 'daysLeft'];
@Injectable()
export class EmailAutomationsService {
  constructor(private readonly prisma: PrismaService) {}
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
  async list() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY } });
    const saved = row ? JSON.parse(row.value) : { revision: 0, rules: this.initial() };
    return {
      ...saved,
      sendingEnabled: false,
      supportedTriggers: ['MEMBERSHIP_EXPIRING'],
      tokens: TOKENS,
    };
  }
  validate(input: any): Rule {
    if (!input || typeof input !== 'object') throw new BadRequestException('Missing draft rule');
    if ((input.status && input.status !== 'DRAFT') || input.enabled || input.sendingEnabled)
      throw new BadRequestException('Sending is disabled. Only drafts can be saved.');
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
  async save(input: any) {
    const rule = this.validate(input?.rule);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.systemSetting.findUnique({ where: { key: KEY } });
      const saved = row ? JSON.parse(row.value) : { revision: 0, rules: this.initial() };
      if (input.revision !== saved.revision)
        throw new ConflictException('Drafts changed. Reload before saving.');
      const rules = saved.rules.filter((r: Rule) => r.id !== rule.id);
      if (rules.length >= 30) throw new BadRequestException('Maximum 30 draft rules');
      rules.push(rule);
      const value = JSON.stringify({ revision: saved.revision + 1, rules });
      if (row) {
        const result = await tx.systemSetting.updateMany({
          where: { key: KEY, value: row.value },
          data: { value },
        });
        if (result.count !== 1)
          throw new ConflictException('Drafts changed. Reload before saving.');
      } else await tx.systemSetting.create({ data: { key: KEY, value } });
      return { revision: saved.revision + 1, rules, sendingEnabled: false };
    });
  }
  async preview(input: any) {
    const rule = this.validate(input?.rule);
    const page =
      Number.isInteger(input.page) && input.page > 0 && input.page <= 10000 ? input.page : 1;
    const asOf = new Date();
    const until = new Date(asOf.getTime() + rule.daysBefore * 86400000);
    const where: any = {
      plan: { in: ['PRO', 'ENTERPRISE'] },
      status: 'ACTIVE',
      expiresAt: { gt: asOf, lte: until },
      user: { role: 'CREATOR', isVerified: true, deleteRequest: { is: null } },
    };
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
      sendingEnabled: false,
      criteria:
        'Verified creator accounts with an active paid membership expiring after now and within the selected window. Accounts with deletion requests are excluded.',
      recipients: rows.map((row) => {
        const daysLeft = Math.ceil((row.expiresAt!.getTime() - asOf.getTime()) / 86400000);
        const values: Record<string, string> = {
          name: row.user.name || 'Creator',
          plan: row.plan === 'ENTERPRISE' ? 'Agency' : 'Pro',
          expiresAt: row.expiresAt!.toISOString(),
          daysLeft: String(daysLeft),
        };
        const render = (text: string) => text.replace(/{{\s*(\w+)\s*}}/g, (_, key) => values[key]);
        return {
          userId: row.user.id,
          email: row.user.email,
          name: row.user.name,
          plan: values.plan,
          expiresAt: row.expiresAt,
          reason: `Active ${values.plan} membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          wouldBeDueAt: new Date(row.expiresAt!.getTime() - rule.daysBefore * 86400000),
          scheduledAt: null,
          status: 'PREVIEW_ONLY',
          subject: render(rule.subject),
          body: render(rule.body),
        };
      }),
    };
  }
}
