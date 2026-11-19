// Static contract checks complement the desktop/mobile fixture render checks.
// No production connection, writes, schema or provider execution.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const admin = read('../src/admin/admin.controller.ts');
for (const path of ['campaigns', 'queues', 'failed-jobs', 'failed-jobs/:queue/:jobId/retry']) {
  assert.ok(!admin.includes(`@Get('${path}')`) && !admin.includes(`@Post('${path}')`));
}
assert.ok(admin.includes("@Get('logs')"));
assert.ok(admin.includes("@Post('deploy-requests')"));
assert.ok(admin.includes('@Roles(UserRole.ADMIN)'));
const monitoring = read('../src/monitoring/monitoring.controller.ts');
for (const marker of [
  "@Get('queues')",
  "@Get('failed-jobs')",
  "@Post('failed-jobs/:queue/:jobId/retry')",
]) {
  const section = monitoring.slice(monitoring.indexOf(marker), monitoring.indexOf(marker) + 300);
  assert.ok(section.includes('@Roles(UserRole.ADMIN)'));
}
const page = read('../../web/app/admin/page.tsx');
assert.equal((page.match(/\{ id: '/g) || []).length, 9);
for (const [alias, target] of Object.entries({
  queue: 'monitoring',
  webhooks: 'monitoring',
  logs: 'monitoring',
  deploy: 'monitoring',
  flags: 'plans',
  campaigns: 'creators',
})) {
  assert.ok(page.includes(`${alias}: '${target}'`));
}
assert.ok(!existsSync(new URL('../../web/components/admin/admin-campaigns.tsx', import.meta.url)));
assert.ok(!existsSync(new URL('../../web/components/admin/admin-queue.tsx', import.meta.url)));
assert.ok(existsSync(new URL('../src/campaign/campaign.controller.ts', import.meta.url)));
const layout = read('../../web/components/admin/admin-layout.tsx');
assert.ok(layout.includes('navGroups.map((group) => group.id)'));
const panels = read('../../web/components/admin/admin-monitoring.tsx');
assert.ok(panels.includes('React.useState(false)'));
assert.ok(panels.includes('{open &&'));
assert.ok(
  panels.indexOf('title="Failed Jobs Queue"') <
    panels.indexOf('title="Webhook Audit & Failure Logs"'),
);
assert.ok(
  panels.indexOf('title="Webhook Audit & Failure Logs"') < panels.indexOf('title="Audit log"'),
);
const plans = read('../../web/components/admin/admin-plans.tsx');
assert.ok(plans.indexOf('<AdminFeatureFlags />') > plans.indexOf('Configure Plan'));
assert.ok(plans.indexOf('<AdminAppReview />') > plans.indexOf('<AdminFeatureFlags />'));
const promo = read('../../web/components/admin/admin-promotions.tsx');
assert.ok(
  promo.indexOf('Promotional Coupon Codes') < promo.indexOf('Promotional Banner & Discounts'),
);
const deploy = read('../../web/components/admin/admin-deploy.tsx');
assert.ok(!deploy.includes('Request history'));
assert.ok(deploy.includes('Rollback backend') && deploy.includes('Not connected yet'));
const account = read('../../web/components/dashboard/account-chips.tsx');
assert.ok(account.includes('AccountPhoto src={account.profilePicture}'));
assert.ok(account.includes('selectedAccountId === null'));
assert.ok(account.includes('onError={() => setFailed(true)}'));
assert.ok(!account.includes('apiRequest') && !account.includes('setInterval'));
console.log(
  'PASS admin layout, removed-only endpoints, retained guards/data modules, lazy accordions and account selector contracts',
);
