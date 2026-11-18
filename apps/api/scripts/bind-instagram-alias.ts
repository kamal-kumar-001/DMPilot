/**
 * Explicitly bind one immutable Meta identifier to one Instagram account.
 * This is the ONLY path that creates InstagramAccountAlias rows.
 *
 * Approval-gated operator action. Run on the host after the migration:
 *   npx ts-node scripts/bind-instagram-alias.ts \
 *     --account d2bff0ca-a911-49df-a853-b4894ceed5f6 \
 *     --identifier 17841458228090598 \
 *     --note "Verified via Meta webhook delivery to this account's own media + Oct 3 audit-log id flip"
 *
 * Validation is fail-closed (see bindVerifiedIdentifier): active target only,
 * no collision with any account's primary instagramId/instagramPageId
 * (including soft-deleted rows), no double binding, numeric ids only.
 * Writes nothing and exits non-zero on any conflict. Triggers no sends.
 */
import { PrismaClient } from '@prisma/client';
import {
  bindVerifiedIdentifier,
  AliasConflictError,
} from '../src/instagram/webhook-account-resolver';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const accountId = arg('account');
  const identifier = arg('identifier');
  const note = arg('note');
  if (!accountId || !identifier || !note) {
    console.error('Usage: --account <uuid> --identifier <numeric meta id> --note "<evidence>"');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const { id, warnings } = await bindVerifiedIdentifier(prisma as any, {
      accountId,
      identifier,
      source: 'manual_operator',
      note,
    });
    console.log(`Bound identifier ${identifier} -> account ${accountId} (alias ${id})`);
    for (const w of warnings ?? []) console.warn(`WARNING: ${w}`);
  } catch (err) {
    if (err instanceof AliasConflictError) {
      console.error(`REFUSED: ${err.message}`);
      process.exit(1);
    }
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
