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

  // ---- Task-shaped tools (phase 5): one call per common job, compact ----
  // output, actionable errors. They compose the same scoped API routes as
  // the generic tools above; no new authority is granted.

  function toolError(prefix: string, err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    const hint =
      status === 403
        ? ' (key lacks the required scope or account access; call whoami to inspect your key)'
        : status === 404
          ? ' (not found; list resources first to get current ids)'
          : '';
    return {
      isError: true as const,
      content: [{ type: 'text' as const, text: `${prefix}: ${msg}${hint}` }],
    };
  }

  async function resolveAccountId(ref: { instagramAccountId?: string; username?: string }) {
    const res = await client.get('/instagram');
    const accounts = (Array.isArray(res.data) ? res.data : []).map((a: any) => ({
      id: a.id,
      username: a.username,
      isConnected: a.isConnected,
    }));
    if (ref.instagramAccountId) {
      const hit = accounts.find((a: any) => a.id === ref.instagramAccountId);
      if (!hit) {
        throw Object.assign(
          new Error(
            `account id ${ref.instagramAccountId} is not connected to this key. Available: ${
              accounts.map((a: any) => `@${a.username} (${a.id})`).join(', ') || 'none'
            }`,
          ),
          { response: { status: 404 } },
        );
      }
      return hit;
    }
    if (ref.username) {
      const uname = ref.username.replace(/^@/, '').toLowerCase();
      const hit = accounts.find((a: any) => String(a.username).toLowerCase() === uname);
      if (!hit) {
        throw Object.assign(
          new Error(
            `no connected account @${uname}. Available: ${
              accounts.map((a: any) => `@${a.username}`).join(', ') || 'none'
            }`,
          ),
          { response: { status: 404 } },
        );
      }
      return hit;
    }
    if (accounts.length === 1) return accounts[0];
    throw Object.assign(
      new Error(
        `pass instagramAccountId or username. Connected accounts: ${
          accounts.map((a: any) => `@${a.username} (${a.id})`).join(', ') || 'none'
        }`,
      ),
      { response: { status: 400 } },
    );
  }

  // 8. Tool: Whoami (own key scopes and account restrictions)
  server.tool(
    'whoami',
    "Shows the calling API key's own scopes and Instagram account restrictions. Use this first to learn what this key may do.",
    {},
    async () => {
      try {
        const res = await client.get('/auth/api-keys/current');
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }],
        };
      } catch (err: any) {
        return toolError('whoami failed', err);
      }
    },
  );

  // 9. Tool: Configure a comment-to-DM draft on one post (single call)
  server.tool(
    'setup_comment_dm_draft',
    'Creates a PAUSED comment-to-DM draft on one post in a single call: resolves the account, applies safe defaults, and is idempotent per clientRequestId. Nothing goes live until you activate it.',
    {
      instagramAccountId: z
        .string()
        .optional()
        .describe('Connected account id; or pass username instead'),
      username: z
        .string()
        .optional()
        .describe(
          'Connected account username (e.g. "myshop"); omit when the key has exactly one account',
        ),
      keywords: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe('Trigger keywords, exact match (e.g. ["link"])'),
      messageTemplate: z.string().describe('DM text sent to commenters'),
      mediaId: z
        .string()
        .optional()
        .describe('Limit the automation to this Instagram media id; omit for all posts'),
      publicReplyText: z
        .string()
        .optional()
        .describe('Optional public reply posted under the comment'),
      clientRequestId: z
        .string()
        .optional()
        .describe('Idempotency key; a retry with the same key returns the original draft'),
      activate: z
        .boolean()
        .optional()
        .describe('Activate immediately (default false: stays a PAUSED draft)'),
    },
    async (params) => {
      try {
        const account = await resolveAccountId(params);
        const name = `DM "${params.keywords[0]}" commenters on @${account.username}${
          params.mediaId ? ` (post ${params.mediaId})` : ''
        }`;
        const res = await client.post('/campaigns', {
          name,
          type: 'COMMENT_TO_DM',
          instagramAccountId: account.id,
          replyMessage: params.messageTemplate,
          keywords: params.keywords.map((keyword) => ({ keyword, matchingRule: 'EXACT' })),
          ...(params.mediaId ? { posts: [{ mediaId: params.mediaId }] } : {}),
          ...(params.publicReplyText
            ? { commentReplyEnabled: true, commentReplyText: params.publicReplyText }
            : {}),
          clientRequestId: params.clientRequestId,
          status: params.activate ? 'ACTIVE' : 'PAUSED',
        });
        const c = res.data;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  campaignId: c.id,
                  name: c.name,
                  status: c.status,
                  account: `@${account.username}`,
                  keywords: params.keywords,
                  mediaId: params.mediaId ?? null,
                  next: params.activate
                    ? 'Campaign is live.'
                    : 'Draft is paused. Activate with update_campaign_status when ready.',
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return toolError('Failed to create comment-to-DM draft', err);
      }
    },
  );

  // 10. Tool: Diagnose DM delivery problems (single call, failures first)
  server.tool(
    'diagnose_dm',
    'Diagnoses DM delivery: returns recent failed or unmatched deliveries with the reason and a suggested fix, most recent first.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Max delivery events to scan (default 10, max 50)'),
      includeSuccessful: z
        .boolean()
        .optional()
        .describe('Include successful deliveries too (default false: failures only)'),
    },
    async ({ limit, includeSuccessful }) => {
      try {
        const res = await client.get('/monitoring/delivery-logs', {
          params: { limit: limit ?? 10 },
        });
        const logs = Array.isArray(res.data?.logs) ? res.data.logs : [];
        const trimmed = logs
          .map((l: any) => ({
            id: l.id,
            status: l.status,
            who: l.commenterUsername ?? l.recipientUsername ?? null,
            campaign: l.campaignName ?? null,
            reason: l.dispatchStatus ?? l.errorMessage ?? null,
            at: l.createdAt,
          }))
          .filter(
            (l: any) => includeSuccessful || l.status === 'FAILED' || l.status === 'NO_MATCH',
          );
        const failures = trimmed.filter((l: any) => l.status !== 'DELIVERED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  scanned: logs.length,
                  failing: failures.length,
                  events: trimmed,
                  hint:
                    failures.length > 0
                      ? 'NO_MATCH means the comment matched no keyword; FAILED means Meta rejected the DM (check the reason, permissions and webhook health with verify_webhook_health).'
                      : 'No failing deliveries in the scanned window.',
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return toolError('Failed to diagnose DM delivery', err);
      }
    },
  );

  // 11. Tool: Pause one account's automations (preview by default)
  server.tool(
    'pause_account_automations',
    'Previews or performs pausing every ACTIVE automation on one account. Dry-run by default; pass dryRun: false to actually pause. Already-paused campaigns are skipped.',
    {
      instagramAccountId: z
        .string()
        .optional()
        .describe('Connected account id; or pass username instead'),
      username: z
        .string()
        .optional()
        .describe('Connected account username; omit when the key has exactly one account'),
      dryRun: z
        .boolean()
        .optional()
        .describe('Preview only (default true). Set to false to actually pause.'),
    },
    async (params) => {
      try {
        const account = await resolveAccountId(params);
        const res = await client.get('/campaigns');
        const active = (Array.isArray(res.data) ? res.data : []).filter(
          (c: any) => c.instagramAccountId === account.id && c.status === 'ACTIVE',
        );
        const dryRun = params.dryRun ?? true;
        if (dryRun) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    dryRun: true,
                    account: `@${account.username}`,
                    wouldPause: active.map((c: any) => ({ id: c.id, name: c.name })),
                    count: active.length,
                    next: 'Nothing changed. Re-run with dryRun: false to pause these campaigns.',
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
        const paused: any[] = [];
        for (const c of active) {
          await client.patch(`/campaigns/${c.id}/status`, { status: 'PAUSED' });
          paused.push({ id: c.id, name: c.name });
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { dryRun: false, account: `@${account.username}`, paused, count: paused.length },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: any) {
        return toolError('Failed to pause account automations', err);
      }
    },
  );

  // 12. Tool: Set one campaign's status (activate / pause a single automation)
  server.tool(
    'set_campaign_status',
    "Activates or pauses a single campaign by id. Pausing is always allowed; activation requires the key's campaigns:write scope.",
    {
      campaignId: z
        .string()
        .describe('Campaign id (from list_campaigns or setup_comment_dm_draft)'),
      status: z.enum(['ACTIVE', 'PAUSED']).describe('Target status'),
    },
    async ({ campaignId, status }) => {
      try {
        const res = await client.patch(`/campaigns/${campaignId}/status`, { status });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ campaignId, status: res.data?.status ?? status }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return toolError('Failed to update campaign status', err);
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
