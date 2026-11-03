// Saves the billing form while the user is on the checkout page, so a refresh does not wipe it.
// Stored per signed-in user in this browser only. It never holds passwords, card data or
// anything from the payment gateway. It is cleared once the account shows a paid plan
// (verified by the API after payment), not just because a "payment=success" URL appeared.

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
