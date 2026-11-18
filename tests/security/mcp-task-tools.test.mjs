// MCP task-tool tests (phase 5): whoami, setup_comment_dm_draft, diagnose_dm,
// pause_account_automations, set_campaign_status. Verifies compact output,
// actionable errors, dry-run defaults, idempotency pass-through and scope
// boundary hints against a stub API.
// Run after a fresh MCP build: pnpm --filter @dmpilot/mcp build && node tests/security/mcp-task-tools.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';

const requests = [];
const accounts = [
  { id: 'ig-1', username: 'alpha', displayName: 'Alpha', isConnected: true },
  { id: 'ig-2', username: 'beta', displayName: 'Beta', isConnected: true },
];
const campaigns = [
  { id: 'c-1', name: 'A1', type: 'COMMENT_TO_DM', status: 'ACTIVE', instagramAccountId: 'ig-1' },
  { id: 'c-2', name: 'A2', type: 'KEYWORD_TO_DM', status: 'ACTIVE', instagramAccountId: 'ig-1' },
  { id: 'c-3', name: 'P1', type: 'COMMENT_TO_DM', status: 'PAUSED', instagramAccountId: 'ig-1' },
  { id: 'c-4', name: 'B1', type: 'COMMENT_TO_DM', status: 'ACTIVE', instagramAccountId: 'ig-2' },
];
const deliveryLogs = [
  { id: 'l-1', status: 'FAILED', commenterUsername: '@u1', campaignName: 'A1', dispatchStatus: 'delivery failed (permission error).', createdAt: '2026-11-18T10:00:00Z' },
  { id: 'l-2', status: 'DELIVERED', commenterUsername: '@u2', campaignName: 'A1', dispatchStatus: 'got the DM.', createdAt: '2026-11-18T09:00:00Z' },
  { id: 'l-3', status: 'NO_MATCH', commenterUsername: '@u3', campaignName: 'Automated Campaign', dispatchStatus: 'commented without a matching keyword, nothing to send.', createdAt: '2026-11-18T08:00:00Z' },
];

const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    const path = req.url.split('?')[0];
    if (path === '/auth/api-keys/current') {
      return res.end(JSON.stringify({ keyId: 'key-1', scopes: ['read', 'campaigns:write'], instagramAccountIds: ['ig-1'], accountRestricted: true }));
    }
    if (path === '/instagram' && req.method === 'GET') return res.end(JSON.stringify(accounts));
    if (path === '/campaigns' && req.method === 'GET') return res.end(JSON.stringify(campaigns));
    if (path === '/campaigns' && req.method === 'POST') {
      const parsed = JSON.parse(body);
      if (parsed.clientRequestId === 'seen-1') {
        res.statusCode = 409;
        return res.end(JSON.stringify({ message: 'clientRequestId was already used with a different payload' }));
      }
      return res.end(JSON.stringify({ id: 'c-new', ...parsed }));
    }
    if (path === '/campaigns/c-denied/status') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ message: 'API key not authorized for this route (missing_scope:campaigns:write)' }));
    }
    if (path.startsWith('/campaigns/') && path.endsWith('/status') && req.method === 'PATCH') {
      return res.end(JSON.stringify({ id: path.split('/')[2], ...JSON.parse(body) }));
    }
    if (path === '/monitoring/delivery-logs') return res.end(JSON.stringify({ logs: deliveryLogs, total: deliveryLogs.length, page: 1, limit: 10 }));
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'not found' }));
  });
});

await new Promise((resolve) => stub.listen(0, resolve));
const baseUrl = `http://127.0.0.1:${stub.address().port}`;

const { createDMPilotMcpServer } = await import('../../packages/mcp/dist/index.js');
const server = createDMPilotMcpServer({ apiKey: 'dmp_live_test', apiUrl: baseUrl });
const tools = server._registeredTools;

let passed = 0;
function ok(name) { passed++; console.log(`  ${passed}. ${name}`); }

// 1. whoami returns the key's own scopes and account restriction.
requests.length = 0;
{
  const res = await tools.whoami.handler({});
  assert.equal(requests[0].url, '/auth/api-keys/current');
  const data = JSON.parse(res.content[0].text);
  assert.deepEqual(data.scopes, ['read', 'campaigns:write']);
  assert.equal(data.accountRestricted, true);
  assert.deepEqual(data.instagramAccountIds, ['ig-1']);
  ok('whoami returns own key scopes and account restrictions');
}

// 2. setup_comment_dm_draft resolves the account by username and posts a PAUSED draft.
requests.length = 0;
{
  const res = await tools.setup_comment_dm_draft.handler({
    username: 'alpha',
    keywords: ['link'],
    messageTemplate: 'Here you go',
    mediaId: 'm-9',
    clientRequestId: 'req-1',
  });
  assert.equal(requests[0].url, '/instagram');
  assert.equal(requests[1].url, '/campaigns');
  assert.equal(requests[1].body.instagramAccountId, 'ig-1');
  assert.equal(requests[1].body.type, 'COMMENT_TO_DM');
  assert.equal(requests[1].body.status, 'PAUSED');
  assert.equal(requests[1].body.clientRequestId, 'req-1');
  assert.deepEqual(requests[1].body.keywords, [{ keyword: 'link', matchingRule: 'EXACT' }]);
  assert.deepEqual(requests[1].body.posts, [{ mediaId: 'm-9' }]);
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.campaignId, 'c-new');
  assert.match(out.next, /paused/i);
  ok('setup_comment_dm_draft creates a PAUSED idempotent draft in one call');
}

// 3. setup_comment_dm_draft without an account ref errors actionably (multiple accounts).
{
  const res = await tools.setup_comment_dm_draft.handler({ keywords: ['x'], messageTemplate: 'y' });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /@alpha/);
  assert.match(res.content[0].text, /pass instagramAccountId or username/i);
  ok('ambiguous account produces an actionable error listing accounts');
}

// 4. setup_comment_dm_draft with an unknown username errors actionably.
{
  const res = await tools.setup_comment_dm_draft.handler({ username: 'nope', keywords: ['x'], messageTemplate: 'y' });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /no connected account @nope/i);
  ok('unknown username produces an actionable error');
}

// 5. Idempotent retry: same clientRequestId conflict is surfaced honestly.
{
  const res = await tools.setup_comment_dm_draft.handler({
    username: 'alpha',
    keywords: ['x'],
    messageTemplate: 'y',
    clientRequestId: 'seen-1',
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /clientRequestId was already used/);
  ok('idempotency conflict is surfaced with the server message');
}

// 6. diagnose_dm defaults to failures only, compact fields, with a hint.
requests.length = 0;
{
  const res = await tools.diagnose_dm.handler({});
  assert.match(requests[0].url, /^\/monitoring\/delivery-logs\?limit=10/);
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.scanned, 3);
  assert.equal(out.failing, 2);
  assert.equal(out.events.length, 2);
  assert.equal(out.events.some((e) => e.status === 'DELIVERED'), false);
  assert.match(out.hint, /NO_MATCH/);
  ok('diagnose_dm returns failures only with compact fields and a hint');
}

// 7. diagnose_dm includeSuccessful includes delivered events.
{
  const res = await tools.diagnose_dm.handler({ includeSuccessful: true, limit: 25 });
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.events.length, 3);
  ok('diagnose_dm includeSuccessful includes delivered events');
}

// 8. pause_account_automations defaults to a dry run: no writes, only ACTIVE of that account.
requests.length = 0;
{
  const res = await tools.pause_account_automations.handler({ username: 'alpha' });
  assert.equal(requests.some((r) => r.method === 'PATCH'), false);
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.dryRun, true);
  assert.equal(out.count, 2);
  assert.deepEqual(out.wouldPause.map((c) => c.id), ['c-1', 'c-2']);
  assert.match(out.next, /Nothing changed/);
  ok('pause_account_automations previews only ACTIVE campaigns by default');
}

// 9. pause_account_automations with dryRun:false pauses each ACTIVE campaign.
requests.length = 0;
{
  const res = await tools.pause_account_automations.handler({ instagramAccountId: 'ig-1', dryRun: false });
  const patches = requests.filter((r) => r.method === 'PATCH');
  assert.equal(patches.length, 2);
  assert.deepEqual(patches.map((r) => r.url).sort(), ['/campaigns/c-1/status', '/campaigns/c-2/status']);
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.count, 2);
  ok('pause_account_automations with dryRun:false pauses exactly the ACTIVE campaigns');
}

// 10. pause_campaign issues a PAUSED status PATCH only (activation is dashboard-only).
requests.length = 0;
{
  const res = await tools.pause_campaign.handler({ campaignId: 'c-1' });
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[0].url, '/campaigns/c-1/status');
  assert.equal(requests[0].body.status, 'PAUSED');
  assert.equal(res.isError, undefined);
  ok('pause_campaign patches PAUSED status only');
}

// 11. Scope denial surfaces an actionable whoami hint.
{
  const res = await tools.pause_campaign.handler({ campaignId: 'c-denied' });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /missing_scope:campaigns:write/);
  assert.match(res.content[0].text, /whoami/);
  ok('scope denial error points at whoami');
}

console.log(`MCP-TASK-TOOLS all ${passed} checks passed`);
process.exit(0);
