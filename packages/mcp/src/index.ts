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

  // Keep MCP responses compact: full objects can flood the model context,
  // so list tools return trimmed fields and page client-side.
  function paged<T>(rows: T[], limit: number, offset: number) {
    const page = rows.slice(offset, offset + limit);
    return {
      count: page.length,
      total: rows.length,
      offset,
      hasMore: offset + page.length < rows.length,
      items: page,
    };
  }

  // 1. Tool: List Connected Instagram Accounts
  server.tool(
    'list_connected_accounts',
    'Lists connected Instagram Business / Creator accounts with usernames and webhook health. Compact and paged; raise limit to see more.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max accounts to return (default 20)'),
      offset: z.number().int().min(0).optional().describe('Skip this many accounts (default 0)'),
    },
    async ({ limit, offset }) => {
      try {
        const res = await client.get('/instagram');
        const rows = (Array.isArray(res.data) ? res.data : []).map((a: any) => ({
          id: a.id,
          username: a.username,
          displayName: a.displayName,
          isConnected: a.isConnected,
          webhookSubscribed: a.webhookSubscribed ?? a.webhookStatus ?? null,
        }));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(paged(rows, limit ?? 20, offset ?? 0), null, 2),
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
    'Lists Instagram automation campaigns (Comment-to-DM, Keyword Responder, Story Reply). Compact and paged; raise limit to see more.',
    {
      status: z
        .enum(['ACTIVE', 'PAUSED', 'ARCHIVED'])
        .optional()
        .describe('Filter by campaign status'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max campaigns to return (default 20)'),
      offset: z.number().int().min(0).optional().describe('Skip this many campaigns (default 0)'),
    },
    async ({ status, limit, offset }) => {
      try {
        const res = await client.get('/campaigns', { params: { status } });
        const rows = (Array.isArray(res.data) ? res.data : []).map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          instagramAccountId: c.instagramAccountId,
        }));
        return {
          content: [
            { type: 'text', text: JSON.stringify(paged(rows, limit ?? 20, offset ?? 0), null, 2) },
          ],
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
    'Creates an Instagram DM or Comment automation campaign as a PAUSED draft by default; pass activate: true to activate it immediately.',
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
      activate: z
        .boolean()
        .optional()
        .describe('Activate immediately (default false: campaign is created as a PAUSED draft)'),
    },
    async ({ activate, ...params }) => {
      try {
        const res = await client.post('/campaigns', {
          ...params,
          status: activate ? 'ACTIVE' : 'PAUSED',
        });
        const state = activate ? 'ACTIVE' : 'PAUSED draft';
        return {
          content: [
            {
              type: 'text',
              text: `Campaign created as ${state}:\n${JSON.stringify(res.data, null, 2)}`,
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
    'Publishes an image or reel to an Instagram account. Dry-run by default (validates and previews only); pass dryRun: false to actually publish.',
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
      dryRun: z
        .boolean()
        .optional()
        .describe('Preview only (default true). Set to false to publish for real.'),
    },
    async (params) => {
      try {
        const dryRun = params.dryRun ?? true;
        const res = await client.post('/content/publish', { ...params, dryRun });
        const headline = dryRun
          ? 'Dry run: nothing was published. Preview:'
          : 'Post published successfully to Instagram:';
        return {
          content: [
            {
              type: 'text',
              text: `${headline}\n${JSON.stringify(res.data, null, 2)}`,
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
    "Records a boosted-post campaign locally. DMPilot's Meta Ads integration is not connected, so this does NOT deliver ads or spend money.",
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
              text: `Ad campaign recorded locally (no ads are delivered and no money is spent):\n${JSON.stringify(res.data, null, 2)}`,
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
    'Checks Meta webhook subscription status and, if disconnected, performs a repair write that re-subscribes the account. Requires a key with the webhooks:manage scope.',
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
        const res = await client.get('/analytics/summary', {
          params: { range: timeRange || '30d' },
        });
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
