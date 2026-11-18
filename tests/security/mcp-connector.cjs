const { test } = require('node:test');
const assert = require('node:assert/strict');

test('DMPilot MCP Server exposes all 7 native agent tools', async () => {
  const { createDMPilotMcpServer } = await import('../../packages/mcp/dist/index.js');

  const server = createDMPilotMcpServer({
    apiKey: 'dmp_live_' + 'a'.repeat(48),
    apiUrl: 'http://localhost:4000',
  });

  assert.ok(server, 'Server instance should be created');

  // Verify internal tools are registered
  // In @modelcontextprotocol/sdk, tools are registered in server._registeredTools or similar map
  const registeredTools = server._registeredTools || {};
  const toolNames = Object.keys(registeredTools);

  const expectedTools = [
    'list_connected_accounts',
    'list_campaigns',
    'create_campaign',
    'publish_post',
    'boost_post',
    'verify_webhook_health',
    'get_analytics',
  ];

  for (const tool of expectedTools) {
    assert.ok(toolNames.includes(tool), `Tool "${tool}" should be registered on MCP server`);
  }
});
