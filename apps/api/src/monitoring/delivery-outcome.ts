/**
 * Honest delivery-log outcome classification.
 *
 * A row in the delivery log is built from a comment/share plus the latest
 * matching outgoing Message row. The old code labelled everything
 * "DELIVERED - got the DM" by default, but no receipt signal exists: the
 * only evidence is the local message row. This classifier maps the actual
 * evidence to what we can honestly claim:
 *
 * - ACCEPTED: a message row with a real provider message id exists.
 *   Instagram accepted the DM. Never say delivered/read.
 * - QUEUED: the row still carries a `manual_…` placeholder id, so the send
 *   is unresolved (pre-created by a manual inbox send, queue not done).
 * - SANDBOX: the row carries a `mock_msg_…` id from the sandbox mock path.
 *   No provider call happened; never present it as acceptance.
 * - FAILED: explicit failure evidence (message status FAILED or the
 *   comment's failure marker).
 * - NO_MATCH: the comment/share matched no campaign; nothing was sent.
 * - UNKNOWN: matched, but no message row exists, so no outcome is recorded
 *   (job not run yet, or outcome lost). Say so; never invent a result.
 */
export type DeliveryOutcome = 'ACCEPTED' | 'QUEUED' | 'SANDBOX' | 'FAILED' | 'NO_MATCH' | 'UNKNOWN';

export interface OutcomeEvidence {
  messageId?: string | null;
  status?: string | null;
}

export function classifyMessageOutcome(msg: OutcomeEvidence | null | undefined): DeliveryOutcome {
  if (!msg) return 'UNKNOWN';
  if (msg.status === 'FAILED') return 'FAILED';
  const id = msg.messageId ?? '';
  if (id.startsWith('manual_')) return 'QUEUED';
  if (id.startsWith('mock_msg_')) return 'SANDBOX';
  // failed_/quota_ ids only ever accompany FAILED rows, handled above.
  return 'ACCEPTED';
}

/** Short, honest per-row copy. No "got the DM" receipt claims. */
export function dispatchStatusFor(
  outcome: DeliveryOutcome,
  context: string,
  error?: string | null,
): string {
  switch (outcome) {
    case 'ACCEPTED':
      return `DM accepted by Instagram${context ? ` ${context}` : ''}.`;
    case 'QUEUED':
      return 'still sending - no provider response yet.';
    case 'SANDBOX':
      return 'recorded in sandbox - no real provider call.';
    case 'FAILED':
      return error ? `send failed (${error}).` : 'send failed.';
    case 'NO_MATCH':
      return context; // caller supplies the match-specific explanation
    case 'UNKNOWN':
      return 'matched, but no send outcome is recorded yet.';
  }
}
