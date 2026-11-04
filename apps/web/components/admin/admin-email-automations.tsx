'use client';
import * as React from 'react';
import { Mail, Plus, Save, Eye, Loader2, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@dmpilot/ui';
type Rule = {
  id?: string;
  name: string;
  trigger: string;
  daysBefore: number;
  subject: string;
  body: string;
  status: string;
};
const blank: Rule = {
  name: 'Membership reminder',
  trigger: 'MEMBERSHIP_EXPIRING',
  daysBefore: 5,
  subject: 'Your DMPilot {{plan}} plan expires soon',
  body: 'Hello {{name}},\n\nYour {{plan}} membership expires on {{expiresAt}} (in {{daysLeft}} days). Review your membership in DMPilot Settings > Billing.',
  status: 'DRAFT',
};
export function AdminEmailAutomations() {
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [rule, setRule] = React.useState<Rule>(blank);
  const [revision, setRevision] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [preview, setPreview] = React.useState<any>(null);
  const [selected, setSelected] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<any>('/admin/email-automations');
      setRules(data.rules);
      setRevision(data.revision);
      if (data.rules[0]) setRule(data.rules[0]);
      setDirty(false);
      setPreview(null);
    } catch {
      setError(
        'Email Automations could not load. The backend may still need deployment. No sending is enabled.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const update = (next: Partial<Rule>) => {
    setRule((r) => ({ ...r, ...next }));
    setDirty(true);
    setPreview(null);
  };
  const choose = (next: Rule) => {
    if (dirty && !window.confirm('Discard unsaved template changes?')) return;
    setRule(next);
    setDirty(false);
    setPreview(null);
  };
  const save = async () => {
    setBusy('save');
    try {
      const data = await apiRequest<any>('/admin/email-automations/drafts', {
        method: 'POST',
        body: JSON.stringify({ rule, revision }),
      });
      setRules(data.rules);
      setRevision(data.revision);
      setRule(data.rules.find((r: Rule) => r.id === rule.id) || data.rules[data.rules.length - 1]);
      setDirty(false);
      toast.success('Draft saved. Sending remains disabled.');
    } catch (e) {
      toast.error('Could not save draft. Reload if another admin has changed it.');
    } finally {
      setBusy('');
    }
  };
  const inspect = async (page = 1) => {
    setBusy('preview');
    try {
      const data = await apiRequest<any>('/admin/email-automations/preview', {
        method: 'POST',
        body: JSON.stringify({ rule, page }),
      });
      setPreview(data);
      setSelected(0);
    } catch {
      toast.error('Could not load recipient preview. No emails were sent.');
    } finally {
      setBusy('');
    }
  };
  const field =
    'w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  return (
    <section className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-600" />
            Email Automations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Prepare creator emails and check who qualifies before any sending is enabled.
          </p>
        </div>
        <span className="inline-flex gap-2 items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900">
          <Lock className="h-3 w-3" />
          Sending disabled
        </span>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Draft workspace only. Saving or previewing does not queue or send emails. Existing
        verification, password-reset and receipt emails are unchanged.
      </div>
      {loading ? (
        <p role="status" className="flex gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading email drafts...
        </p>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-800">
          {error}
          <button onClick={load} className="ml-3 underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <button
                onClick={() => choose({ ...blank })}
                className="w-full rounded-lg border border-emerald-200 text-emerald-700 p-2 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New draft
              </button>
              {rules.map((r) => (
                <button
                  key={r.id}
                  onClick={() => choose(r)}
                  className={`w-full text-left rounded-lg p-3 border ${r.id === rule.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100'}`}
                >
                  <span className="text-sm font-semibold block break-words">{r.name}</span>
                  <span className="text-xs text-slate-500">
                    Draft · expires within {r.daysBefore} days
                  </span>
                </button>
              ))}
            </aside>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 min-w-0">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">Template & recipient rule</h3>
                <span className="text-xs text-slate-500">
                  {dirty ? 'Unsaved changes' : 'Draft only'}
                </span>
              </div>
              <label className="block text-sm font-medium">
                Automation name
                <input
                  className={field + ' mt-1'}
                  value={rule.name}
                  maxLength={120}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Recipient trigger
                  <select
                    className={field + ' mt-1'}
                    value={rule.trigger}
                    onChange={(e) => update({ trigger: e.target.value })}
                  >
                    <option value="MEMBERSHIP_EXPIRING">Membership expiring</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Expiry window (days)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className={field + ' mt-1'}
                    value={rule.daysBefore}
                    onChange={(e) => update({ daysBefore: Number(e.target.value) })}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Verified creators on active Pro or Agency plans. Excludes Free, expired, unverified
                and deletion-request accounts. More trigger types can be added after their rules are
                defined.
              </p>
              <label className="block text-sm font-medium">
                Email subject
                <input
                  className={field + ' mt-1'}
                  value={rule.subject}
                  maxLength={200}
                  onChange={(e) => update({ subject: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Email body (plain text)
                <textarea
                  rows={8}
                  className={field + ' mt-1'}
                  value={rule.body}
                  maxLength={10000}
                  onChange={(e) => update({ body: e.target.value })}
                />
              </label>
              <p className="text-xs text-slate-500 break-words">
                Placeholders: {'{{name}} · {{plan}} · {{expiresAt}} · {{daysLeft}}'}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={!!busy}
                  onClick={save}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {busy === 'save' ? 'Saving...' : 'Save draft'}
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => inspect()}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  {busy === 'preview' ? 'Checking...' : 'Preview recipients'}
                </button>
              </div>
            </div>
          </div>
          {preview && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <h3 className="font-semibold">Recipient preview ({preview.total})</h3>
              <p className="text-xs text-slate-500">
                Live snapshot: {new Date(preview.asOf).toLocaleString()}. {preview.criteria} No
                recipients are queued. Due time is hypothetical, not a scheduled send.
              </p>
              {!preview.total ? (
                <p className="text-sm py-6 text-slate-500">
                  No creators qualify for this rule right now.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="py-2">Creator</th>
                          <th>Why this email</th>
                          <th>Would be due</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.recipients.map((r: any, i: number) => (
                          <tr
                            key={r.userId}
                            className={`border-b ${selected === i ? 'bg-emerald-50' : ''}`}
                          >
                            <td className="py-3 pr-3">
                              <button
                                onClick={() => setSelected(i)}
                                className="text-emerald-700 underline text-left"
                              >
                                {r.name || 'Creator'}
                                <span className="block">{r.email}</span>
                              </button>
                            </td>
                            <td className="pr-3">{r.reason}</td>
                            <td className="pr-3">{new Date(r.wouldBeDueAt).toLocaleString()}</td>
                            <td>Preview only</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3 items-center text-xs">
                    <button
                      disabled={preview.page === 1 || !!busy}
                      onClick={() => inspect(preview.page - 1)}
                      className="border rounded px-3 py-2 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>
                      Page {preview.page} of {Math.max(1, Math.ceil(preview.total / 25))}
                    </span>
                    <button
                      disabled={preview.page * 25 >= preview.total || !!busy}
                      onClick={() => inspect(preview.page + 1)}
                      className="border rounded px-3 py-2 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                  {preview.recipients[selected] && (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-3">
                      <p className="text-xs text-slate-500">
                        Personalized preview for {preview.recipients[selected].email}
                      </p>
                      <h4 className="font-semibold break-words">
                        {preview.recipients[selected].subject}
                      </h4>
                      <p className="whitespace-pre-wrap break-words">
                        {preview.recipients[selected].body}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
