// Saves the billing form while the user is on the checkout page, so a refresh does not wipe it.
// Stored per signed-in user in this browser only. It never holds passwords, card data or
// anything from the payment gateway.
//
// When the user is sent to the payment gateway we also store a small "pending" marker
// (plan, cycle, start time, invoice ids that already existed). The draft is cleared only when
// the API lists a NEW paid invoice for that same plan and cycle that appeared after the marker
// was made. Invoices are written server-side from the verified payment webhook, so a forged
// "?payment=success" URL, a failed or abandoned payment, or an already-paid plan does not clear it.

export interface CheckoutDraft {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
  acceptConsent: boolean;
}

const PREFIX = 'dmpilot:checkout-draft:v1:';
const FIELDS: (keyof CheckoutDraft)[] = [
  'name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'pincode',
  'country',
  'gstin',
  'acceptConsent',
];

const keyFor = (userId: string) => `${PREFIX}${userId}`;

export function loadCheckoutDraft(userId?: string | null): Partial<CheckoutDraft> | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const out: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const v = parsed[f];
      if (f === 'acceptConsent' ? typeof v === 'boolean' : typeof v === 'string') out[f] = v;
    }
    return out as Partial<CheckoutDraft>;
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(userId: string | null | undefined, data: CheckoutDraft): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    const safe: Record<string, unknown> = {};
    for (const f of FIELDS) safe[f] = data[f];
    window.localStorage.setItem(keyFor(userId), JSON.stringify(safe));
  } catch {
    // storage full or blocked: the form still works, it just is not saved
  }
}

export function clearCheckoutDraft(userId?: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

export interface PendingCheckout {
  plan: string;
  cycle: string;
  startedAt: number; // ms since epoch
  baselineInvoiceIds: string[];
}

export interface InvoiceLike {
  id?: string;
  plan?: string;
  cycle?: string;
  status?: string;
  createdAt?: string;
}

const PENDING_PREFIX = 'dmpilot:checkout-pending:v1:';
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function markCheckoutPending(
  userId: string | null | undefined,
  pending: PendingCheckout,
): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_PREFIX + userId, JSON.stringify(pending));
  } catch {
    // ignore
  }
}

export function readCheckoutPending(userId?: string | null): PendingCheckout | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PREFIX + userId);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      !p ||
      typeof p.plan !== 'string' ||
      typeof p.cycle !== 'string' ||
      typeof p.startedAt !== 'number' ||
      !Array.isArray(p.baselineInvoiceIds)
    ) {
      return null;
    }
    if (Date.now() - p.startedAt > PENDING_MAX_AGE_MS) return null;
    return p as PendingCheckout;
  } catch {
    return null;
  }
}

export function clearCheckoutPending(userId?: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_PREFIX + userId);
  } catch {
    // ignore
  }
}

/** True only when a new paid invoice for the pending plan and cycle exists. */
export function isCheckoutVerified(
  pending: PendingCheckout | null,
  invoices: InvoiceLike[] | null | undefined,
): boolean {
  if (!pending || !Array.isArray(invoices)) return false;
  const known = new Set(pending.baselineInvoiceIds);
  return invoices.some((inv) => {
    if (!inv || typeof inv.id !== 'string' || known.has(inv.id)) return false;
    if (String(inv.status || '').toUpperCase() !== 'PAID') return false;
    if (String(inv.plan || '').toUpperCase() !== pending.plan.toUpperCase()) return false;
    if (String(inv.cycle || '').toUpperCase() !== pending.cycle.toUpperCase()) return false;
    const created = inv.createdAt ? Date.parse(inv.createdAt) : NaN;
    return Number.isFinite(created) && created >= pending.startedAt - CLOCK_SKEW_MS;
  });
}

/** Clear the saved form (and the pending marker) once the current checkout is verified paid. */
export function clearDraftIfVerified(
  userId: string | null | undefined,
  invoices: InvoiceLike[] | null | undefined,
): boolean {
  const pending = readCheckoutPending(userId);
  if (!isCheckoutVerified(pending, invoices)) return false;
  clearCheckoutDraft(userId);
  clearCheckoutPending(userId);
  return true;
}
