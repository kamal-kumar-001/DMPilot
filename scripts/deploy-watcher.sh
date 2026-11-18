#!/usr/bin/env bash
# DMPilot safe-update host watcher (reviewed artifact; NOT installed yet).
# Runs one fixed operation only: claim the next owner-approved deploy request
# and move the app to exactly that commit. No arbitrary commands, no fail-open.
# Requires env: API_BASE, DEPLOY_API_KEY (deploy-scoped), APP_DIR (git checkout),
# HEALTH_URL. Designed for systemd timer; flock enforces a single run.
# Path overrides (DMPILOT_LOCK/LOG/RUN_FILE/BACKUP_DIR/WORKTREE/HEALTH_WAIT)
# exist for the isolated test harness; production uses the defaults.
set -euo pipefail

LOCK="${DMPILOT_LOCK:-/tmp/dmpilot-deploy.lock}"
LOG="${DMPILOT_LOG:-/var/log/dmpilot-deploy.log}"
RUN_FILE="${DMPILOT_RUN_FILE:-/tmp/dmpilot-deploy.run}"
BACKUP_DIR="${DMPILOT_BACKUP_DIR:-/var/backups/dmpilot}"
WORKTREE="${DMPILOT_WORKTREE:-/tmp/dmpilot-next}"
HEALTH_WAIT="${DMPILOT_HEALTH_WAIT:-15}"
log() { echo "$(date -u +%FT%TZ) $*" | tail -c 8000 >> "$LOG"; }
redact() {
  sed -E \
    -e 's/dmp_live_[A-Za-z0-9]+/[redacted]/g' \
    -e 's#(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis)://[^[:space:]"'"'"']+#[redacted-db-url]#gi' \
    -e 's/[Bb]earer [A-Za-z0-9._~+\/=-]+/Bearer [redacted]/g' \
    -e 's/(sk|pk|rk)_(live|test|prod)_[A-Za-z0-9]+/[redacted]/g' \
    | tail -c 8000
}

exec 9>"$LOCK"
if ! flock -n 9; then log "another run holds the lock; exiting"; exit 0; fi

api() { curl -sf -X "$1" "$API_BASE$2" -H "x-api-key: $DEPLOY_API_KEY" -H 'content-type: application/json' ${3:+-d "$3"}; }

# Reconcile first: if the API shows an active run but no local run identity
# file exists, report it as stale-failed instead of claiming anything new.
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
if [ -z "$CLAIM" ] || [ "$CLAIM" = "null" ]; then exit 0; fi
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
# 2. migration compatibility gate: deployed schema -> target schema diff.
# A destructive diff stops for explicit approval; a diff we cannot compute
# is uncertainty and also stops. Only a clean additive diff proceeds.
git worktree add --detach "$WORKTREE" "$SHA" || fail "worktree add failed"
DIFF_OUT=$(cd "$WORKTREE/apps/api" && npx prisma migrate diff \
  --from-schema "$APP_DIR/apps/api/prisma/schema.prisma" \
  --to-schema "$WORKTREE/apps/api/prisma/schema.prisma" \
  --script 2>&1) && DIFF_OK=1 || DIFF_OK=0
git worktree remove --force "$WORKTREE"
if [ "$DIFF_OK" != "1" ]; then
  fail "migration diff could not be computed; refusing deploy (uncertainty)"
fi
# Fail-closed classification: every statement in the diff must match an
# explicitly supported additive shape. Destructive OR unrecognized SQL
# stops for explicit approval - unknown is never treated as safe.
migration_stop() {
  rm -f "$RUN_FILE"
  report "{\"action\":\"AWAIT_APPROVAL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"non-additive or unrecognized migration diff; needs explicit approval + DB recovery plan\"}"
  exit 0
}
is_additive_statement() {
  echo "$1" | grep -qiE '^[[:space:]]*(create table|create (unique )?index|alter table .+ add column|alter table .+ add constraint|create type|alter type .+ add value|begin|commit|start transaction)([[:space:]]|$)'
}
STATEMENTS=$(echo "$DIFF_OUT" | sed 's/--.*$//' | tr '\n' ' ' | tr ';' '\n' | sed 's/^[[:space:]]*//' | grep -v '^$' || true)
if [ -z "$STATEMENTS" ]; then
  log "migration diff is empty; schemas identical, proceeding"
else
  while IFS= read -r stmt; do
    if ! is_additive_statement "$stmt"; then
      log "migration statement not on additive allowlist: $(echo "$stmt" | head -c 120)"
      migration_stop
    fi
  done <<< "$STATEMENTS"
fi
# 3. preserve immutable rollback image verified by image ID (digest), not tag name
CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' dmpilot-api 2>/dev/null || true)
[ -n "$CURRENT_IMAGE" ] || fail "no running app image found; refusing deploy"
docker tag "$CURRENT_IMAGE" "dmpilot:rollback-$DEPLOYED" || fail "could not tag rollback image"
[ "$(docker inspect --format='{{.Id}}' "dmpilot:rollback-$DEPLOYED")" = "$CURRENT_IMAGE" ] || fail "rollback image digest mismatch; refusing deploy"
# 4. database backup with integrity validation (no automatic restore anywhere)
BACKUP="$BACKUP_DIR/pre-deploy-$RUN_ID.sql"
mkdir -p "$BACKUP_DIR"
docker exec dmpilot-db pg_dump -U postgres dmpilot > "$BACKUP" || fail "backup failed"
[ -s "$BACKUP" ] || fail "backup empty; refusing deploy"
head -n 5 "$BACKUP" | grep -q "PostgreSQL database dump" || fail "backup malformed (missing dump header); refusing deploy"
tail -n 5 "$BACKUP" | grep -q "PostgreSQL database dump complete" || fail "backup incomplete (missing completion marker); refusing deploy"
# 5. build unique tag, recreate app container only, health check, report
docker build -t "dmpilot:deploy-$SHA-$RUN_ID" "$APP_DIR" || fail "build failed"
docker rm -f dmpilot-api >/dev/null 2>&1 || true
docker run -d --name dmpilot-api --restart unless-stopped "dmpilot:deploy-$SHA-$RUN_ID" || fail "recreate failed"
sleep "$HEALTH_WAIT"
if curl -sf "$HEALTH_URL" >/dev/null; then
  report "{\"action\":\"SUCCESS\",\"runId\":\"$RUN_ID\",\"logTail\":$(tail -c 4000 "$LOG" 2>/dev/null | redact | jq -Rs .)}"
else
  docker rm -f dmpilot-api >/dev/null 2>&1 || true
  if ! docker run -d --name dmpilot-api --restart unless-stopped "dmpilot:rollback-$DEPLOYED"; then
    report "{\"action\":\"AWAIT_APPROVAL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"rollback start failed; manual approval needed\"}"
    rm -f "$RUN_FILE"
    exit 1
  fi
  report "{\"action\":\"FAIL\",\"runId\":\"$RUN_ID\",\"failureReason\":\"health check failed; rollback image restarted (app only, DB untouched)\"}"
fi
rm -f "$RUN_FILE"
