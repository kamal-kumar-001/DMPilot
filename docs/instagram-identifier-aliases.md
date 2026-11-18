# Instagram identifier aliases (durable webhook account resolution)

## Problem

Meta delivers webhooks keyed by the identifier namespace of the subscription
that produced them. The two namespaces for one Instagram professional account
are not interchangeable:

- Facebook-Login (classic) subscriptions deliver the page-linked IG business
  account id (e.g. `17841458228090598`).
- Instagram-Login (Business Login) subscriptions deliver the Instagram-scoped
  user id, IGSID (e.g. `27400820022902831`).

`InstagramAccount` stores one primary `instagramId` plus an optional
`instagramPageId`. An account connected via Instagram-Login stores only its
IGSID, so webhooks still delivered in the page-linked namespace fail strict
resolution and are dropped (both comment and message automation).

## Design

New table `InstagramAccountAlias`: globally-unique `identifier` -> one
account, with provenance (`source`, `note`). Resolution order
(`webhook-account-resolver.ts`):

1. Primary columns (`instagramId`, `instagramPageId`) — unchanged.
2. Alias bindings whose joined account is itself active (connected, not
   soft-deleted).
3. Otherwise drop the event, exactly as before.

### Media ownership proof (endpoint-specific evidence)

Automatic binding on an unresolved COMMENT identifier uses the IG Media
reference's `owner` field, not read success:

> `owner` - "Instagram user ID who created the media. Only returned if the
> app user making the query also created the media; otherwise, `username`
> field is returned instead."
> (developers.facebook.com/docs/instagram-platform/reference/instagram-media/)

A successful media read alone is NOT ownership proof (several IG Media
fields are public / readable via field expansion). The binder requires the
provider-returned immutable owner id AND an exact match to the candidate
account's stored instagramId (same namespace as that account's login
product). A read returning no `owner`, a mismatched owner, or any API error
binds nothing. Live confirmation of `owner` behavior under each token type
remains a deploy-time verification step; if it does not behave as
documented, the proof never fires (fail closed) and manual binding remains.

Fail-closed invariants:

- **No implicit identity.** Aliases are created ONLY by the explicit
  `bindVerifiedIdentifier` operation (operator script with an evidence
  `note`). They are never learned from webhook payloads and never derived
  from username matches: handles can be renamed or reassigned, so a username
  is not identity. There is no automatic carryover on connect/reconnect.
- **Global conflict checks.** Binding refuses an identifier that is a
  primary id of any ACTIVE account (any user), or already alias-bound.
  An identifier whose only primary holder is inactive may be bound (the
  reviewed-migration case) and returns a warning: if such a row is ever
  reactivated, the resolver detects the primary/alias disagreement and
  fails closed until re-review.
- **Ambiguity fails closed.** If webhook candidates (entry.id / recipientId)
  resolve to different accounts, or a primary column and an alias disagree
  on the same identifier, resolution returns null and the event drops.
- **Race safety.** Bind validation runs in one transaction and the unique
  constraint on `identifier` is the final arbiter; a concurrent winner
  surfaces as AliasConflictError and writes nothing. Resolution reads are
  plain lookups; an alias created mid-flight only affects later events.

## Operator workflow (approval-gated)

1. Apply migration `20261118130000_add_instagram_account_alias`,
   `prisma generate`, rebuild and redeploy `dmpilot-api`.
2. `npx ts-node scripts/report-alias-candidates.ts` — READ-ONLY candidate
   report (same-user predecessor rows) to review. Treat every row as a hint,
   not evidence.
3. Verify each mapping with immutable evidence (app audit-log id history,
   webhook ids Meta delivered for the account's own media, dashboard data),
   then bind explicitly:
   `npx ts-node scripts/bind-instagram-alias.ts --account <uuid> --identifier <id> --note "<evidence>"`
   For @fakeeiitian: account `d2bff0ca-a911-49df-a853-b4894ceed5f6`,
   identifier `17841458228090598`.
4. Verify with a fresh comment/DM while watching logs (no "Dropping event"
   warns; Comment/Message rows appear). Sends stay as the user configures.

## Creator lifecycle (what works when)

| Scenario                                                               | Behavior with this fix                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign up + connect (Instagram-Login), webhooks in same namespace        | Works natively, no aliases involved                                                                                                                                                                                        |
| Sign up + connect, webhooks arriving in the other namespace            | First incoming comment self-heals via media ownership proof (one provider-witnessed bind); until then events drop                                                                                                          |
| Disconnect + reconnect the SAME login product                          | Disconnect soft-deletes; reconnect upsert revives the row (code-verified). Works IF Meta returns the same app-scoped id (revoke+regrant stability not doc-established) AND the webhook subscription namespace is unchanged |
| Reconnect switching login product (Instagram-Login <-> Facebook-Login) | Stored id namespace flips; first comment self-heals via ownership proof; message-only accounts need one reviewed manual bind                                                                                               |
| Any unresolved case (deleted media, proof errors, ambiguity)           | Fails closed (event drops) + warn log; operator binds explicitly via scripts/bind-instagram-alias.ts                                                                                                                       |

## How established services handle this (public documentation only)

Manychat's current help center (updated Oct 29, 2026) documents all three
Meta connection products side by side - "Via Meta" (Facebook Login/Business
Portfolio, fullest features), "Connect Via Instagram" (Instagram Login,
"quickest and simplest", limited features) and "Via Meta Business Suite" -
i.e. they expose the same dual-product reality DMPilot faces. Their
documented repair for broken/mismatched connections is a user-initiated
"Refresh permissions" re-auth flow, which they list as fixing "automations
not publishing or messages failing to send" and "mismatched information
between your Facebook/Instagram accounts and Manychat". Their internal
identifier storage, routing and any automatic healing are proprietary and
undocumented - no claim is made about what they do or do not do internally.
Nothing in this design relies on guesses about competitor internals.

## Known limits

- Reconnects no longer self-heal automatically: after an Instagram-Login
  reconnect of an account that previously used Facebook-Login, an operator
  must bind the old identifier explicitly (steps 2-3). This is the cost of
  never trusting usernames. A future improvement could collect immutable
  evidence at connect time (e.g. if Meta ever exposes both namespaces in one
  token's introspection) and bind inside the connect flow transaction.
- Old undelivered events are not replayed.

## Tests

`node --experimental-strip-types apps/api/test/webhook-account-resolver.test.mjs`
— 15 tests incl. adversarial cases: handle reuse (alias to inactive target),
same-user second account, primary/alias disagreement, cross-user bind
attempts, double binding, concurrent-bind race, entry/recipient ambiguity.
