'use client';
import * as React from 'react';
import { Mail, Plus, Save, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@dmpilot/ui';
import Loading from '@/app/loading';
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
  const [backendReady, setBackendReady] = React.useState(false);
  const [reviewError, setReviewError] = React.useState('');
  const [transport, setTransport] = React.useState<any>(null);
  const [review, setReview] = React.useState<any>(null);
  const [history, setHistory] = React.useState<any>(null);
  const loadHistory = async (page = 1) => {
    try {
      setHistory(await apiRequest<any>(`/admin/email-automations/history?page=${page}`));
    } catch {
      toast.error('Could not load send history');
    }
  };
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
      setBackendReady(data.sendingEnabled === true && typeof data.transport?.ready === 'boolean');
      setTransport(data.transport);
      setRevision(data.revision);
      if (data.rules[0]) setRule(data.rules[0]);
      setDirty(false);
      setPreview(null);
      setReview(null);
      if (data.sendingEnabled === true && data.transport) void loadHistory();
    } catch {
      setError(
        'Email Automations could not load. The backend may still need deployment. No sending settings were changed.',
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
    setReview(null);
  };
  const choose = (next: Rule) => {
    if (dirty && !window.confirm('Discard unsaved template changes?')) return;
    setRule(next);
    setReview(null);
    setDirty(false);
    setPreview(null);
  };
  const save = async () => {
    setBusy('save');
    try {
      const data = await apiRequest<any>('/admin/email-automations/drafts', {
        method: 'POST',
        body: JSON.stringify({ rule: { ...rule, status: 'DRAFT' }, revision }),
      });
      setRules(data.rules);
      setRevision(data.revision);
      setRule(data.rules.find((r: Rule) => r.id === rule.id) || data.rules[data.rules.length - 1]);
      setDirty(false);
      setReview(null);
      toast.success('Saved');
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
  React.useEffect(() => {
    let cancelled = false;
    setReview(null);
    setReviewError('');
    if (!backendReady || !transport?.ready || dirty || !rule.id || rule.status === 'ACTIVE') return;
    apiRequest<any>('/admin/email-automations/review', {
      method: 'POST',
      body: JSON.stringify({ id: rule.id, revision }),
    })
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch(() => {
        if (!cancelled)
          setReviewError(
            'Could not load the saved email and recipients. Reload this workspace to try again.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [backendReady, transport?.ready, dirty, rule.id, rule.status, revision]);
  const changeStatus = async (status: string) => {
    setBusy('status');
    try {
      const data = await apiRequest<any>('/admin/email-automations/status', {
        method: 'POST',
        body: JSON.stringify({ id: rule.id, revision, status, reviewToken: review?.reviewToken }),
      });
      setRules(data.rules);
      setRevision(data.revision);
      setRule(data.rules.find((r: Rule) => r.id === rule.id));
      setReview(null);
      toast.success(status === 'ACTIVE' ? 'Automation enabled' : 'Automation paused');
      void loadHistory();
    } catch (e: any) {
      toast.error(e.message || 'Could not update status. Review again.');
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
            Create membership reminders, review recipients, then enable each rule.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold">
          {rules.filter((r) => r.status === 'ACTIVE').length} active rules
        </span>
      </div>
      {!loading && !error && !backendReady && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          The page is updated, but the backend is still on the draft-only version. Sending controls
          will be ready after the DMPilot backend update. Your saved rule has not been enabled.
          <button onClick={load} className="ml-3 underline font-semibold">
            Check again
          </button>
        </div>
      )}
      {transport && !transport.ready && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {transport.message}
        </p>
      )}
      {loading ? (
        <Loading />
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
                    {r.status === 'ACTIVE' ? 'Active' : r.status === 'PAUSED' ? 'Paused' : 'Draft'}{' '}
                    · expires within {r.daysBefore} days
                  </span>
                </button>
              ))}
            </aside>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 min-w-0">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">Template & recipient rule</h3>
                <span className="text-xs text-slate-500">
                  {dirty ? 'Unsaved changes - saving pauses active rules' : rule.status}
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
                  {busy === 'save' ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => inspect()}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  {busy === 'preview' ? 'Checking...' : 'Preview recipients'}
                </button>
                {rule.status === 'ACTIVE' ? (
                  <button
                    disabled={!!busy}
                    onClick={() => changeStatus('PAUSED')}
                    className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Pause rule
                  </button>
                ) : null}
                {dirty && (
                  <p className="text-xs text-slate-500 self-center">
                    Save changes to enable this version.
                  </p>
                )}
                {!dirty &&
                  rule.id &&
                  backendReady &&
                  transport?.ready &&
                  rule.status !== 'ACTIVE' &&
                  !review &&
                  !reviewError && (
                    <p role="status" className="text-xs text-slate-500 self-center">
                      Loading saved email and recipients...
                    </p>
                  )}
              </div>
            </div>
          </div>
          {reviewError && (
            <p role="alert" className="text-sm text-red-700">
              {reviewError}
              <button onClick={load} className="ml-3 underline">
                Reload workspace
              </button>
            </p>
          )}
          {review && (
            <div
              className="rounded-xl border border-emerald-300 bg-white p-5 space-y-4"
              role="region"
              aria-label="Review activation"
            >
              <h3 className="font-semibold">{review.rule.name}</h3>
              <p className="text-sm">From: {review.from}</p>
              <p className="text-sm">{review.criteria}</p>
              <p className="text-sm">{review.ongoing}</p>
              <p className="text-sm font-semibold">
                {review.total} creators qualify now. Preview updates as memberships change.
              </p>
              <div className="bg-slate-50 p-4 rounded-lg text-sm">
                <strong>{review.rule.subject}</strong>
                <p className="whitespace-pre-wrap mt-3">{review.rule.body}</p>
              </div>
              <ul className="text-sm space-y-2">
                {review.recipients.map((r: any) => (
                  <li key={r.userId}>
                    {r.email} - {r.reason}
                    <details className="mt-1">
                      <summary>Personalized email</summary>
                      <strong>{r.subject}</strong>
                      <p className="whitespace-pre-wrap">{r.body}</p>
                    </details>
                  </li>
                ))}
              </ul>
              {review.total > 25 && (
                <p className="text-sm">
                  First 25 shown. Use Preview recipients to inspect all pages before enabling.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Membership notices only. Keep advertising out of this rule. Pause stops future work;
                a message already being sent cannot be recalled.
              </p>
              <button
                disabled={!!busy}
                onClick={() => changeStatus('ACTIVE')}
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
              >
                Enable automation
              </button>
            </div>
          )}
          {preview && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <h3 className="font-semibold">Recipient preview ({preview.total})</h3>
              <p className="text-xs text-slate-500">
                Live snapshot: {new Date(preview.asOf).toLocaleString()}. {preview.criteria} This
                preview does not send emails. Active rules are checked about once a minute. Due time
                is when the membership enters the reminder window.
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
                          <th>Due from</th>
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex justify-between">
              <h3 className="font-semibold">Send history</h3>
              <button className="text-sm underline" onClick={() => loadHistory(history?.page || 1)}>
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Accepted means the email provider accepted it, not confirmed inbox delivery. Unknown
              or interrupted attempts are not automatically retried.
            </p>
            {!history?.rows?.length ? (
              <p className="text-sm text-slate-500">No send attempts yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-xs text-left">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Rule / recipient</th>
                        <th>Status</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-3 pr-3">{new Date(r.attemptedAt).toLocaleString()}</td>
                          <td className="pr-3">
                            {r.ruleName}
                            <br />
                            {r.email}
                          </td>
                          <td className="pr-3">
                            {r.status === 'SENDING' ? 'Sending / outcome pending' : r.status}
                            <br />
                            {r.detail}
                          </td>
                          <td>
                            <details>
                              <summary>{r.subject}</summary>
                              <p className="whitespace-pre-wrap">{r.body}</p>
                              {r.reference && <p>Provider reference: {r.reference}</p>}
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3 items-center text-xs">
                  <button
                    disabled={history.page === 1}
                    onClick={() => loadHistory(history.page - 1)}
                    className="border rounded px-3 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {history.page} of {Math.ceil(history.total / 25)}
                  </span>
                  <button
                    disabled={history.page * 25 >= history.total}
                    onClick={() => loadHistory(history.page + 1)}
                    className="border rounded px-3 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
