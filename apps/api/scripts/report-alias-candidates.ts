/**
 * READ-ONLY report of CANDIDATE alias bindings for operator review.
 *
 * Lists, for every connected account, predecessor rows belonging to the same
 * user that might represent the same Instagram account under another id
 * namespace. A same-username match is ONLY a hint for a human to
 * investigate - it is never sufficient identity evidence, and this script
 * writes nothing. Bind only after verifying with immutable evidence
 * (audit-log id history, Meta-delivered webhook ids for the account's own
 * media, dashboard data), using scripts/bind-instagram-alias.ts.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const accounts = await prisma.instagramAccount.findMany({
    orderBy: [{ userId: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      userId: true,
      username: true,
      instagramId: true,
      instagramPageId: true,
      isConnected: true,
      deletedAt: true,
    },
  });
  const active = accounts.filter((a) => a.isConnected && !a.deletedAt);
  for (const account of active) {
    const predecessors = accounts.filter(
      (p) =>
        p.id !== account.id &&
        p.userId === account.userId &&
        p.username.toLowerCase() === account.username.toLowerCase(),
    );
    if (predecessors.length === 0) continue;
    console.log(`@${account.username} active=${account.instagramId} (${account.id})`);
    for (const p of predecessors) {
      console.log(
        `  candidate predecessor: instagramId=${p.instagramId} pageId=${p.instagramPageId ?? '-'} ` +
          `connected=${p.isConnected} deletedAt=${p.deletedAt?.toISOString() ?? '-'} (${p.id})`,
      );
    }
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
