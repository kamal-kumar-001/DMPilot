// MCP tool-behavior tests (phase 3 connector security): honest copy, draft-first
// writes, dry-run default, compact paged lists, correct analytics path.
// Run after a fresh MCP build: pnpm --filter @dmpilot/mcp build && node tests/security/mcp-tool-behavior.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';

const requests = [];
const campaigns = Array.from({ length: 25 }, (_, i) => ({
  id: `c${i}`,
  name: `Campaign ${i}`,
  type: 'COMMENT_TO_DM',
  status: 'ACTIVE',
  instagramAccountId: 'ig-1',
  extraNoise: 'x'.repeat(50),
}));
const accounts = [
  { id: 'ig-1', username: 'alpha', displayName: 'Alpha', isConnected: true, webhookSubscribed: true, token: 'should-be-trimmed' },
];

const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/instagram') && req.method === 'GET') return res.end(JSON.stringify(accounts));
    if (req.url.startsWith('/campaigns') && req.method === 'GET') return res.end(JSON.stringify(campaigns));
    if (req.url === '/campaigns' && req.method === 'POST') return res.end(JSON.stringify({ id: 'c-new', ...JSON.parse(body) }));
    if (req.url === '/content/publish') return res.end(JSON.stringify({ id: 'p-new', draftOnly: true, ...JSON.parse(body), dryRun: true }));
    if (req.url === '/ads/boost') return res.end(JSON.stringify({ id: 'ad-new', deliveryMode: 'LOCAL_RECORD', deliveryNote: 'no ads or spend' }));
    if (req.url.startsWith('/analytics/summary')) return res.end(JSON.stringify({ dms: 10 }));
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

// 1. get_analytics calls the real /analytics/summary route (base /analytics 404s).
requests.length = 0;
{
  const res = await tools.get_analytics.handler({ timeRange: '7d' });
  assert.equal(requests[0].url.split('?')[0], '/analytics/summary');
  assert.equal(requests[0].url.includes('range=7d'), true);
  assert.equal(res.isError, undefined);
  ok('get_analytics hits /analytics/summary');
}

// 2. publish_post defaults to a dry run; the response says nothing was published.
requests.length = 0;
{
  const res = await tools.publish_post.handler({
    instagramAccountId: 'ig-1',
    mediaUrl: 'https://cdn.example.com/x.jpg',
  });
  assert.equal(requests[0].body.dryRun, true);
  assert.match(res.content[0].text, /Preview only: nothing was published/);
  ok('publish_post defaults to dryRun with a clear preview headline');
}

// 3. publish_post with dryRun:false is clamped server-side: keys are preview-only.
requests.length = 0;
{
  const res = await tools.publish_post.handler({
    instagramAccountId: 'ig-1',
    mediaUrl: 'https://cdn.example.com/x.jpg',
    dryRun: false,
  });
  assert.equal(requests[0].body.dryRun, false);
  assert.match(res.content[0].text, /Preview only: nothing was published/);
  ok('publish_post with dryRun:false is preview-only for keys (server clamp)');
}

// 4. create_campaign is a PAUSED draft unless activate:true.
requests.length = 0;
{
  const res = await tools.create_campaign.handler({
    instagramAccountId: 'ig-1',
    name: 'Promo',
    type: 'COMMENT_TO_DM',
    keywords: ['link'],
    messageTemplate: 'hi',
  });
  assert.equal(requests[0].body.status, 'PAUSED');
  assert.equal(requests[0].body.activate, undefined);
  assert.match(res.content[0].text, /PAUSED draft/);
  ok('create_campaign defaults to a PAUSED draft');
}

// 5. create_campaign with activate:true activates immediately.
requests.length = 0;
{
  const res = await tools.create_campaign.handler({
    instagramAccountId: 'ig-1',
    name: 'Promo',
    type: 'COMMENT_TO_DM',
    keywords: ['link'],
    messageTemplate: 'hi',
    activate: true,
  });
  assert.equal(requests[0].body.status, 'ACTIVE');
  assert.match(res.content[0].text, /Campaign created as ACTIVE/);
  ok('create_campaign with activate:true activates');
}

// 6. boost_post copy is honest about local-only recording.
requests.length = 0;
{
  const res = await tools.boost_post.handler({ instagramAccountId: 'ig-1', name: 'Boost' });
  assert.match(res.content[0].text, /no ads are delivered and no money is spent/);
  ok('boost_post states no ads are delivered and no money is spent');
}

// 7. list_campaigns returns compact paged results.
{
  const res = await tools.list_campaigns.handler({ limit: 10, offset: 20 });
  const page = JSON.parse(res.content[0].text);
  assert.equal(page.count, 5);
  assert.equal(page.total, 25);
  assert.equal(page.hasMore, false);
  assert.deepEqual(Object.keys(page.items[0]).sort(), ['id', 'instagramAccountId', 'name', 'status', 'type']);
  ok('list_campaigns pages client-side with compact fields');
}

// 8. list_connected_accounts returns compact paged results without secrets.
{
  const res = await tools.list_connected_accounts.handler({});
  const page = JSON.parse(res.content[0].text);
  assert.equal(page.count, 1);
  assert.equal(page.items[0].username, 'alpha');
  assert.equal(page.items[0].token, undefined);
  ok('list_connected_accounts trims account fields');
}

// 9. verify_webhook_health description discloses the repair write.
{
  assert.match(tools.verify_webhook_health.description, /repair write/);
  assert.match(tools.verify_webhook_health.description, /webhooks:manage/);
  ok('verify_webhook_health discloses the repair write and required scope');
}

stub.close();
console.log(`All ${passed} MCP tool-behavior checks passed.`);
