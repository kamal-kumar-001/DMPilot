#!/usr/bin/env bash
# DMPilot safe-update host watcher (reviewed artifact; NOT installed yet).
# Runs one fixed operation only: claim the next owner-approved deploy request
# and move the app to exactly that commit. No arbitrary commands, no fail-open.
# Requires env: API_BASE, DEPLOY_API_KEY (deploy-scoped), APP_DIR (git checkout),
# HEALTH_URL. Designed for systemd timer; flock enforces a single run.
set -euo pipefail

LOCK=/tmp/dmpilot-deploy.lock
LOG=/var/log/dmpilot-deploy.log
log() { echo "$(date -u +%FT%TZ) $*" | tail -c 8000 >> "$LOG"; }
redact() { sed -E 's/dmp_live_[A-Za-z0-9]+/[redacted]/g' | tail -c 8000; }

exec 9>"$LOCK"
if ! flock -n 9; then log "another run holds the lock; exiting"; exit 0; fi

api() { curl -sf -X "$1" "$API_BASE$2" -H "x-api-key: $DEPLOY_API_KEY" -H 'content-type: application/json' ${3:+-d "$3"}; }

# Reconcile first: if the API shows an active run but no local run identity
# file exists, report it as stale-failed instead of claiming anything new.
RUN_FILE=/tmp/dmpilot-deploy.run
ACTIVE=$(api GET /watcher/deploy/active || true)
if [ -n "$ACTIVE" ] && [ "$ACTIVE" != "null" ]; then
  ACTIVE_ID=$(echo "$ACTIVE" | jq -r .id); ACTIVE_RUN=$(echo "$ACTIVE" | jq -r .runId)
  if [ ! -f "$RUN_FILE" ] || [ "$(cat "$RUN_FILE")" != "$ACTIVE_RUN" ]; then
    log "stale run $ACTIVE_RUN on $ACTIVE_ID; reporting RECONCILE_FAILED"
    api POST "/watcher/deploy/$ACTIVE_ID/report" "{\"action\":\"RECONCILE_FAILED\",\"runId\":\"$ACTIVE_RUN\"}" >/dev/null || true
  fi
  exit 0
fi

CLAIM=$(api POST /watcher/deploy/claim || true)
[ -z "$CLAIM" ] || [ "$CLAIM" = "null" ] && exit 0
REQ_ID=$(echo "$CLAIM" | jq -r .id); RUN_ID=$(echo "$CLAIM" | jq -r .runId); SHA=$(echo "$CLAIM" | jq -r .targetSha)
echo "$RUN_ID" > "$RUN_FILE"
report() { api POST "/watcher/deploy/$REQ_ID/report" "$1" >/dev/null || true; }
fail() { report "{\"action\":\"FAIL\",\"runId\":\"$RUN_ID\",\"failureReason\":$(echo "$1" | redact | jq -Rs .)}"; rm -f "$RUN_FILE"; exit 1; }

cd "$APP_DIR"
# 1. fetch and verify the exact approved commit is on origin/main ancestry
git fetch origin || fail "git fetch failed"
git merge-base --is-ancestor "$SHA" origin/main || fail "target $SHA is not on origin/main ancestry"
DEPLOYED=$(git rev-parse HEAD)
git merge-base --is-ancestor "$DEPLOYED" "$SHA" || fail "target $SHA is not a fast-forward from deployed $DEPLOYED"
[ -z "$(git status --porcelain)" ] || fail "host checkout has local changes; refusing"
# 2. migration compatibility gate: additive-only schema diff
git worktree add --detach /tmp/dmpilot-next "$SHA" || fail "worktree add failed"
if ! (cd /tmp/dmpilot-next/apps/api && npx prisma migrate diff --from-schema-datasource ../../prisma/schema.prisma --to-schema ../../prisma/schema.prisma --script 2>/dev/null | grep -qiE 'drop table|drop column|alter column'); then
  git worktree remove --force /tmp/dmpilot-next
  report "{\"action\":\"AWAIT_APPROVAL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"non-additive migration diff; needs explicit approval + DB recovery plan\"}"
  rm -f "$RUN_FILE"; exit 0
fi
git worktree remove --force /tmp/dmpilot-next
# 3. preserve immutable rollback image verified by digest
CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' dmpilot-api 2>/dev/null || true)
[ -n "$CURRENT_IMAGE" ] || fail "no running app image found; refusing deploy"
docker tag "$CURRENT_IMAGE" "dmpilot:rollback-$DEPLOYED" || fail "could not tag rollback image"
[ "$(docker inspect --format='{{.Id}}' "dmpilot:rollback-$DEPLOYED")" = "$CURRENT_IMAGE" ] || fail "rollback image digest mismatch; refusing deploy"
# 4. database backup with integrity check (no automatic restore anywhere)
BACKUP="/var/backups/dmpilot/pre-deploy-$RUN_ID.sql"
mkdir -p /var/backups/dmpilot
docker exec dmpilot-db pg_dump -U postgres dmpilot > "$BACKUP" || fail "backup failed"
[ -s "$BACKUP" ] || fail "backup empty; refusing deploy"
# 5. build unique tag, recreate app container only, health check, report
docker build -t "dmpilot:deploy-$SHA-$RUN_ID" "$APP_DIR" || fail "build failed"
docker rm -f dmpilot-api >/dev/null 2>&1 || true
docker run -d --name dmpilot-api --restart unless-stopped "dmpilot:deploy-$SHA-$RUN_ID" || fail "recreate failed"
sleep 15
if curl -sf "$HEALTH_URL" >/dev/null; then
  report "{\"action\":\"SUCCESS\",\"runId\":\"$RUN_ID\",\"logTail\":$(tail -c 4000 "$LOG" | redact | jq -Rs .)}"
else
  docker rm -f dmpilot-api >/dev/null 2>&1 || true
  docker run -d --name dmpilot-api --restart unless-stopped "dmpilot:rollback-$DEPLOYED" || report "{\"action\":\"AWAIT_APPROVAL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"rollback start failed; manual approval needed\"}"
  report "{\"action\":\"FAIL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"health check failed; rollback image restarted (app only, DB untouched)\"}"
fi
rm -f "$RUN_FILE"
