const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const target = new Module(__filename);
target._compile(ts.transpileModule(fs.readFileSync('lib/pricing-comparison.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, __filename);
const {buildPricingComparison,planHighlights} = target.exports;
const plans=['FREE','PRO','ENTERPRISE'].map(key=>({key,dmLimitMonthly:1000,campaignLimit:10,accountLimit:5}));
const flag=(key, enabledForPlans='FREE,PRO,ENTERPRISE', isEnabled=true)=>({key,enabledForPlans,isEnabled});
const tools=(flags)=>buildPricingComparison(plans,flags)[1].features;
test('exact flags, global disable, ALL and whitespace are respected',()=>{
 const rows=tools([flag('REPLY_DESK',' PRO '),flag('ANALYTICS_ADVANCED','ALL'),flag('VOICE_CREATE','ALL',false)]);
 assert.equal(rows.find(x=>x.name.includes('Reply Desk')).free,false);
 assert.equal(rows.find(x=>x.name.includes('Reply Desk')).pro,true);
 assert.equal(rows.find(x=>x.name.includes('analytics')).agency,true);
 assert.equal(rows.find(x=>x.name.includes('Voice')).pro,false);
});
test('missing, technical and trivial flags do not create marketing claims',()=>{
 const rows=tools([flag('DM_VARIANTS'),flag('COMMENT_REPLY'),flag('API_ACCESS'),flag('SPIKE_ALERTS'),flag('UNKNOWN')]);
 assert.equal(rows.length,1);assert.equal(rows[0].free,true);
});
test('branding invariant, live limits and multi-account gate stay distinct',()=>{
 const rows=buildPricingComparison(plans,[flag('NO_BRANDING','',false),flag('MULTI_ACCOUNT','PRO')]);
 assert.equal(rows[1].features[0].agency,true);
 assert.equal(rows[0].features[2].free,'1 account');assert.equal(rows[0].features[2].pro,'5 accounts');
 assert.equal(buildPricingComparison([] ,[])[0].features[0].free,'Not set');
});
test('cards use the same flag decisions, with no unsupported agency promises',()=>{
 const highlights=planHighlights(plans[2],[flag('REPLY_DESK','PRO')]);
 assert(!highlights.some(x=>/Reply Desk|Team|SLA|Manager|Push|Redis/.test(x)));
});
