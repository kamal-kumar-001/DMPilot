// Boots a disposable embedded Postgres in a temp dir, pushes the Prisma
// schema, builds the api, and runs the real-DB integration tests against it.
// Usage: node scripts/run-integration-tests.mjs
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const API = path.resolve(import.meta.dirname, '../apps/api');
const TESTS = ['test/idempotency-concurrency.test.mjs', 'test/it-phase3.test.mjs'];

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });

const databaseDir = mkdtempSync(path.join(tmpdir(), 'dmpilot-it-'));
const port = await freePort();
const pg = new EmbeddedPostgres({ databaseDir, user: 'test', password: 'test', port, persistent: true });

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('itdb');
  const url = `postgresql://test:test@localhost:${port}/itdb`;
  console.log('[it] embedded postgres up on port', port);
  execFileSync('pnpm', ['--filter', '@dmpilot/api', 'build'], { stdio: 'inherit' });
  execFileSync('pnpm', ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: API,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  let failed = false;
  for (const test of TESTS) {
    console.log('[it] running', test);
    try {
      execFileSync('node', [test], {
        cwd: API,
        env: { ...process.env, TEST_DATABASE_URL: url },
        stdio: 'inherit',
      });
    } catch {
      failed = true;
    }
  }
  if (failed) {
    console.error('[it] integration tests FAILED');
    process.exitCode = 1;
  } else {
    console.log('[it] all integration tests passed');
  }
} finally {
  try { await pg.stop(); } catch {}
  rmSync(databaseDir, { recursive: true, force: true });
}
