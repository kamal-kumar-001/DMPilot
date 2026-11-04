const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const target = new Module(__filename);
target._compile(ts.transpileModule(fs.readFileSync('lib/pricing-comparison.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, __filename);
const {buildPricingComparison,planHighlights} = target.exports;
const plans=['FREE','PRO','ENTERPRISE'].map(key=>({key,dmLimitMonthly:1000,campaignLimit:10,accountLimit:5,keywordLimit:10}));
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
 assert.equal(rows[0].features[3].free,'1 account');assert.equal(rows[0].features[3].pro,'5 accounts');
 assert.equal(buildPricingComparison([] ,[])[0].features[0].free,'Not set');
});
test('cards use the same flag decisions, with no unsupported agency promises',()=>{
 const highlights=planHighlights(plans[2],[flag('REPLY_DESK','PRO')]);
 assert(!highlights.some(x=>/Reply Desk|Team|SLA|Manager|Push|Redis/.test(x)));
});

test('detailed flags expand only the matrix; compact cards stay byte-for-byte equivalent',()=>{
 const base=[flag('REPLY_DESK'),flag('ANALYTICS_ADVANCED'),flag('MULTI_ACCOUNT')];
 const extras=['KEYWORD_TO_DM','WELCOME_DM','STORY_REPLY_TO_DM','SHARE_TO_DM','WEBHOOK_LOGS'].map(key=>flag(key,'PRO'));
 const before=plans.map(p=>planHighlights(p,base));
 assert.deepEqual(plans.map(p=>planHighlights(p,[...base,...extras])),before);
 const matrix=buildPricingComparison(plans,[...base,...extras]);
 assert.equal(matrix.length,4);
 assert.equal(matrix[1].features.length,4);
 assert.equal(matrix[1].features[0].free,false);
 assert.equal(matrix[1].features[0].pro,true);
 assert.equal(matrix[0].features.find(f=>f.name==='Keywords per campaign').free,'10 keywords');
 assert.equal(matrix[3].features[0].pro,true);
 assert(!matrix.flatMap(c=>c.features).some(f=>/new follower/i.test(f.name)));
});
