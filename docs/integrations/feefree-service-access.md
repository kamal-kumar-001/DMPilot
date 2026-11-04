# FeeFree email-observed subscription access

This is a separate, reversible subscription-access lane. It never confirms a bank payment, marks a payment session paid, or issues a paid invoice/receipt.

## Rollout

Keep `FEEFREE_SERVICE_ACCESS_ENABLED=false` until the deployed FeeFree merchant has a working receiving account/mailbox policy and both deployed services pass a synthetic signed delivery/lookup/revoke check. No database migration is needed: consumer enrollment and grants use the existing SystemSetting store. Existing payment-provider API key, API URL and webhook secret must already match the receiving merchant.

Provider-side requirements: service-pilot code deployed; merchant selected with REVOCABLE_SUBSCRIPTION policy; actual mailbox and receiving account covered by the parser; observation and webhook delivery enabled only after checks. AUTH_PENDING checkout enrollment is metadata only. No access is granted before verified ACTIVE/PROCESSING checkout eligibility. A sample HDFC email does not establish support for a different configured bank.

## Flow

DMPilot creates and stores its own PaymentSession, enrolls it server-side, then returns the checkout URL. Enrollment failure is visible and no checkout URL is returned for an ineligible service checkout. It does not grant access. FeeFree observes eligible mail, writes a separate grant and outbox event. DMPilot verifies the raw HMAC and fresh envelope, re-reads the grant using the merchant API key, then verifies its own exact order/session/amount/currency and enrollment before storing access.

The machine webhook uses a direct ACK `{handled:true,eventId,grantId,revision}`, without the normal browser API response wrapper. FeeFree must check every field before marking delivery complete.

The plan/cycle come from DMPilot's stored checkout. Duration is the original issue time plus the existing DMPilot 30-day monthly or365-day annual period. Repeat deliveries never restart that period. There is no artificial24-hour cutoff. Provider failure, authoritative revoke or period end supplies no overlay rights. Terminal revoke cannot be undone by a delayed grant. An existing equal/higher paid subscription is preserved.

GET /admin/service-access and POST /admin/service-access/:grantId/revoke use the existing ADMIN guards. Billing clearly labels email-observed evidence as not bank-verified. Paid receipt retrieval remains restricted to separately PAID invoices.

## Validation

Build API before running `node --test tests/security/*.cjs`. The service tests cover exact ACK, mismatched records/evidence, terminal revoke/replay, duplicate duration, monthly/yearly mapping, disabled/failing provider and a real Nest HTTP endpoint with the global interceptor. The browser fixture in tests/performance/service-access-regression.py requires a web build, local Chrome and Python requests/websocket packages. It intercepts all private API calls and uses synthetic data only.

Cross-service controlled harnesses additionally used the actual FeeFree SQLite service and dispatcher against the real consumer controller and authoritative lookup. These do not prove live mailbox support or deployed PostgreSQL persistence. Live configuration must be checked separately; never use a real customer payment as a test without authority.
