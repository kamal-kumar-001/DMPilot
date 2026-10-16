'use client';

import * as React from 'react';
import { apiRequest } from '@/lib/api-client';
import { toast } from '@autodm/ui';
import { Loader2, Mail, CheckCircle } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

export function AdminSupport() {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await apiRequest<Ticket[]>('/admin/support-tickets');
      setTickets(res || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTickets();
  }, []);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await apiRequest(`/admin/support-tickets/${id}/resolve`, {
        method: 'PATCH',
      });
      toast.success('Ticket marked as resolved');
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'RESOLVED' as const } : t)),
      );
    } catch {
      toast.error('Failed to resolve support ticket');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 text-rose-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading support tickets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tickets.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-3 shadow-xs">
          <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
            <Mail className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">All Caught Up!</h3>
          <p className="text-xs text-slate-500">
            No support tickets have been submitted by creators yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`bg-white border rounded-2xl p-5 md:p-6 shadow-xs transition-all duration-200 ${
                ticket.status === 'RESOLVED'
                  ? 'border-slate-200 opacity-75'
                  : 'border-slate-300 shadow-sm'
              }`}
            >
              {/* Top Row: User Meta & Status */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {ticket.subject}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        ticket.status === 'RESOLVED'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-rose-50 border border-rose-200 text-rose-700'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    From:{' '}
                    <strong className="text-slate-900 font-semibold">
                      {ticket.user.name || 'Creator'} ({ticket.user.email})
                    </strong>{' '}
                    • {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                </div>

                {ticket.status === 'OPEN' && (
                  <button
                    onClick={() => handleResolve(ticket.id)}
                    disabled={resolvingId === ticket.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                  >
                    {resolvingId === ticket.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    Resolve
                  </button>
                )}
              </div>

              {/* Message Content Container (Clean Light Theme) */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {ticket.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
