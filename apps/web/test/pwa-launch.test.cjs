const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const target = new Module(__filename);
target._compile(ts.transpileModule(fs.readFileSync('lib/pwa-launch.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, __filename);
const {isStandaloneLaunch,pwaLaunchTarget}=target.exports;
test('standalone detection supports Chromium and iOS, not ordinary browser install state',()=>{
 assert.equal(isStandaloneLaunch(true,false),true);
 assert.equal(isStandaloneLaunch(false,true),true);
 assert.equal(isStandaloneLaunch(false,false,'android-app://com.android.chrome'),true);
 assert.equal(isStandaloneLaunch(false,false,'https://example.com/?android-app://fake'),false);
 assert.equal(isStandaloneLaunch(false,undefined),false);
});
test('launch waits for session then routes correctly, including expired-session error',()=>{
 assert.equal(pwaLaunchTarget('loading'),null);
 assert.equal(pwaLaunchTarget('authenticated'),'/dashboard');
 assert.equal(pwaLaunchTarget('unauthenticated'),'/login');
 assert.equal(pwaLaunchTarget('authenticated','RefreshAccessTokenError'),'/login');
});
