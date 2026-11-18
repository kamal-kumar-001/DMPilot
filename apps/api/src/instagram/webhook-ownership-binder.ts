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
  reason?: 'no_proof' | 'multiple_proof' | 'bind_conflict' | 'no_candidates';
}

export async function bindViaMediaOwnershipProof(
  prisma: ResolverPrisma,
  params: {
    identifier: string;
    mediaId: string;
    candidates: OwnershipCandidate[];
    probe: MediaProbe;
    note?: string;
  },
): Promise<OwnershipBindResult> {
  const { identifier, mediaId, candidates, probe } = params;
  if (candidates.length === 0) return { bound: false, reason: 'no_candidates' };

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

  if (winners.length === 0) return { bound: false, reason: 'no_proof' };
  if (winners.length > 1) return { bound: false, reason: 'multiple_proof' };

  try {
    const { warnings } = await bindVerifiedIdentifier(prisma, {
      accountId: winners[0].id,
      identifier,
      source: 'webhook_media_proof',
      note:
        params.note ??
        `Media ${mediaId} readable only by account ${winners[0].id} token per Meta permission model`,
    });
    return { bound: true, accountId: winners[0].id, warnings };
  } catch {
    return { bound: false, reason: 'bind_conflict' };
  }
}
