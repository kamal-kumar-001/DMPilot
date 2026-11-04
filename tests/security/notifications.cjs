const {test}=require('node:test');const assert=require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const {NotificationService}=require('../../apps/api/dist/notification/notification.service');
test('real notices deduplicate by owner and event, and preserve read state',async()=>{
 const rows=new Map(); const s=new NotificationService({notification:{upsert:async({where,create,update})=>{assert.deepEqual(update,{});if(!rows.has(where.id))rows.set(where.id,create);return rows.get(where.id)}}});
 const a=await s.notifyOnce('u','event','Payment confirmed','Receipt available','SUCCESS');a.isRead=true;
 assert.equal(await s.notifyOnce('u','event','Payment confirmed','Receipt available','SUCCESS'),a);assert.equal(a.isRead,true);
 await s.notifyOnce('other','event','Payment confirmed','Receipt available','SUCCESS');assert.equal(rows.size,2);
});
test('notification storage failure never breaks primary operation',async()=>{const s=new NotificationService({notification:{upsert:async()=>{throw Error('offline')}}});assert.equal(await s.notifyOnce('u','event','title','message'),null)});
test('all notification reads and mutations scoped by authenticated owner',async()=>{
 const calls=[];const n=new NotificationService({notification:Object.fromEntries(['findMany','updateMany','deleteMany'].map(k=>[k,async args=>calls.push(args)]))});
 await n.getUserNotifications('owner');await n.markAsRead('owner','id');await n.markAllAsRead('owner');await n.deleteNotification('owner','id');for(const c of calls)assert.equal(c.where.userId,'owner');assert.equal(calls[0].take,50);
});
test('real producers exist; no login tips or per-message success spam',()=>{
 const fs=require('node:fs');const auth=fs.readFileSync('apps/api/src/auth/auth.service.ts','utf8');assert.ok(!auth.includes('Seed initial notifications'));assert.ok(!auth.includes('Welcome to DMPilot!'));
 const worker=fs.readFileSync('apps/api/src/instagram/send-dm.processor.ts','utf8');assert.match(worker,/dm-quota:/);assert.match(worker,/instagram-permission:/);
 const billing=fs.readFileSync('apps/api/src/billing/subscription.service.ts','utf8');assert.match(billing,/payment-confirmed:/);assert.match(billing,/subscription-expired:/);
});
test('subscription expiry records one notice only after the actual downgrade',async()=>{
 const {SubscriptionService}=require('../../apps/api/dist/billing/subscription.service');let calls=0;let events=[];
 let stored={id:'s',plan:'PRO',status:'ACTIVE',expiresAt:new Date('2020-01-01')};
 const s=new SubscriptionService({subscription:{findUnique:async()=>stored,update:async({data})=>{calls++;stored={...stored,...data};return stored}}},{},{},{notifyOnce:async(...args)=>events.push(args)});
 assert.equal((await s.getOrCreate('u')).plan,'FREE');await s.getOrCreate('u');assert.equal(calls,1);assert.equal(events.length,1);assert.equal(events[0][0],'u');assert.match(events[0][1],/^subscription-expired:/);
});
