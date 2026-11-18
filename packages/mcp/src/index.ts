import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';

export interface McpOptions {
  apiKey?: string;
  apiUrl?: string;
}

export function createDMPilotMcpServer(options: McpOptions = {}) {
  const apiKey = options.apiKey || process.env.DMPILOT_API_KEY;
  const apiUrl = (
    options.apiUrl ||
    process.env.DMPILOT_API_URL ||
    'https://api.dmpilot.org'
  ).replace(/\/$/, '');

  if (!apiKey) {
    console.error('Error: DMPILOT_API_KEY environment variable or --api-key argument is required.');
  }

  const client = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DMPilot-MCP-Server/1.0',
    },
    timeout: 30000,
  });

  const server = new McpServer({
    name: 'dmpilot',
    version: '1.0.0',
  });

  // 1. Tool: List Connected Instagram Accounts
  server.tool(
    'list_connected_accounts',
    'Lists all connected Instagram Business / Creator accounts, usernames, and live webhook health.',
    {},
    async () => {
      try {
        const res = await client.get('/instagram');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.data, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to list Instagram accounts: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 2. Tool: List Automation Campaigns
  server.tool(
    'list_campaigns',
    'Lists active Instagram automation campaigns (Comment-to-DM, Keyword Responder, Story Reply).',
    {
      status: z
        .enum(['ACTIVE', 'PAUSED', 'ARCHIVED'])
        .optional()
        .describe('Filter by campaign status'),
    },
    async ({ status }) => {
      try {
        const res = await client.get('/campaigns', { params: { status } });
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to list campaigns: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 3. Tool: Create Automation Campaign
  server.tool(
    'create_campaign',
    'Deploys a new Instagram DM or Comment automation campaign.',
    {
      instagramAccountId: z.string().describe('ID of connected Instagram account'),
      name: z.string().describe('Campaign name (e.g. "Summer Sale Link")'),
      type: z
        .enum([
          'COMMENT_TO_DM',
          'KEYWORD_TO_DM',
          'WELCOME_DM',
          'STORY_REPLY_TO_DM',
          'COMMENT_REPLY',
        ])
        .describe('Automation type'),
      keywords: z
        .array(z.string())
        .describe('List of trigger keywords (e.g. ["link", "recipe", "pricing"])'),
      messageTemplate: z.string().describe('Direct message copy sent to the user'),
      publicReplyText: z
        .string()
        .optional()
        .describe('Optional public reply posted under the comment'),
      isFollowerGated: z
        .boolean()
        .optional()
        .describe('Require user to follow account before receiving DM link'),
    },
    async (params) => {
      try {
        const res = await client.post('/campaigns', params);
        return {
          content: [
            {
              type: 'text',
              text: `Campaign successfully created:\n${JSON.stringify(res.data, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to create campaign: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 4. Tool: Publish Instagram Post or Reel
  server.tool(
    'publish_post',
    'Directly publishes an image or reel to an Instagram account via Meta Graph API.',
    {
      instagramAccountId: z.string().describe('ID of connected Instagram account'),
      mediaUrl: z
        .string()
        .url()
        .describe('Direct HTTPS URL to image (JPG/PNG) or reel video (MP4)'),
      caption: z.string().optional().describe('Instagram caption with hashtags and CTAs'),
      mediaType: z
        .enum(['IMAGE', 'REEL', 'VIDEO'])
        .optional()
        .describe('Media format (default: IMAGE)'),
    },
    async (params) => {
      try {
        const res = await client.post('/content/publish', params);
        return {
          content: [
            {
              type: 'text',
              text: `Post published successfully to Instagram:\n${JSON.stringify(res.data, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to publish post: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 5. Tool: Boost Post / Create Ad Campaign
  server.tool(
    'boost_post',
    'Launches a paid Instagram boosted post or ad campaign with daily budget.',
    {
      instagramAccountId: z.string().describe('ID of connected Instagram account'),
      name: z.string().describe('Campaign name'),
      objective: z
        .enum(['OUTCOME_ENGAGEMENT', 'OUTCOME_MESSAGES'])
        .optional()
        .describe('Ad objective'),
      dailyBudgetPaise: z
        .number()
        .min(10000)
        .optional()
        .describe('Daily budget in paise (e.g. 50000 = ₹500/day)'),
      mediaId: z.string().optional().describe('Instagram media ID to boost'),
    },
    async (params) => {
      try {
        const res = await client.post('/ads/boost', params);
        return {
          content: [
            {
              type: 'text',
              text: `Ad campaign launched successfully:\n${JSON.stringify(res.data, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to launch ad campaign: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 6. Tool: Verify & Repair Webhook Health
  server.tool(
    'verify_webhook_health',
    'Verifies Meta webhook reachability and executes self-healing subscription if disconnected.',
    {
      accountId: z.string().describe('Instagram account ID'),
    },
    async ({ accountId }) => {
      try {
        const res = await client.post(`/instagram/${accountId}/verify-webhook`);
        return {
          content: [
            {
              type: 'text',
              text: `Webhook verification result:\n${JSON.stringify(res.data, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Webhook check failed: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  // 7. Tool: Get Instagram Performance Analytics
  server.tool(
    'get_analytics',
    'Retrieves DM automation metrics, comments tracked, and conversion velocity.',
    {
      timeRange: z.enum(['7d', '30d', '90d']).optional().describe('Time period for metrics'),
    },
    async ({ timeRange }) => {
      try {
        const res = await client.get('/analytics', { params: { range: timeRange || '30d' } });
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to retrieve analytics: ${err.response?.data?.message || err.message}`,
            },
          ],
        };
      }
    },
  );

  return server;
}

export async function runStdioServer() {
  const args = process.argv.slice(2);
  let apiKey = process.env.DMPILOT_API_KEY;
  let apiUrl = process.env.DMPILOT_API_URL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--api-url' && args[i + 1]) {
      apiUrl = args[i + 1];
      i++;
    }
  }

  const server = createDMPilotMcpServer({ apiKey, apiUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
