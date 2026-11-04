# Controlled browser regression

`browser-regression.py` runs the built web app on localhost with mocked NextAuth and business API responses. It never calls a live account API. It requires Python requests/websocket-client and headless Chrome, then a prior `pnpm --filter @dmpilot/web build`.

Checks summary/chart/follower/activity refresh, refresh-error feedback, same-document Dashboard/Pricing/About navigation, responsive screenshots, overflow and browser exceptions. These are fixture results, not phone or production latency measurements. API/auth/private HTML are never service-worker cached.

Additional unit checks: `pnpm --filter @dmpilot/web test:performance` and `node --test apps/api/test/analytics-readonly.cjs`.
