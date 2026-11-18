import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const API = '/downloads/dmpilot-fix/apps/api';
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  s.on('error', rej);
});
const databaseDir = mkdtempSync(path.join(tmpdir(), 'dmpilot-it10-'));
const port = await freePort();
const pg = new EmbeddedPostgres({ databaseDir, user: 'test', password: 'test', port, persistent: true });
await pg.initialise();
await pg.start();
await pg.createDatabase('itdb');
const url = `postgresql://test:test@localhost:${port}/itdb`;
execFileSync('pnpm', ['prisma', 'db', 'push', '--skip-generate'], { cwd: API, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
execFileSync('node', ['test/it-phase10.test.mjs'], { cwd: API, env: { ...process.env, TEST_DATABASE_URL: url }, stdio: 'inherit' });
await pg.stop();
