/**
 * CANDIDATE — source-only, not deployed, gated OFF by default
 * (KEEPCUE_FORWARD_ENABLED=1 to enable).
 *
 * DMPilot side of the KeepCue DM bridge: the upstream Meta-verifying
 * forwarder. Events arrive via the Meta webhook pipeline, which already
 * verifies X-Hub-Signature-256 fail-closed (webhook.controller.ts), so the
 * sender IGSID here is a Meta-verified sender id, not user-typed text.
 *
 * This module is pure (no Nest imports) so it is unit-testable with
 * node --experimental-strip-types, matching apps/api/test conventions.
 *
 * Bridge contract (KeepCue /api/bridge/dm-ingest, see dm-link.ts):
 *   POST raw JSON body (signed bytes = exact bytes sent)
 *   headers: x-bridge-timestamp (ms), x-bridge-signature (hex HMAC-SHA256)
 *   signature over: `${timestamp}.${appId}.${recipientIgId}.${igsid}.${messageId}.${sha256(rawBody)}`
 *   200 (ingested/duplicate/stale_attempt) -> done, delete outbox row
 *   429 (rate_limited) / network / 5xx    -> retry with backoff
 *   409 (terminated/no_active_link/...)   -> durable negative, dead-letter, NO retry
 *   401                                    -> bridge config error, alert, no retry
 */
import crypto from 'node:crypto';

export interface KeepcueForwardConfig {
  enabled: boolean;
  bridgeUrl: string;
  appId: string;
  recipientIgIds: string[];
  secret: string | null;
}

export function readKeepcueForwardConfig(
  env: NodeJS.ProcessEnv = process.env,
): KeepcueForwardConfig {
  const recipientIgIds = (env.KEEPCUE_FORWARD_RECIPIENT_IGIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    enabled: env.KEEPCUE_FORWARD_ENABLED === '1',
    bridgeUrl: (env.KEEPCUE_BRIDGE_URL || '').trim(),
    appId: (env.KEEPCUE_FORWARD_APP_ID || env.META_APP_ID || '').trim(),
    recipientIgIds,
    secret: (env.KEEPCUE_BRIDGE_SECRET || '').trim() || null,
  };
}

/** Mirrors KeepCue's generateLinkCode alphabet/format exactly. */
export const LINK_CODE_RE = /^KQ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export type ForwardableDm = { kind: 'code'; code: string } | { kind: 'content'; url: string };

/**
 * A DM forwards to KeepCue only when it is either a one-time link code
 * (whole message text) or carries shared media with a URL. Everything else
 * (chat, images without links, story replies) is never forwarded.
 */
export function detectForwardableDm(input: {
  text?: string;
  sharedMedia?: { url?: string } | null;
}): ForwardableDm | null {
  const text = (input.text || '').trim();
  if (LINK_CODE_RE.test(text)) return { kind: 'code', code: text };
  const url = input.sharedMedia?.url?.trim();
  if (url && url.length <= 8192) return { kind: 'content', url };
  return null;
}

/**
 * The exact body bytes that get signed AND sent. Key order is fixed here and
 * must never be re-serialized downstream: axios must send this string as-is.
 */
export function buildBridgeBody(parts: {
  appId: string;
  recipientIgId: string;
  igsid: string;
  messageId: string;
  igUsername?: string | null;
  forward: ForwardableDm;
  providerEventTimestamp?: number | null;
}): string {
  const body: Record<string, unknown> = {
    appId: parts.appId,
    recipientIgId: parts.recipientIgId,
    igsid: parts.igsid,
    messageId: parts.messageId,
  };
  if (parts.igUsername) body.igUsername = parts.igUsername;
  // Provider-authenticated ORIGINAL event time (Meta webhook timestamp, ms):
  // the bridge rejects content DMs that predate the current binding, so a
  // delayed first delivery can never be claimed by a later (or different)
  // binding holder. The request-signing timestamp is NOT this value.
  if (
    typeof parts.providerEventTimestamp === 'number' &&
    Number.isFinite(parts.providerEventTimestamp)
  ) {
    body.providerEventTimestamp = parts.providerEventTimestamp;
  }
  if (parts.forward.kind === 'code') body.code = parts.forward.code;
  else body.url = parts.forward.url;
  return JSON.stringify(body);
}

/** EXACT mirror of KeepCue's signBridgePayload (dm-link.ts). */
export function signBridgePayload(
  secret: string,
  timestamp: number,
  appId: string,
  recipientIgId: string,
  igsid: string,
  messageId: string,
  rawBody: string,
): string {
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${appId}.${recipientIgId}.${igsid}.${messageId}.${bodyHash}`)
    .digest('hex');
}

export type ForwardOutcome = 'done' | 'retry' | 'dead' | 'config_error' | 'hold';

/**
 * FIRST-USE PROPOSAL (source-only, for review; NOT in the reviewed v2.3.8
 * candidate): the bridge's first-use guard (`skipped:'guard_hold'`) is not a
 * durable negative - the bridge has PARKED the claim while the binding
 * clock-skew window is still ambiguous. Dead-lettering here (today's
 * behavior via 409 -> 'dead') redacts the forwarder's audit row within
 * seconds while the bridge is still holding the claim, and the user is
 * never told promptly: the silent first-reel loss. The proposal maps the
 * hold signal to a bounded, non-destructive hold-retry instead.
 * Detection keys on the response BODY CODE, not the status alone, so a
 * mixed-version window (bridge still returning 409 with the code, or a
 * future 425) resolves identically; a bare 409 without the code stays a
 * durable negative exactly as before.
 */
export const BRIDGE_SKIP_GUARD_HOLD = 'guard_hold';
/** Default delay before re-dispatching a guard-held DM: one guard window plus margin. */
export const GUARD_HOLD_DEFAULT_RETRY_MS = 65_000;
/** Never honor a bridge-requested hold delay beyond this (10 min). */
export const GUARD_HOLD_MAX_RETRY_MS = 10 * 60_000;
/**
 * Forwarder-side hold budget, measured from the outbox row's createdAt
 * (original ingress anchor). Mirrors the bridge's own 30-minute parked-claim
 * age bound: past it, further guard_hold answers are treated as terminal so
 * a misbehaving bridge cannot hold a row forever. No Meta redelivery is
 * involved - Meta already received its 200 against the durable PG anchor.
 */
export const GUARD_HOLD_BUDGET_MS = 30 * 60_000;

/** Response semantics per the bridge contract. */
export function mapBridgeResponse(status: number, skipped?: string | null): ForwardOutcome {
  if (status === 200) return 'done';
  if (status === 401) return 'config_error';
  if (skipped === BRIDGE_SKIP_GUARD_HOLD && (status === 409 || status === 425)) return 'hold';
  if (status === 409) return 'dead';
  if (status === 425) return 'retry'; // early-data style answer without the hold code: transient
  if (status === 429 || status >= 500) return 'retry';
  if (status >= 400) return 'dead'; // other 4xx: durable caller defect, retrying cannot help
  return 'retry'; // unexpected 1xx/3xx: treat as transient
}

/** Retention for terminal outbox rows (audit metadata only, payload redacted). */
export const OUTBOX_DEAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Total dispatch-attempt budget across reconciler cycles (9 per BullMQ job). */
export const OUTBOX_MAX_DISPATCH_ATTEMPTS = 27;
/**
 * Max age of an undispatched row (PENDING or CONFIG_ERROR). Bounds how long a
 * raw payload (codes/URLs/ids) can linger when the bridge is down, the config
 * is broken, or the feature is gated off: past this window the row goes DEAD
 * with its payload redacted.
 */
export const OUTBOX_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Collision-safe BullMQ job identity for one outbox event. BullMQ FORBIDS
 * ':' in custom job ids (its own key separator), so the readable five-part
 * colon id from v1 was rejected by the installed validator. A sha256 of the
 * full composite identity is deterministic (Meta redelivery dedupes to the
 * same job) and separator-free.
 */
export function forwardJobId(parts: {
  appId: string;
  recipientIgId: string;
  igsid: string;
  messageId: string;
}): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${parts.appId}.${parts.recipientIgId}.${parts.igsid}.${parts.messageId}`)
    .digest('hex');
  return `kc-forward-${hash}`;
}

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

/** Exponential backoff: 30s, 60s, 120s, ... capped at 30 minutes. */
export function nextBackoffMs(attempts: number): number {
  const exp = Math.min(Math.max(attempts - 1, 0), 20);
  return Math.min(BASE_BACKOFF_MS * 2 ** exp, MAX_BACKOFF_MS);
}

/**
 * The worker-side custom backoff strategy (BullMQ settings.backoffStrategy):
 * BullMQ's built-in exponential has NO cap (30s -> ... -> 32min -> 64min),
 * so the documented 30-minute cap is enforced here. The job option's
 * `backoff.delay` is the base, so tests keep their fast ladder.
 */
export function keepcueBackoffStrategy(
  attemptsMade: number,
  _type?: string,
  _err?: Error,
  job?: { opts?: { backoff?: number | { delay?: number } } },
): number {
  // First-use hold: the thrown error carries the bridge-requested delay as
  // KEEPCUE_HOLD:<ms>; honor it (clamped) instead of the exponential curve.
  const holdMatch = _err?.message?.match(/KEEPCUE_HOLD:(\d+)/);
  if (holdMatch) {
    return Math.min(
      Math.max(Number(holdMatch[1]) || GUARD_HOLD_DEFAULT_RETRY_MS, 1_000),
      GUARD_HOLD_MAX_RETRY_MS,
    );
  }
  const raw = job?.opts?.backoff;
  const base = (typeof raw === 'number' ? raw : raw?.delay) ?? BASE_BACKOFF_MS;
  const exp = Math.min(Math.max(attemptsMade - 1, 0), 20);
  return Math.min(base * 2 ** exp, MAX_BACKOFF_MS);
}

/**
 * Marker recorded in WebhookEvent.errorMessage when a forward-relevant
 * message could not be persisted to the outbox (transient PG failure). The
 * reconciler scans for this marker (plus stuck-PENDING rows) and re-drives
 * FORWARDING ONLY from the durable payload - never automation.
 */
export const FORWARD_PERSIST_MARKER = 'KEEPCUE_FORWARD_PERSIST_FAILED';

/** Thrown when the durable outbox insert itself fails. Never swallowed. */
export class KeepcueForwardPersistError extends Error {
  readonly forwardMessageId: string;
  constructor(forwardMessageId: string, cause: unknown) {
    super(
      `${FORWARD_PERSIST_MARKER} messageId=${forwardMessageId}: ` +
        (cause instanceof Error ? cause.message : String(cause)),
    );
    this.name = 'KeepcueForwardPersistError';
    this.forwardMessageId = forwardMessageId;
  }
}

/**
 * How far back the reconciler scans WebhookEvent rows for un-forwarded
 * relevant messages. Bounded: recovery of an event older than this would
 * land outside any meaningful dispatch window anyway.
 */
export const WEBHOOK_FORWARD_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A webhookEvent is considered stuck (routing never completed, e.g. PG
 * outage mid-route swallowed both the outbox insert AND the FAILED update)
 * when it stays PENDING past this age.
 */
export const WEBHOOK_STUCK_PENDING_MS = 5 * 60_000;

/**
 * Explicit maybeForward outcome. Recovery checkpoints ONLY on the safe set:
 * a void/resolved promise never means "handled" - a skipped forward (gate,
 * recipient, misconfiguration) is an unresolved owed forward.
 */
export type ForwardEnqueueOutcome =
  | 'persisted' // new durable outbox row committed
  | 'duplicate' // already outboxed (skipDuplicates)
  | 'no_forwardable_content' // nothing owed for this message
  | 'skipped_gate_off' // feature gate off: nothing owed BY POLICY
  | 'skipped_recipient' // not the designated recipient: nothing owed
  | 'skipped_misconfigured'; // owed, but bridge config missing: NOT resolved

/** Outcomes under which a recovered event may be checkpointed. */
export const FORWARD_SAFE_RECOVERY_OUTCOMES: ReadonlySet<ForwardEnqueueOutcome> = new Set([
  'persisted',
  'duplicate',
  'no_forwardable_content',
]);

/**
 * Provider event-time normalization. Meta sends integer Unix SECONDS; a
 * value below 1e12 is treated as seconds and normalized to the START of
 * that second in ms. Anything non-finite/non-integer/non-positive is null
 * (the bridge fails closed on it). Fractional values pass through as-is so
 * the bridge can reject them; they are implausible from the provider.
 */
export function normalizeProviderEventTime(ts: unknown): number | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;
  if (Number.isInteger(ts) && ts < 1e12) return ts * 1000;
  return ts;
}

/**
 * The ONE shared media-url mapping, mirroring WebhookRouterService's
 * extractSharedMedia url semantics EXACTLY (attachments
 * url/media_url/target_url with the lookaside->mediaId fallback, then a
 * direct share.link). The router's forward path AND the reconciler's
 * recovery path both use this, so a shape the live path accepts can never
 * be lost by recovery.
 */
export function extractSharedMediaUrl(messageObj: any): string | undefined {
  if (!messageObj) return undefined;
  const attachments = messageObj.attachments;
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      const type = (att?.type || '').toLowerCase();
      const payload = att?.payload || {};
      const rawUrl: string | undefined = payload.url || payload.media_url || payload.target_url;
      let mediaId: string | undefined =
        payload.ig_post_media_id ||
        payload.video_id ||
        payload.id ||
        payload.media_id ||
        payload.target_id ||
        payload.asset_id;
      if (!mediaId && rawUrl && rawUrl.includes('asset_id=')) {
        const match = rawUrl.match(/asset_id=([0-9]+)/);
        if (match) mediaId = match[1];
      }
      const isLookaside = rawUrl && rawUrl.includes('lookaside.fbsbx.com');
      const url = isLookaside ? undefined : rawUrl;
      const previewUrl =
        isLookaside ||
        (rawUrl && (rawUrl.includes('cdninstagram.com') || rawUrl.includes('fbcdn.net')))
          ? rawUrl
          : undefined;
      const title = payload.title || payload.caption;
      if (
        [
          'ig_reel',
          'reel',
          'share',
          'ig_post',
          'post',
          'ig_reel_share',
          'video',
          'image',
          'fallback',
        ].includes(type) &&
        (mediaId || url || previewUrl || title)
      ) {
        return url || (mediaId ? `https://www.instagram.com/p/${mediaId}/` : undefined);
      }
    }
  }
  if (messageObj.share?.link) return messageObj.share.link;
  return undefined;
}

/**
 * Does this webhook payload carry DM (messaging) events? Covers all three
 * transport shapes the router handles. Used for the DM-scoped durable
 * ingress boundary: with the forwarder gate ON, DM payloads get strict
 * durability semantics (no silent loss); every other payload keeps the
 * baseline best-effort behavior.
 */
export function payloadContainsDmEvent(payload: any): boolean {
  for (const entry of payload?.entry ?? []) {
    if ((entry?.messaging ?? []).some((m: any) => m?.message)) return true;
    if ((entry?.changes ?? []).some((c: any) => c?.field === 'messages' && c?.value?.message))
      return true;
  }
  if (payload?.sample?.field === 'messages') return true;
  if (payload?.field === 'messages') return true;
  return false;
}

/**
 * The narrow ingress-boundary scope: TRUE only for a payload that contains a
 * DM event which THIS forwarder is actually authorized to carry - at least
 * one message addressed to a configured KeepCue recipient with forwardable
 * content (a link code or shared media with a URL, per detectForwardableDm).
 * A DM for another business account, or one with no forwardable content,
 * keeps the baseline best-effort ingress behavior (200 / temp-id fallback),
 * so the 503/rethrow boundary changes NOTHING outside authorized KeepCue
 * forward traffic.
 */
export function payloadContainsForwardableDm(payload: any, recipientIgIds: string[]): boolean {
  return extractForwardableMessages(payload).some(
    (m) =>
      !!m.recipientId && recipientIgIds.includes(m.recipientId) && detectForwardableDm(m) !== null,
  );
}

/**
 * Deterministic recovery anchor for the pre-commit ingress window: after the
 * ingestion job's BullMQ attempts are exhausted, this PENDING outbox row is
 * what the reconciler discovers and re-drives. Idempotent by the outbox's
 * composite unique key; the rawBody is the exact bytes the dispatcher would
 * have sent, so requeueing the standard forward job re-uses the existing
 * durable dispatch path unchanged.
 */
export function ingressAnchorJobPayloads(body: any, config: KeepcueForwardConfig) {
  // EVERY eligible DM in the batch gets its own anchor: acknowledging the
  // POST acknowledges every message in it, so anchoring only the first would
  // leave the rest with no durable record.
  return extractForwardableMessages(body)
    .filter(
      (m) =>
        !!m.recipientId &&
        config.recipientIgIds.includes(m.recipientId) &&
        detectForwardableDm(m) !== null,
    )
    .map((msg) => ({
      appId: config.appId,
      recipientIgId: msg.recipientId as string,
      igsid: msg.fromId,
      messageId: msg.messageId,
      rawBody: buildBridgeBody({
        appId: config.appId,
        recipientIgId: msg.recipientId as string,
        igsid: msg.fromId,
        messageId: msg.messageId,
        igUsername: null,
        forward: detectForwardableDm(msg)!,
        providerEventTimestamp: normalizeProviderEventTime(msg.providerEventTimestamp),
      }),
    }));
}

export interface RecoveredForwardMessage {
  recipientId?: string;
  fromId: string;
  messageId: string;
  text?: string;
  sharedMedia?: { url?: string } | null;
  providerEventTimestamp?: number | null;
}

/**
 * Extract every message event from a stored Meta webhook payload, in both
 * shapes the router handles: entry[].messaging[] and
 * entry[].changes[] where field === 'messages'. Over-inclusion is safe:
 * maybeForward re-applies config and detectForwardableDm. Under-inclusion
 * is the risk, so keep both shapes covered.
 */
export function extractForwardableMessages(payload: unknown): RecoveredForwardMessage[] {
  const out: RecoveredForwardMessage[] = [];
  const entries: any[] = (payload as any)?.entry ?? [];
  const mediaOf = (msg: any): { url?: string } | null => {
    const url = extractSharedMediaUrl(msg); // EXACT router-accepted semantics
    return url ? { url } : null;
  };
  const push = (
    recipientId: string | undefined,
    fromId: string | undefined,
    messageId: string | undefined,
    text: string | undefined,
    msg: any,
    ts: unknown,
  ) => {
    if (!fromId || !messageId) return;
    out.push({
      recipientId,
      fromId,
      messageId,
      text,
      sharedMedia: mediaOf(msg),
      providerEventTimestamp: normalizeProviderEventTime(ts),
    });
  };
  for (const entry of entries) {
    for (const m of entry?.messaging ?? []) {
      if (!m?.message) continue;
      push(
        m?.recipient?.id,
        m?.sender?.id,
        m?.message?.mid,
        m?.message?.text,
        m?.message,
        m?.timestamp,
      );
    }
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      const v = change?.value;
      push(
        v?.recipient?.id,
        v?.sender?.id,
        v?.message?.mid,
        v?.message?.text,
        v?.message,
        v?.timestamp,
      );
    }
  }
  return out;
}


/**
 * Username charset guard: real IG handles only (never trust provider text).
 */
export const IG_USERNAME_RE = /^[a-z0-9._]{1,30}$/i;

/**
 * Resolve a DM sender's @handle using the SAME mechanism DMPilot's DM inbox
 * already uses (instagram.service.ts): Meta Graph User Profile lookup with
 * the connected account's stored (decrypted) page token. The service layer
 * supplies the token; this stays pure and fail-open (null on any error, so a
 * resolver outage can never break forwarding - the fallback ig_user_ label
 * already exists downstream).
 */
export async function resolveIgUsername(
  igsid: string,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!/^\d+$/.test(igsid)) return null;
  if (!accessToken) return null;
  try {
    const res = await fetchImpl(
      `https://graph.facebook.com/v20.0/${igsid}?fields=username,name&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: unknown };
    const username = typeof data?.username === 'string' ? data.username.trim() : '';
    return IG_USERNAME_RE.test(username) ? username : null;
  } catch {
    return null;
  }
}
