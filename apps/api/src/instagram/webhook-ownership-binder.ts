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
  reason?:
    | 'no_proof'
    | 'multiple_proof'
    | 'bind_conflict'
    | 'no_candidates'
    | 'probe_skipped'
    | 'budget_exceeded'
    | 'deadline';
}

/**
 * Abuse bounding for ownership probes (Meta API calls).
 *
 * A signed Meta webhook can still carry an unlimited stream of hostile
 * comments, so probing is bounded independent of per-event discipline:
 *
 *  - Pending/negative cache: key `wprobe:key:{identifier}:{mediaId}` is
 *    SET NX before any Meta call. A repeated or concurrent event for the
 *    same key skips probing and fails closed (the event drops, exactly as
 *    it did before this feature existed). The pending lock outlives any
 *    in-flight scan: pendingTtlMs >= eventDeadlineMs + perCallTimeoutMs is
 *    enforced by validateProbeGuardConfig, so a lock never expires while a
 *    scan can still bind. On completion the key is rewritten with the
 *    outcome enum: definitive outcomes (bound, no_proof, multiple_proof,
 *    bind_conflict) are cached for negativeTtlMs; transient outcomes
 *    (budget_exceeded, deadline) only for pendingTtlMs so a later event
 *    retries sooner.
 *  - Hard global call budget: every actual Meta API call first increments
 *    a fixed-window counter atomically (single Lua INCR+PEXPIRE); when the
 *    count exceeds maxCallsPerWindow the scan stops and fails closed. The
 *    budget counts calls, not probe runs, so a flood of unique keys or a
 *    large candidate list cannot multiply calls past it. Overshoot is
 *    bounded by the number of workers racing the counter in one window.
 *  - Per-event bounds: at most maxCandidatesPerEvent accounts are probed
 *    per event, each call is wrapped in a perCallTimeoutMs hard timeout,
 *    and the whole scan stops at eventDeadlineMs.
 *  - Store failure denies the probe (fail closed, zero Meta calls). No
 *    tokens, media content, or error payloads are stored or logged; the
 *    store holds only ids and outcome enums.
 */
export interface ProbeGuardStore {
  /** SET key value PX ttlMs NX -> true when this caller acquired the key. */
  setNxPx(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** SET key value PX ttlMs (overwrite + re-expire). */
  setPx(key: string, value: string, ttlMs: number): Promise<void>;
  /** Atomic INCR key with PEXPIRE windowMs applied on first increment. */
  incrWithExpiry(key: string, windowMs: number): Promise<number>;
}

export interface ProbeGuardConfig {
  /** Hard budget of actual Meta API calls per window, global across workers. */
  maxCallsPerWindow: number;
  windowMs: number;
  /** Cache TTL for definitive outcomes (bound/no_proof/multiple_proof/bind_conflict). */
  negativeTtlMs: number;
  /** Lock TTL; must exceed eventDeadlineMs + perCallTimeoutMs. */
  pendingTtlMs: number;
  /** Max wall-clock time for one event's scan. */
  eventDeadlineMs: number;
  /** Hard timeout wrapping each individual Meta call. */
  perCallTimeoutMs: number;
  /** Max accounts probed per event. */
  maxCandidatesPerEvent: number;
}

export const DEFAULT_PROBE_GUARD_CONFIG: ProbeGuardConfig = {
  maxCallsPerWindow: 60,
  windowMs: 60_000,
  negativeTtlMs: 15 * 60_000,
  pendingTtlMs: 120_000,
  eventDeadlineMs: 45_000,
  perCallTimeoutMs: 10_000,
  maxCandidatesPerEvent: 10,
};

const DEFINITIVE_OUTCOMES = new Set(['bound', 'no_proof', 'multiple_proof', 'bind_conflict']);

/** Coerce raw (env-provided) values into a safe config; invalid values fall back to defaults. */
export function validateProbeGuardConfig(
  raw: Partial<Record<keyof ProbeGuardConfig, unknown>>,
): ProbeGuardConfig {
  const pick = (v: unknown, dflt: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : dflt;
  const cfg: ProbeGuardConfig = {
    maxCallsPerWindow: pick(raw.maxCallsPerWindow, DEFAULT_PROBE_GUARD_CONFIG.maxCallsPerWindow),
    windowMs: pick(raw.windowMs, DEFAULT_PROBE_GUARD_CONFIG.windowMs),
    negativeTtlMs: pick(raw.negativeTtlMs, DEFAULT_PROBE_GUARD_CONFIG.negativeTtlMs),
    pendingTtlMs: pick(raw.pendingTtlMs, DEFAULT_PROBE_GUARD_CONFIG.pendingTtlMs),
    eventDeadlineMs: pick(raw.eventDeadlineMs, DEFAULT_PROBE_GUARD_CONFIG.eventDeadlineMs),
    perCallTimeoutMs: pick(raw.perCallTimeoutMs, DEFAULT_PROBE_GUARD_CONFIG.perCallTimeoutMs),
    maxCandidatesPerEvent: pick(
      raw.maxCandidatesPerEvent,
      DEFAULT_PROBE_GUARD_CONFIG.maxCandidatesPerEvent,
    ),
  };
  // The pending lock must outlive any scan that can still bind.
  const minPending = cfg.eventDeadlineMs + cfg.perCallTimeoutMs + 5_000;
  if (cfg.pendingTtlMs < minPending) cfg.pendingTtlMs = minPending;
  return cfg;
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
    guard?: { store: ProbeGuardStore; config?: Partial<ProbeGuardConfig> };
  },
): Promise<OwnershipBindResult> {
  const { identifier, mediaId, candidates, probe } = params;
  if (candidates.length === 0) return { bound: false, reason: 'no_candidates' };

  const cfg = validateProbeGuardConfig(params.guard?.config ?? {});
  const guarded = Boolean(params.guard);
  const guardKey = `wprobe:key:${identifier}:${mediaId}`;
  const budgetKey = `wprobe:calls:${Math.floor(Date.now() / cfg.windowMs)}`;

  if (params.guard) {
    let acquired = false;
    try {
      acquired = await params.guard.store.setNxPx(guardKey, 'pending', cfg.pendingTtlMs);
    } catch {
      acquired = false; // store failure = fail closed, no probe
    }
    if (!acquired) return { bound: false, reason: 'probe_skipped' };
  }

  let outcome:
    'bound' | 'no_proof' | 'multiple_proof' | 'bind_conflict' | 'budget_exceeded' | 'deadline' =
    'no_proof';
  let boundAccountId: string | undefined;
  let bindWarnings: string[] | undefined;
  const deadline = Date.now() + cfg.eventDeadlineMs;

  const winners: OwnershipCandidate[] = [];
  const scan = candidates.slice(0, cfg.maxCandidatesPerEvent);
  for (const candidate of scan) {
    if (Date.now() > deadline) {
      outcome = 'deadline';
      break;
    }
    if (params.guard) {
      let calls = 0;
      try {
        calls = await params.guard.store.incrWithExpiry(budgetKey, cfg.windowMs);
      } catch {
        outcome = 'budget_exceeded'; // store failure mid-scan = fail closed
        break;
      }
      if (calls > cfg.maxCallsPerWindow) {
        outcome = 'budget_exceeded';
        break;
      }
    }
    const media = await Promise.race([
      probe(mediaId, candidate.accessToken).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), cfg.perCallTimeoutMs)),
    ]);
    // Exclusive proof: the provider returned the immutable owner id AND it
    // matches this candidate's stored (authenticated) account id, in the
    // same namespace as that account's login product.
    if (media?.ownerId && media.ownerId === candidate.instagramId) {
      winners.push(candidate);
      if (winners.length > 1) break;
    }
  }

  if (outcome === 'no_proof') {
    if (winners.length > 1) {
      outcome = 'multiple_proof';
    } else if (winners.length === 1) {
      try {
        const { warnings } = await bindVerifiedIdentifier(prisma, {
          accountId: winners[0].id,
          identifier,
          source: 'webhook_media_proof',
          note:
            params.note ??
            `Media ${mediaId} readable only by account ${winners[0].id} token per Meta permission model`,
        });
        outcome = 'bound';
        boundAccountId = winners[0].id;
        bindWarnings = warnings;
      } catch {
        outcome = 'bind_conflict';
      }
    }
  }

  if (guarded && params.guard) {
    const ttl = DEFINITIVE_OUTCOMES.has(outcome) ? cfg.negativeTtlMs : cfg.pendingTtlMs;
    await params.guard.store.setPx(guardKey, outcome, ttl).catch(() => undefined);
  }
  return {
    bound: outcome === 'bound',
    accountId: boundAccountId,
    warnings: bindWarnings,
    reason: outcome === 'bound' ? undefined : outcome,
  };
}
