const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const {FeatureFlagService}=require('../../apps/api/dist/billing/feature-flag.service');
const {FeatureGateGuard}=require('../../apps/api/dist/billing/feature-gate.guard');
const {BillingController}=require('../../apps/api/dist/billing/billing.controller');
const {MonitoringController}=require('../../apps/api/dist/monitoring/monitoring.controller');
const {SendDmProcessor}=require('../../apps/api/dist/instagram/send-dm.processor');
const {RolesGuard}=require('../../apps/api/dist/auth/guards/roles.guard');
const context=(handler,user)=>({getHandler:()=>handler,getClass:()=>MonitoringController,switchToHttp:()=>({getRequest:()=>({user})})});
test('flag service exact plan, global switch, ALL, branding and missing keys fail closed',async()=>{
 const s=new FeatureFlagService({featureFlag:{findUnique:async()=>null}});
 assert.equal(await s.isEnabled('MISSING','FREE'),false);
 assert.equal(await s.isEnabled('NO_BRANDING','FREE'),true);
 assert.equal(s.enabledForPlan({key:'VOICE_CREATE',isEnabled:true,enabledForPlans:' PRO, ENTERPRISE '},'FREE'),false);
 assert.equal(s.enabledForPlan({key:'VOICE_CREATE',isEnabled:true,enabledForPlans:'ALL'},'FREE'),true);
 assert.equal(s.enabledForPlan({key:'VOICE_CREATE',isEnabled:false,enabledForPlans:'ALL'},'PRO'),false);
});
test('billing flag response uses same rule and ignores ADMIN bypass to support plan previews',async()=>{
 const flags=new FeatureFlagService({});flags.getAll=async()=>[{key:'VOICE_CREATE',isEnabled:true,enabledForPlans:'PRO,ENTERPRISE'}];
 const controller=new BillingController({getOrCreate:async()=>({plan:'FREE'})},flags);
 assert.equal((await controller.getFlags({id:'fixture',role:'ADMIN'}))[0].enabled,false);
});
test('delivery reads require WEBHOOK_LOGS, and operational mutations/system reads are admin-only',()=>{
 const proto=MonitoringController.prototype;
 assert.equal(Reflect.getMetadata('required_feature',proto.getDeliveryLogs),'WEBHOOK_LOGS');
 for(const name of ['getHealth','getQueueStats','getFailedJobs','retryJob','purgeFailedJobs','getMetrics','getWebhookStatus','updateWebhookStatus','purgeWebhookLogs']){
  assert.deepEqual(Reflect.getMetadata('roles',proto[name]),['ADMIN']);
  const roleGuard=new RolesGuard({getAllAndOverride:()=>Reflect.getMetadata('roles',proto[name])});
  assert.equal(roleGuard.canActivate(context(proto[name],{role:'CREATOR'})),false);
  assert.equal(roleGuard.canActivate(context(proto[name],{role:'ADMIN'})),true);
 }
});
test('API guard rejects ordinary Free with 403,allows correct paid plan and preserves staff bypass',async()=>{
 let plan='FREE';const guard=new FeatureGateGuard({get:()=> 'REPLY_DESK'},{isEnabled:async(k,p)=>p==='PRO'},{getOrCreate:async()=>({plan})});
 await assert.rejects(guard.canActivate(context(()=>{},{id:'free',role:'CREATOR'})),e=>e.getStatus()===403);
 plan='PRO';assert.equal(await guard.canActivate(context(()=>{},{id:'pro',role:'CREATOR'})),true);
 plan='FREE';assert.equal(await guard.canActivate(context(()=>{},{id:'staff',role:'ADMIN'})),true);
});
test('queued automation denied before decrypt/network if current plan lost access',async()=>{
 let decrypted=false;let checked='';
 const worker=new SendDmProcessor({instagramAccount:{findUnique:async()=>({id:'a',userId:'u',isConnected:true})},campaign:{findUnique:async()=>({id:'c',userId:'u',instagramAccountId:'a',type:'WELCOME_DM'})}},{decrypt:()=>{decrypted=true}},{getOrCreate:async()=>({plan:'FREE'})},{assertEnabled:async(k)=>{checked=k;throw new Error('denied')}});
 await assert.rejects(worker.process({id:'fixture',data:{campaignId:'c',instagramAccountId:'a',recipientId:'safe',recipientUsername:'fixture'}}),/denied/);
 assert.equal(checked,'WELCOME_DM');assert.equal(decrypted,false);
});
