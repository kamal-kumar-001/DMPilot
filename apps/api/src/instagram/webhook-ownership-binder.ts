/**
 * Provider-witnessed ownership proof for unresolved webhook identifiers.
 *
 * When strict resolution (primary columns + verified aliases) misses an
 * incoming comment webhook identifier, the payload's media id offers one
 * chance of provider-backed proof: Meta's permission model grants an
 * Instagram-Login token access only to data created by the app user who
 * granted it, so successfully reading the commented media with an account's
 * own token proves that account owns the media - and because Meta delivers
 * comment webhooks keyed by the media-owning professional account's
 * identifier, it proves the unresolved identifier belongs to that account
 * (in the other namespace).
 *
 * The proof is used ONLY to create a normal verified alias through
 * bindVerifiedIdentifier (source='webhook_media_proof'), which keeps every
 * bind-time conflict check. Zero proofs or multiple proofs bind nothing
 * (fail closed); API/permission errors are treated as "no proof", never as
 * a negative identity claim. Negative results are not cached across
 * processes, and attempts are capped per event to bound Meta API calls.
 */
import { ResolverPrisma, bindVerifiedIdentifier } from './webhook-account-resolver';

export interface OwnershipCandidate {
  id: string;
  instagramId: string;
  accessToken: string; // already decrypted
}

/**
 * Probe: fetch the media with the candidate's own token, requesting the
 * provider-returned `owner` field. Per the IG Media reference, `owner` ("the
 * Instagram user ID who created the media") is returned ONLY when the app
 * user making the query also created the media - otherwise `username` is
 * returned instead. A successful read alone is NOT ownership proof (several
 * media fields are public/readable via expansion); the proof is the
 * provider-returned immutable owner id. Any API error must resolve null.
 */
export type MediaProbe = (
  mediaId: string,
  accessToken: string,
) => Promise<{ id: string; ownerId?: string } | null>;

export interface OwnershipBindResult {
  bound: boolean;
  accountId?: string;
  warnings?: string[];
  reason?: 'no_proof' | 'multiple_proof' | 'bind_conflict' | 'no_candidates' | 'probe_skipped';
}

/**
 * Abuse bounding for ownership probes (Meta API calls).
 *
 * A signed Meta webhook can still carry an unlimited stream of hostile
 * comments, so probing must be bounded independent of per-event discipline:
 *
 *  - Pending/negative cache: key `${identifier}:${mediaId}` is SET NX with a
 *    short pending TTL before any probe. A concurrent or repeated event for
 *    the same key skips probing entirely (fail closed, event drops). On
 *    completion the key is rewritten with the outcome and the longer
 *    negative TTL, so repeated misses - and repeat events right after a
 *    successful bind - cost zero API calls.
 *  - Global budget: a fixed-window counter caps actual probe runs across
 *    ALL keys and ALL workers sharing the store, so a flood of unique
 *    media/identifier pairs cannot evade the per-key cache. Overshoot is
 *    bounded by the number of workers racing the counter within one window.
 *  - Store failure (e.g. Redis down) denies the probe: self-heal pauses and
 *    events drop exactly as they did before this feature existed.
 *  - No tokens, media content, or error payloads are stored or logged; the
 *    store holds only ids and outcome enums.
 */
export interface ProbeGuardStore {
  /** SET key value PX ttlMs NX -> true when this caller acquired the key. */
  setNxPx(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** SET key value PX ttlMs (overwrite + re-expire). */
  setPx(key: string, value: string, ttlMs: number): Promise<void>;
  /** INCR key, setting PX windowMs on first increment; returns the new count. */
  incrWithExpiry(key: string, windowMs: number): Promise<number>;
}

export interface ProbeGuardConfig {
  /** Max probe runs per window across all keys (global). */
  budgetPerWindow: number;
  windowMs: number;
  /** How long a completed outcome suppresses further probes for the key. */
  negativeTtlMs: number;
  /** How long an in-flight probe holds the key before it may be retried. */
  pendingTtlMs: number;
}

export const DEFAULT_PROBE_GUARD_CONFIG: ProbeGuardConfig = {
  budgetPerWindow: 30,
  windowMs: 60_000,
  negativeTtlMs: 15 * 60_000,
  pendingTtlMs: 60_000,
};

async function probeGuardAcquire(
  store: ProbeGuardStore,
  cfg: ProbeGuardConfig,
  key: string,
): Promise<boolean> {
  const windowKey = `wprobe:budget:${Math.floor(Date.now() / cfg.windowMs)}`;
  const count = await store.incrWithExpiry(windowKey, cfg.windowMs);
  if (count > cfg.budgetPerWindow) return false;
  return store.setNxPx(`wprobe:key:${key}`, 'pending', cfg.pendingTtlMs);
}

async function probeGuardComplete(
  store: ProbeGuardStore,
  cfg: ProbeGuardConfig,
  key: string,
  outcome: string,
): Promise<void> {
  await store.setPx(`wprobe:key:${key}`, outcome, cfg.negativeTtlMs).catch(() => undefined);
}

export async function bindViaMediaOwnershipProof(
  prisma: ResolverPrisma,
  params: {
    identifier: string;
    mediaId: string;
    candidates: OwnershipCandidate[];
    probe: MediaProbe;
    note?: string;
    /** When provided, bounds Meta API calls (see ProbeGuardStore docs). */
    guard?: { store: ProbeGuardStore; config?: ProbeGuardConfig };
  },
): Promise<OwnershipBindResult> {
  const { identifier, mediaId, candidates, probe } = params;
  if (candidates.length === 0) return { bound: false, reason: 'no_candidates' };

  const cfg = params.guard?.config ?? DEFAULT_PROBE_GUARD_CONFIG;
  const guardKey = `${identifier}:${mediaId}`;
  const guarded = Boolean(params.guard);
  if (params.guard) {
    let allowed = false;
    try {
      allowed = await probeGuardAcquire(params.guard.store, cfg, guardKey);
    } catch {
      allowed = false; // store failure = fail closed, no probe
    }
    if (!allowed) return { bound: false, reason: 'probe_skipped' };
  }

  const finish = async (result: OwnershipBindResult): Promise<OwnershipBindResult> => {
    if (guarded && params.guard) {
      const outcome = result.bound ? 'bound' : (result.reason ?? 'no_proof');
      await probeGuardComplete(params.guard.store, cfg, guardKey, outcome);
    }
    return result;
  };

  // Probe sequentially: at most one call per connected account per event,
  // and stop early on a second proof (already ambiguous).
  const winners: OwnershipCandidate[] = [];
  for (const candidate of candidates) {
    const media = await probe(mediaId, candidate.accessToken).catch(() => null);
    // Exclusive proof: the provider returned the immutable owner id AND it
    // matches this candidate's stored (authenticated) account id, in the
    // same namespace as that account's login product.
    if (media?.ownerId && media.ownerId === candidate.instagramId) {
      winners.push(candidate);
      if (winners.length > 1) break;
    }
  }

  if (winners.length === 0) return finish({ bound: false, reason: 'no_proof' });
  if (winners.length > 1) return finish({ bound: false, reason: 'multiple_proof' });

  try {
    const { warnings } = await bindVerifiedIdentifier(prisma, {
      accountId: winners[0].id,
      identifier,
      source: 'webhook_media_proof',
      note:
        params.note ??
        `Media ${mediaId} readable only by account ${winners[0].id} token per Meta permission model`,
    });
    return finish({ bound: true, accountId: winners[0].id, warnings });
  } catch {
    return finish({ bound: false, reason: 'bind_conflict' });
  }
}
