/**
 * Webhook account resolution across Meta identifier namespaces.
 *
 * Meta delivers webhook events keyed by the identifier namespace of the
 * subscription that produced them (page-linked IG business account id for
 * classic/Facebook-Login subscriptions, Instagram-scoped id (IGSID) for
 * Instagram-Login subscriptions). A connected account stores exactly one
 * primary instagramId plus an optional instagramPageId, so events from the
 * "other" namespace cannot resolve against those columns alone.
 *
 * This module resolves through explicitly verified alias bindings
 * (InstagramAccountAlias). Binding rules (fail closed):
 *
 *  - Aliases are ONLY established by an explicit, reviewed operation
 *    (bindVerifiedIdentifier) using immutable provider ids. They are NEVER
 *    learned from webhook payloads and NEVER auto-derived from username
 *    matches: handles can be renamed or reassigned, so a username is not
 *    identity.
 *  - An identifier that collides with ANY account's primary
 *    instagramId/instagramPageId (including soft-deleted accounts) or with
 *    an existing alias cannot be bound; the unique constraint plus an
 *    in-transaction re-check make concurrent binds race-safe.
 *  - Resolution requires every resolvable candidate id to point at the SAME
 *    active account; conflicting bindings resolve to null (drop).
 *  - An alias whose target account is inactive never resolves.
 */

export interface WebhookAccountRecord {
  id: string;
  userId: string;
  instagramId: string;
  instagramPageId: string | null;
  username: string;
  isConnected: boolean;
  deletedAt: Date | null;
}

interface InstagramAccountDelegate {
  findFirst(args: unknown): Promise<WebhookAccountRecord | null>;
  findMany(args: unknown): Promise<WebhookAccountRecord[]>;
}

interface AliasRow {
  id: string;
  identifier: string;
  accountId: string;
  source: string;
  note?: string | null;
  account?: Partial<WebhookAccountRecord> | null;
}

interface AliasDelegate {
  findMany(args: unknown): Promise<AliasRow[]>;
  create(args: unknown): Promise<AliasRow>;
}

export interface ResolverPrisma {
  instagramAccount: InstagramAccountDelegate;
  instagramAccountAlias: AliasDelegate;
  $transaction?<T>(fn: (tx: ResolverPrisma) => Promise<T>): Promise<T>;
}

export interface ResolutionResult {
  account: WebhookAccountRecord | null;
  /** Set when candidates resolve to conflicting accounts (fail closed). */
  ambiguous?: { identifier: string; accountId: string }[];
}

/**
 * Resolve the single active Instagram account for a set of
 * webhook-delivered candidate identifiers (entry.id and, for messaging
 * events, recipientId). Candidates that resolve to nothing are ignored
 * (e.g. a counterparty user id). If two candidates resolve to DIFFERENT
 * accounts, the result is ambiguous and fails closed (account = null).
 */
export async function resolveActiveAccountForWebhookIds(
  prisma: ResolverPrisma,
  ids: string[],
): Promise<ResolutionResult> {
  const candidates = Array.from(new Set(ids.filter(Boolean)));
  if (candidates.length === 0) return { account: null };

  const matched = new Map<string, WebhookAccountRecord>();

  // 1. Primary columns (pre-existing strict behavior).
  const directRows = await prisma.instagramAccount.findMany({
    where: {
      OR: [{ instagramId: { in: candidates } }, { instagramPageId: { in: candidates } }],
      isConnected: true,
      deletedAt: null,
    },
  });
  for (const row of directRows) {
    for (const c of candidates) {
      if (row.instagramId === c || row.instagramPageId === c) matched.set(c, row);
    }
  }

  // 2. Verified alias bindings (active targets only).
  const aliasRows = await prisma.instagramAccountAlias.findMany({
    where: {
      identifier: { in: candidates },
      account: { isConnected: true, deletedAt: null },
    },
    include: { account: true },
  });
  for (const alias of aliasRows) {
    const account = alias.account as WebhookAccountRecord;
    const existing = matched.get(alias.identifier);
    if (existing && existing.id !== account.id) {
      // Primary columns and an alias disagree about this identifier.
      return {
        account: null,
        ambiguous: [
          { identifier: alias.identifier, accountId: existing.id },
          { identifier: alias.identifier, accountId: account.id },
        ],
      };
    }
    matched.set(alias.identifier, account);
  }

  const distinctAccounts = new Set([...matched.values()].map((a) => a.id));
  if (distinctAccounts.size > 1) {
    return {
      account: null,
      ambiguous: [...matched.entries()].map(([identifier, a]) => ({
        identifier,
        accountId: a.id,
      })),
    };
  }
  return { account: matched.values().next().value ?? null };
}

export class AliasConflictError extends Error {
  readonly conflicts: string[];

  constructor(message: string, conflicts: string[]) {
    super(message);
    this.name = 'AliasConflictError';
    this.conflicts = conflicts;
  }
}

/**
 * Explicitly bind an immutable provider identifier to an account. This is
 * the ONLY way aliases are created. Validation (inside one transaction;
 * the unique constraint is the final arbiter under concurrency):
 *
 *  - target account must exist and be active (connected, not soft-deleted);
 *  - identifier must be a bare numeric Meta id;
 *  - identifier must not equal ANY account's instagramId/instagramPageId
 *    (any user, including soft-deleted rows);
 *  - identifier must not already be alias-bound.
 *
 * Any violation throws AliasConflictError and writes nothing.
 */
export async function bindVerifiedIdentifier(
  prisma: ResolverPrisma,
  params: { accountId: string; identifier: string; source: string; note?: string },
): Promise<{ id: string; warnings?: string[] }> {
  const { accountId, identifier, source, note } = params;
  if (!/^\d{5,25}$/.test(identifier)) {
    throw new AliasConflictError(`identifier ${identifier} is not a numeric Meta id`, [identifier]);
  }

  const run = async (tx: ResolverPrisma) => {
    const target = await tx.instagramAccount.findFirst({
      where: { id: accountId, isConnected: true, deletedAt: null },
    });
    if (!target) {
      throw new AliasConflictError(`target account ${accountId} is missing or inactive`, [
        accountId,
      ]);
    }

    const primaryHolders = await tx.instagramAccount.findMany({
      where: {
        OR: [{ instagramId: identifier }, { instagramPageId: identifier }],
      },
    });
    const activeHolders = primaryHolders.filter((a) => a.isConnected && !a.deletedAt);
    if (activeHolders.length > 0) {
      // Shadowing a live account's primary id can never be right.
      throw new AliasConflictError(
        `identifier ${identifier} is a primary id of ACTIVE account(s): ${activeHolders
          .map((a) => a.id)
          .join(', ')}`,
        activeHolders.map((a) => a.id),
      );
    }
    // Inactive (soft-deleted/disconnected) holders are the reviewed-migration
    // case: their primary id does not resolve while inactive, so binding it to
    // a reviewed successor is allowed - but the caller must see the warning,
    // because if such a row is ever reactivated the resolver will fail closed
    // on the primary/alias disagreement until an operator re-reviews.
    const inactiveHolderIds = primaryHolders.map((a) => a.id);

    const existing = await tx.instagramAccountAlias.findMany({ where: { identifier } });
    if (existing.length > 0) {
      throw new AliasConflictError(
        `identifier ${identifier} is already bound to account ${existing[0].accountId}`,
        [existing[0].accountId],
      );
    }

    const created = await tx.instagramAccountAlias.create({
      data: { accountId, identifier, source, note: note ?? null },
    });
    return {
      ...created,
      warnings: inactiveHolderIds.length
        ? [
            `identifier ${identifier} is also the (inactive) primary id of row(s) ${inactiveHolderIds.join(
              ', ',
            )}; if such a row is reactivated, resolution fails closed pending re-review`,
          ]
        : [],
    };
  };

  try {
    const created = prisma.$transaction ? await prisma.$transaction(run) : await run(prisma);
    return { id: created.id, warnings: created.warnings };
  } catch (err: any) {
    // Prisma unique-constraint violation under a concurrent bind.
    if (err?.code === 'P2002') {
      throw new AliasConflictError(`identifier ${identifier} was bound concurrently`, [identifier]);
    }
    throw err;
  }
}
