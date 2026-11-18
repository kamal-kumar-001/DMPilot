// Synthetic screenshot seed. Local scratch DB only, never production.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5433/dashscratch' } },
});

const password = await bcrypt.hash('ScreenshotPass1!', 10);

async function makeUser(email, name, plan) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, password, isVerified: true },
  });
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { plan },
    create: { userId: user.id, plan, status: 'ACTIVE' },
  });
  return user;
}

const pro = await makeUser('pro@shot.test', 'Riya Shot', 'PRO');
const free = await makeUser('free@shot.test', 'Arjun Free', 'FREE');

// Feature flags: advanced analytics only for PRO+ (matches production gating intent)
await prisma.featureFlag.upsert({
  where: { key: 'ANALYTICS_ADVANCED' },
  update: { enabledForPlans: 'PRO,ENTERPRISE', isEnabled: true },
  create: { key: 'ANALYTICS_ADVANCED', enabledForPlans: 'PRO,ENTERPRISE', isEnabled: true },
});

// Two accounts for the PRO user (exercises All/per-account chips), one for FREE.
const acc1 = await prisma.instagramAccount.create({
  data: {
    userId: pro.id, instagramId: 'shot-ig-1', username: 'riya.makes', displayName: 'Riya',
    accessToken: 'mock_token_shot_1', followersCount: 12480,
  },
});
const acc2 = await prisma.instagramAccount.create({
  data: {
    userId: pro.id, instagramId: 'shot-ig-2', username: 'riya.shop', displayName: 'Riya Shop',
    accessToken: 'mock_token_shot_2', followersCount: 3210,
  },
});
const accFree = await prisma.instagramAccount.create({
  data: {
    userId: free.id, instagramId: 'shot-ig-3', username: 'arjun.creates',
    accessToken: 'mock_token_shot_3', followersCount: 845,
  },
});

await prisma.testerAllowlistEntry.create({ data: { userId: pro.id, note: 'screenshot seed' } });

const campaign = await prisma.campaign.create({
  data: {
    userId: pro.id, instagramAccountId: acc1.id, name: 'Welcome new commenters',
    type: 'COMMENT_TO_DM', replyMessage: 'Thanks for commenting! Here is the link.',
    status: 'ACTIVE',
    keywords: { create: [{ keyword: 'price' }, { keyword: 'link' }] },
  },
});

// 14 days of messages + comments across both PRO accounts
const now = Date.now();
const msgs = [];
const cmts = [];
for (let day = 13; day >= 0; day--) {
  const base = new Date(now - day * 86400000);
  base.setHours(10, 0, 0, 0);
  const sent = 3 + ((13 - day) % 5);
  const failed = (13 - day) % 4 === 0 ? 2 : day === 0 ? 3 : 0;
  for (let i = 0; i < sent; i++) {
    const acc = i % 2 === 0 ? acc1 : acc2;
    msgs.push({
      instagramAccountId: acc.id, recipientId: `r-${day}-${i}`, senderId: acc.instagramId,
      text: 'Thanks for your comment!', messageId: `m-s-${day}-${i}`,
      direction: 'OUTGOING', status: 'SENT', createdAt: new Date(base.getTime() + i * 60000),
      campaignId: campaign?.id ?? null,
    });
  }
  for (let i = 0; i < failed; i++) {
    msgs.push({
      instagramAccountId: acc1.id, recipientId: `rf-${day}-${i}`, senderId: acc1.instagramId,
      text: 'Thanks!', messageId: `m-f-${day}-${i}`,
      direction: 'OUTGOING', status: 'FAILED', errorMessage: 'Meta rejected',
      createdAt: new Date(base.getTime() + i * 60000), campaignId: campaign?.id ?? null,
    });
  }
  const commentCount = 2 + ((13 - day) % 3);
  for (let i = 0; i < commentCount; i++) {
    cmts.push({
      instagramAccountId: acc1.id, mediaId: `media-${day}`, commentId: `c-${day}-${i}`,
      text: 'price please', username: `fan${i}`, userId: `u-${day}-${i}`,
      isReplied: true, createdAt: new Date(base.getTime() + i * 120000),
      campaignId: campaign?.id ?? null,
    });
  }
}
await prisma.message.createMany({ data: msgs });
await prisma.comment.createMany({ data: cmts });

// FREE user: a few sends in the last 24h so the free cards show real numbers
await prisma.message.createMany({
  data: [0, 1, 2].map((i) => ({
    instagramAccountId: accFree.id, recipientId: `fr-${i}`, senderId: accFree.instagramId,
    text: 'Hi!', messageId: `fm-${i}`, direction: 'OUTGOING', status: i === 2 ? 'FAILED' : 'SENT',
    createdAt: new Date(now - i * 3600000),
  })),
});
await prisma.comment.createMany({
  data: [0, 1].map((i) => ({
    instagramAccountId: accFree.id, mediaId: 'fm-media', commentId: `fc-${i}`,
    text: 'link?', username: `freefan${i}`, userId: `fu-${i}`, isReplied: true,
    createdAt: new Date(now - i * 1800000),
  })),
});

console.log('SEED_OK', { pro: pro.email, free: free.email, msgs: msgs.length, cmts: cmts.length });
await prisma.$disconnect();
