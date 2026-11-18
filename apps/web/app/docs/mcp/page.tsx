import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { AmbientBackground } from '@/components/landing/AmbientBackground';

const title = 'MCP Server & Agent API Docs';
const description =
  'Connect AI assistants to DMPilot over the Model Context Protocol: scoped personal access tokens, draft-first writes, dry-run previews, and task-shaped tools for comment-to-DM automation.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/docs/mcp' },
  openGraph: {
    title: `${title} | DMPilot`,
    description,
    url: '/docs/mcp',
    type: 'article',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'DMPilot MCP Server & Agent API Documentation',
  description,
  url: 'https://www.dmpilot.org/docs/mcp',
  author: { '@type': 'Organization', name: 'DMPilot', url: 'https://www.dmpilot.org' },
  about: {
    '@type': 'SoftwareApplication',
    name: 'DMPilot',
    applicationCategory: 'BusinessApplication',
  },
  proficiencyLevel: 'Beginner',
};

const genericTools = [
  [
    'list_connected_accounts',
    'List connected Instagram accounts with webhook health (paged, trimmed).',
  ],
  ['list_campaigns', 'List automation campaigns, filterable by status (paged, trimmed).'],
  ['create_campaign', 'Create a DM or comment automation as a PAUSED draft by default.'],
  [
    'publish_post',
    'Preview an image or reel publish. Keys are always preview-only; publishing happens from the dashboard.',
  ],
  ['boost_post', 'Record a boost locally. No ads are delivered and no money is spent.'],
  [
    'verify_webhook_health',
    'Check Meta webhook status and repair the subscription (webhooks:manage scope).',
  ],
  ['get_analytics', 'DM automation metrics, comments tracked and conversion velocity.'],
] as const;

const taskTools = [
  ['whoami', 'Show the calling key\u2019s own scopes and Instagram account restrictions.'],
  [
    'setup_comment_dm_draft',
    'One call: resolve the account, create a PAUSED comment-to-DM draft on a post, idempotent per clientRequestId.',
  ],
  ['diagnose_dm', 'Recent failed or unmatched DM deliveries with the reason and a suggested fix.'],
  [
    'pause_account_automations',
    'Preview (default) or pause every active automation on one account.',
  ],
  ['pause_campaign', 'Pause a single active campaign by id. Activation is dashboard-only.'],
] as const;

export default function McpDocsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AmbientBackground />
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-32 space-y-16 relative z-10">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
            <span>Developer Docs</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            DMPilot MCP Server
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Connect an AI assistant to your DMPilot account over the Model Context Protocol (MCP).
            The assistant works inside the scopes you grant - nothing more.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">How it works</h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 text-sm leading-relaxed">
            <li>
              The MCP server runs locally over stdio from the DMPilot repository (
              <code>packages/mcp</code>) and talks to the DMPilot API on your behalf.
            </li>
            <li>
              Authenticate with a Personal Access Token (<code>dmp_live_...</code>) from your
              dashboard settings, passed as <code>DMPILOT_API_KEY</code>.
            </li>
            <li>
              Keys are read-only by default. Write scopes (<code>campaigns:write</code>,{' '}
              <code>webhooks:manage</code>) and per-account restrictions are opt-in per key.
            </li>
            <li>
              Writes are safe by default: campaigns are created as PAUSED drafts, publishing via API
              keys is always a preview (actual publishing happens from the dashboard), and creates
              accept an idempotency key.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Connect your assistant</h2>
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 text-sm font-mono overflow-x-auto">
            <pre>{`# any MCP client that supports stdio servers
export DMPILOT_API_KEY=dmp_live_your_token_here
export DMPILOT_API_URL=https://api.dmpilot.org   # optional, this is the default
pnpm --filter @dmpilot/mcp build                 # one-time build (from the repository root)
node packages/mcp/bin/index.js                   # starts the stdio server`}</pre>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            Not sure what your key can do? Ask your assistant to call <code>whoami</code> - it
            returns the key&apos;s scopes and account restrictions, nothing else.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Task tools</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            One call per common job, with compact responses and actionable errors.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {taskTools.map(([name, desc]) => (
                  <tr key={name} className="border-b border-slate-100 last:border-0">
                    <td className="p-4 font-mono text-emerald-700 whitespace-nowrap">{name}</td>
                    <td className="p-4 text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Core tools</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {genericTools.map(([name, desc]) => (
                  <tr key={name} className="border-b border-slate-100 last:border-0">
                    <td className="p-4 font-mono text-emerald-700 whitespace-nowrap">{name}</td>
                    <td className="p-4 text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Machine-readable references</h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 text-sm leading-relaxed">
            <li>
              <Link href="/llms.txt" className="text-emerald-700 font-semibold hover:underline">
                llms.txt
              </Link>{' '}
              - concise manifest for language models.
            </li>
            <li>
              <Link
                href="/llms-full.txt"
                className="text-emerald-700 font-semibold hover:underline"
              >
                llms-full.txt
              </Link>{' '}
              - full manifest with pricing and FAQ.
            </li>
            <li>
              OpenAPI 3.1 spec and interactive Swagger UI are served by the API at{' '}
              <code>/api/openapi.json</code> and <code>/api/docs</code>. All endpoints enforce the
              same key scopes.
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
