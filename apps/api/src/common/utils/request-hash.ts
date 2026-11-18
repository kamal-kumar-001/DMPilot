import { createHash } from 'crypto';

/** Stable payload hash guarding idempotent retries against silent payload drift. */
export function hashIdempotentPayload(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash('sha256').update(stable).digest('hex');
}
