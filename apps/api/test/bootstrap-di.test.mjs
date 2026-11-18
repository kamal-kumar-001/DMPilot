// Full-app bootstrap DI regression.
//
// What this proves:
//   [1] The real Nest application context (AppModule) boots end to end with
//       production env validation enabled. Every integration suite before
//       this one instantiates services directly, so a broken constructor
//       injection token (a default-valued param without @Optional(), an
//       unexported provider) passes all suites and only crashes the deployed
//       container. This test exercises the exact resolution path the
//       container entrypoint runs.
//   [2] ContentPublishService's optional constructor params resolve the way
//       production relies on them: the axios default is actually injected
//       (not undefined) and the @Optional() TesterAccessService resolves
//       from the module.
//
// Requires TEST_DATABASE_URL (scratch DB, schema pushed, api built).
import assert from 'node:assert/strict';

if (!process.env.TEST_DATABASE_URL) {
  console.log('SKIP: set TEST_DATABASE_URL');
  process.exit(0);
}

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:1';
process.env.PORT = '4000';
process.env.JWT_SECRET = 'di-smoke-jwt-secret-0123456789';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.SMTP_FROM = 'dummy@example.invalid';
process.env.MAIL_DOMAIN = 'example.invalid';
process.env.ENCRYPTION_KEY = 'di-smoke-encryption-key-0123456789ab';
process.env.META_REDIRECT_URI = 'http://localhost:4000/api/meta/callback';
process.env.META_WEBHOOK_VERIFY_TOKEN = 'di-smoke-verify-token';
process.env.BILLING_PROVIDER = 'feefree';
process.env.FEEFREE_API_URL = 'http://127.0.0.1:1';
process.env.FEEFREE_API_KEY = 'di-smoke-feefree-key';
process.env.FEEFREE_WEBHOOK_SECRET = 'di-smoke-feefree-webhook';
process.env.CORS_ORIGINS = 'http://localhost:3000';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { ContentPublishService } = await import('../dist/instagram/content-publish.service.js');
const { TesterAccessService } = await import('../dist/instagram/tester-access.service.js');

let pass = 0;
const ok = (cond, m) => { assert.ok(cond, m); pass++; console.log('  PASS', m); };

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});
ok(true, 'AppModule application context boots with production env validation');

const svc = app.get(ContentPublishService, { strict: false });
ok(svc instanceof ContentPublishService, 'ContentPublishService resolves through Nest DI');
ok(
  svc.http !== undefined && svc.http !== null && typeof svc.http.post === 'function',
  'optional axios param falls back to its real default (not undefined)',
);
const tester = app.get(TesterAccessService, { strict: false });
ok(tester instanceof TesterAccessService, 'TesterAccessService resolves through Nest DI');

await app.close();
console.log(`bootstrap-di: ${pass} checks passed`);
process.exit(0);
