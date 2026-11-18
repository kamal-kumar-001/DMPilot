// Phase-5 measurement: comparable synthetic agent tasks, before (phase-3
// generic MCP tools / raw API) vs after (phase-5 task tools). Records ACTUAL
// MCP tool calls, underlying API calls and response bytes returned to the
// model. No token claims: tokens are only estimated (~4 chars/byte) and
// labelled as estimates in the output.
// Run: pnpm --filter @dmpilot/mcp build && node tests/security/mcp-task-measurement.mjs
import http from 'node:http';

const accounts = [
  { id: 'ig-1', username: 'alpha', displayName: 'Alpha', isConnected: true, webhookSubscribed: true },
  { id: 'ig-2', username: 'beta', displayName: 'Beta', isConnected: true, webhookSubscribed: true },
];
const campaigns = Array.from({ length: 25 }, (_, i) => ({
  id: `c-${i}`,
  name: `Campaign ${i}`,
  type: 'COMMENT_TO_DM',
  status: i < 3 ? 'ACTIVE' : 'PAUSED',
  instagramAccountId: i < 3 ? 'ig-1' : 'ig-2',
  description: 'x'.repeat(200),
}));
const deliveryLogs = Array.from({ length: 50 }, (_, i) => ({
  id: `l-${i}`,
  commentId: `cm-${i}`,
  commenterUsername: `@user${i}`,
  commentText: 'nice post, link please '.repeat(3),
  mediaId: 'm-1',
  status: i < 4 ? 'FAILED' : 'DELIVERED',
  dispatchStatus: i < 4 ? 'delivery failed (permission error).' : 'got the DM.',
  campaignName: 'Campaign 0',
  matchedKeyword: 'link',
  deliveredDmText: 'Here is the link you asked for '.repeat(4),
  fbtraceId: `trace-${i}`,
  createdAt: '2026-11-18T10:00:00Z',
}));

let apiCalls = [];
const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    apiCalls.push({ method: req.method, url: req.url });
    res.setHeader('Content-Type', 'application/json');
    const path = req.url.split('?')[0];
    if (path === '/instagram' && req.method === 'GET') return res.end(JSON.stringify(accounts));
    if (path === '/campaigns' && req.method === 'GET') return res.end(JSON.stringify(campaigns));
    if (path === '/campaigns' && req.method === 'POST') return res.end(JSON.stringify({ id: 'c-new', ...JSON.parse(body) }));
    if (path.startsWith('/campaigns/') && path.endsWith('/status')) return res.end(JSON.stringify({ id: path.split('/')[2], ...JSON.parse(body) }));
    if (path === '/monitoring/delivery-logs') return res.end(JSON.stringify({ logs: deliveryLogs, total: deliveryLogs.length, page: 1, limit: 50 }));
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'not found' }));
  });
});
await new Promise((resolve) => stub.listen(0, resolve));
const baseUrl = `http://127.0.0.1:${stub.address().port}`;
const { createDMPilotMcpServer } = await import('../../packages/mcp/dist/index.js');
const server = createDMPilotMcpServer({ apiKey: 'dmp_live_test', apiUrl: baseUrl });
const tools = server._registeredTools;

async function measure(label, fn) {
  apiCalls = [];
  let mcpCalls = 0;
  let bytes = 0;
  let success = true;
  try {
    const results = await fn(async (name, args) => {
      mcpCalls++;
      const res = await tools[name].handler(args);
      bytes += Buffer.byteLength(JSON.stringify(res.content));
      return res;
    });
    return { label, mcpCalls, apiCalls: apiCalls.length, responseBytes: bytes, success, results };
  } catch (e) {
    return { label, mcpCalls, apiCalls: apiCalls.length, responseBytes: bytes, success: false, error: e.message };
  }
}

const report = [];

// Task 1: configure a comment-to-DM draft on one post.
report.push(await measure('task1.before.generic-tools', async (call) => {
  await call('list_connected_accounts', {});
  await call('create_campaign', {
    instagramAccountId: 'ig-1',
    name: 'DM "link" commenters on @alpha',
    type: 'COMMENT_TO_DM',
    keywords: ['link'],
    messageTemplate: 'Here is the link',
  });
}));
report.push(await measure('task1.after.task-tool', async (call) => {
  await call('setup_comment_dm_draft', { username: 'alpha', keywords: ['link'], messageTemplate: 'Here is the link', mediaId: 'm-1' });
}));

// Task 2: diagnose a failed DM. Baseline toolset has no delivery-log tool,
// so the agent must hit the raw API; measure that path for comparability.
report.push(await measure('task2.before.raw-api', async (call) => {
  const raw = await fetch(`${baseUrl}/monitoring/delivery-logs?limit=50`);
  const data = await raw.text();
  return { simulatedBytes: Buffer.byteLength(data) };
}));
report.push(await measure('task2.after.task-tool', async (call) => {
  await call('diagnose_dm', { limit: 10 });
}));

// Task 3: pause one account's automations (simulation only).
report.push(await measure('task3.before.raw-api', async (call) => {
  const raw = await fetch(`${baseUrl}/campaigns`);
  const text = await raw.text();
  const list = JSON.parse(text);
  const active = list.filter((c) => c.instagramAccountId === 'ig-1' && c.status === 'ACTIVE');
  return { simulatedBytes: Buffer.byteLength(text), wouldPause: active.length };
}));
report.push(await measure('task3.after.task-tool', async (call) => {
  await call('pause_account_automations', { username: 'alpha' });
}));

// task2.before bypassed the MCP layer: fold its simulated bytes in.
for (const r of report) {
  if (r.results?.simulatedBytes) {
    r.responseBytes = r.results.simulatedBytes;
    delete r.results;
  }
}
for (const r of report) {
  r.estimatedTokens = `~${Math.ceil(r.responseBytes / 4)} (estimate only)`;
  delete r.results;
}
console.log(JSON.stringify(report, null, 2));
process.exit(0);
