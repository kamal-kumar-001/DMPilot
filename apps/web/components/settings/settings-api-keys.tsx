'use client';

import * as React from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Terminal,
  ExternalLink,
  Bot,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

interface CreatedKeyResponse extends ApiKeyItem {
  apiKey: string;
}

export function SettingsApiKeys() {
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Creation State
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [keyName, setKeyName] = React.useState('');
  const [expiresInDays, setExpiresInDays] = React.useState<number | undefined>(90);
  const [creating, setCreating] = React.useState(false);

  // Success Reveal State
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Revocation State
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const fetchKeys = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<ApiKeyItem[]>('/auth/api-keys');
      setKeys(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    try {
      const res = await apiRequest<CreatedKeyResponse>('/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: keyName.trim(),
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
        }),
      });

      if (res?.apiKey) {
        setCreatedKey(res.apiKey);
        setKeyName('');
        setShowCreateModal(false);
        fetchKeys();
        toast.success('API key generated successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke "${name}"? Any agent using this token will instantly lose access.`,
      )
    ) {
      return;
    }

    setRevokingId(id);
    try {
      await apiRequest(`/auth/api-keys/${id}`, {
        method: 'DELETE',
      });
      toast.success('API key revoked');
      fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Token copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Never used';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dmpilot.org';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/80">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Personal Access Tokens & Agent API
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/60 text-emerald-700 border border-emerald-200/60">
                  <Sparkles className="h-3 w-3" />
                  Agent Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Grant autonomous agents (Claude Code, OpenClaw, AutoGPT, terminal CLI) secure access
                to deploy campaigns and monitor automations.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 text-xs font-semibold self-start sm:self-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Generate New Token</span>
          </Button>
        </div>

        {/* Quick Links to Machine-Readable Specs */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Specs:</span>
          <a
            href={`${apiUrl}/api/openapi.json`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-mono text-[11px]"
          >
            <Terminal className="h-3.5 w-3.5 text-slate-500" />
            OpenAPI 3.1 JSON
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
          <a
            href={`${apiUrl}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-mono text-[11px]"
          >
            <Bot className="h-3.5 w-3.5 text-slate-500" />
            Swagger Interactive UI
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
          <a
            href="/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-mono text-[11px]"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            /llms.txt Manifest
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Newly Created Key Modal / Notification */}
      {createdKey && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">Personal Access Token Generated</h4>
              <p className="text-[11px] text-amber-700">
                Please copy and save this secret key securely. For your privacy and security,{' '}
                <span className="font-semibold underline">
                  you will not be able to view it again
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-amber-200/80 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 break-all select-all shadow-inner">
              {createdKey}
            </div>
            <Button
              onClick={() => copyToClipboard(createdKey)}
              className="flex items-center space-x-1.5 text-xs font-semibold shrink-0"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy Key'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setCreatedKey(null)}
              className="text-xs font-semibold shrink-0"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Active Tokens Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Active Personal Access Tokens
          </h4>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading active access tokens...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Key className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">No API keys created yet</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Generate an API key to allow your terminal scripts or autonomous agents to automate
                Instagram direct messages and campaigns.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="outline"
              className="text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create your first token
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Token Name</th>
                  <th className="px-6 py-3">Identifier Prefix</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <Bot className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{k.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-600">
                      <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">
                        {k.prefix}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(k.createdAt)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(k.lastUsedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokingId === k.id}
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-[11px] h-8 px-2.5 font-medium"
                      >
                        {revokingId === k.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agent Integration Guide & Snippet */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-slate-100 space-y-4">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Quick Start: Authenticate with cURL or Python
          </h4>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Connect DMPilot directly to Claude, Claude Code, or terminal scripts. Pass your token in
          the <code className="text-emerald-300 font-mono">Authorization: Bearer dmp_live_...</code>{' '}
          or <code className="text-emerald-300 font-mono">x-api-key</code> header.
        </p>

        {/* Claude & MCP Connector Block */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Claude Code CLI & Claude Desktop (Model Context Protocol - MCP)</span>
          </div>
          <div className="bg-slate-950/90 rounded-xl p-3 font-mono text-xs text-emerald-300 overflow-x-auto border border-emerald-950">
            <pre className="text-[11px] leading-relaxed">
              {`# Connect DMPilot to Claude Code CLI with 1 command:
claude mcp add dmpilot -- npx -y @dmpilot/mcp --api-key dmp_live_YOUR_TOKEN

# Or for Claude Desktop (~/.claude/claude_desktop_config.json):
{
  "mcpServers": {
    "dmpilot": {
      "command": "npx",
      "args": ["-y", "@dmpilot/mcp"],
      "env": { "DMPILOT_API_KEY": "dmp_live_YOUR_TOKEN" }
    }
  }
}`}
            </pre>
          </div>
        </div>

        {/* Direct cURL / Terminal API Block */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300">Direct HTTP / cURL Commands</span>
          <div className="bg-slate-950/80 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
            <pre className="text-[11px] leading-relaxed">
              {`# 1. Check Connected Instagram Accounts & Webhook Status
curl -X GET "${apiUrl}/instagram" \\
  -H "Authorization: Bearer dmp_live_YOUR_TOKEN"

# 2. List Active Automation Campaigns
curl -X GET "${apiUrl}/campaigns" \\
  -H "Authorization: Bearer dmp_live_YOUR_TOKEN"

# 3. Publish Post or Reel via Agent
curl -X POST "${apiUrl}/content/publish" \\
  -H "Authorization: Bearer dmp_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"instagramAccountId":"...","mediaUrl":"https://...","caption":"..."}'`}
            </pre>
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Generate Personal Access Token</h3>
              <p className="text-xs text-slate-500">
                Create a scoped credential for autonomous bots and terminal scripts.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tokenName" className="text-xs font-semibold text-slate-700">
                  Token Name
                </Label>
                <Input
                  id="tokenName"
                  placeholder="e.g. Claude Code Agent, OpenClaw Bot"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiration" className="text-xs font-semibold text-slate-700">
                  Expiration
                </Label>
                <select
                  id="expiration"
                  value={expiresInDays || ''}
                  onChange={(e) =>
                    setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>1 Year</option>
                  <option value="">Never Expires</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !keyName.trim()}
                  className="text-xs font-semibold"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Generate Token
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
