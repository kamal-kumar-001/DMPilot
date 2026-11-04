'use client';
import * as React from 'react';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@dmpilot/ui';
export function AdminServiceAccess() {
  const [rows, setRows] = React.useState<any[]>([]),
    [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState(false),
    [busy, setBusy] = React.useState('');
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await apiRequest<any[]>('/admin/service-access'));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const revoke = async (id: string) => {
    if (
      !window.confirm(
        'Revoke this email-observed access? Existing paid subscriptions are not changed.',
      )
    )
      return;
    setBusy(id);
    try {
      await apiRequest(`/admin/service-access/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
      });
      toast.success('Service access revoked');
      await load();
    } catch {
      toast.error('Revocation not confirmed. Try again.');
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="space-y-4 min-w-0">
      <h2 className="text-lg font-bold">Email-observed service access</h2>
      <p className="text-sm text-slate-600">
        These grants are revocable subscription access, not bank-verified payments. Invoices and
        payment receipts remain separate. The original monthly or annual period is not extended by
        repeat deliveries.
      </p>
      <button onClick={load} className="rounded border px-3 py-2 text-sm">
        Refresh grants
      </button>
      {loading ? (
        <p role="status">Loading grants...</p>
      ) : error ? (
        <p role="alert">Could not load grants. Backend deployment or setup may be required.</p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500">No email-observed grants recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead>
              <tr>
                <th className="p-2">Creator / order</th>
                <th>Access</th>
                <th>Plan period ends</th>
                <th>Evidence</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.grant.grantId} className="border-t">
                  <td className="p-2 break-all">
                    {r.userId}
                    <br />
                    {r.grant.orderId}
                  </td>
                  <td>
                    {r.plan}
                    <br />
                    {r.grant.state}
                  </td>
                  <td>{new Date(r.periodEnd).toLocaleString()}</td>
                  <td>
                    Mailbox observed
                    <br />
                    Not bank-verified
                  </td>
                  <td>
                    <button
                      disabled={!!busy || r.grant.state === 'REVOKED'}
                      onClick={() => revoke(r.grant.grantId)}
                      className="border border-red-200 text-red-700 rounded px-3 py-2 disabled:opacity-40"
                    >
                      {busy === r.grant.grantId ? 'Revoking...' : 'Revoke access'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
