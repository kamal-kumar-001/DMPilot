const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('every listed flag has an explicit implementation classification',()=>{
 const flags=fs.readFileSync('apps/api/src/billing/feature-flag.service.ts','utf8');const keys=[...flags.split('/**')[0].matchAll(/key: '([^']+)'/g)].map(m=>m[1]);
 const classes={NO_BRANDING:'included',VOICE_CREATE:'browser',VIRAL_QUEUE:'metadata',SPIKE_ALERTS:'metadata',EXPORT_DATA:'metadata',API_ACCESS:'metadata',audit_logging:'system',EMAIL_VERIFICATION_REQUIRED:'server',COMMENT_TO_DM:'server',KEYWORD_TO_DM:'server',WELCOME_DM:'server',STORY_REPLY_TO_DM:'server',SHARE_TO_DM:'server',COMMENT_REPLY:'server',DM_VARIANTS:'server',FOLLOW_CHECK_GATE:'server',ANALYTICS_ADVANCED:'server',MULTI_ACCOUNT:'server',REPLY_DESK:'server',WEBHOOK_LOGS:'server',MULTILINGUAL_HINGLISH:'server'};
 assert.equal(keys.length,21);for(const k of keys)assert.ok(classes[k],k);assert.equal(Object.keys(classes).length,keys.length);
});
