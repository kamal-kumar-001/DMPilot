// Fail-closed egress guard for tests. Import BEFORE any code under test.
//
// A missed or mis-wired axios stub must never let a test reach a real
// provider (a fake token is not an isolation boundary): this patches the
// Node http/https request entry points axios rides on, plus global fetch,
// so every outbound attempt throws synchronously inside the test process.
//
// The error message deliberately names the target so a denial in output is
// self-explaining evidence, not a mystery failure.
import http from 'node:http';
import https from 'node:https';

function describe(args) {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) return String(first);
  if (first && typeof first === 'object')
    return `${first.protocol ?? ''}//${first.hostname ?? first.host ?? '?'}${first.path ?? ''}`;
  return '(unknown target)';
}

function denied(protocol) {
  return function (...args) {
    throw new Error(
      `TEST EGRESS DENIED: outbound ${protocol} request to ${describe(args)} blocked by test/helpers/deny-egress.mjs`,
    );
  };
}

http.request = denied('http');
https.request = denied('https');
http.get = denied('http');
https.get = denied('https');

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  // Allow loopback only (some suites boot a local server); deny everything else.
  const url = String(input?.url ?? input);
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url)) {
    return realFetch(input, init);
  }
  throw new Error(`TEST EGRESS DENIED: fetch to ${url} blocked by test/helpers/deny-egress.mjs`);
};

console.log('EGRESS GUARD active: outbound http/https/fetch calls throw');
