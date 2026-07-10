#!/usr/bin/env bash
# Mac deploy watcher — bash + git + npm only (no extra installs).
#
# Watches origin/main for .deploy-ready. When Cloud Agent finishes work it
# commits that file; this script pulls, runs npm run deploy, then removes the tag.
#
# Start in background (run once per Mac):
#   cd ~/CodeProjects/1024
#   nohup bash scripts/mac-deploy-watcher.sh >> .deploy-watcher.log 2>&1 &
#   echo $! > .deploy-watcher.pid
#
# Stop:
#   kill "$(cat ~/CodeProjects/1024/.deploy-watcher.pid)"
#
# Env overrides:
#   DEPLOY_REPO=~/CodeProjects/1024
#   DEPLOY_BRANCH=main
#   DEPLOY_POLL_SEC=20

set -u

REPO="${DEPLOY_REPO:-$HOME/CodeProjects/1024}"
BRANCH="${DEPLOY_BRANCH:-main}"
INTERVAL="${DEPLOY_POLL_SEC:-20}"
TAG_FILE=".deploy-ready"
STATE_FILE=".deploy-watcher-last"
LOG_FILE=".deploy-watcher.log"

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line" >> "$REPO/$LOG_FILE"
  echo "$line"
}

read_remote_tag() {
  cd "$REPO" || return 1
  git fetch origin "$BRANCH" --quiet 2>/dev/null || return 1
  git show "origin/$BRANCH:$TAG_FILE" 2>/dev/null || true
}

read_local_tag() {
  if [[ -f "$REPO/$TAG_FILE" ]]; then
    cat "$REPO/$TAG_FILE"
  fi
}

read_last_done() {
  if [[ -f "$REPO/$STATE_FILE" ]]; then
    cat "$REPO/$STATE_FILE"
  fi
}

mark_done() {
  printf '%s' "$1" > "$REPO/$STATE_FILE"
}

clear_tag() {
  cd "$REPO" || return 1
  rm -f "$TAG_FILE"
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    git rm -f "$TAG_FILE" 2>/dev/null || true
    if ! git diff --cached --quiet 2>/dev/null; then
      git commit -m "chore: clear deploy tag" --quiet
      git push origin "$BRANCH" --quiet 2>/dev/null || log "warn: could not push tag removal (will retry later)"
    fi
  fi
}

run_deploy() {
  local tag="$1"
  log "deploy tag: $tag"
  cd "$REPO" || return 1
  log "git pull origin $BRANCH"
  if ! git pull origin "$BRANCH"; then
    log "error: git pull failed"
    return 1
  fi
  log "npm run deploy"
  if ! npm run deploy; then
    log "error: npm run deploy failed"
    return 1
  fi
  mark_done "$tag"
  clear_tag
  log "done: deploy finished, tag cleared"
  return 0
}

main() {
  if [[ ! -d "$REPO" ]]; then
    echo "Repo not found: $REPO" >&2
    exit 1
  fi
  log "watcher started repo=$REPO branch=$BRANCH interval=${INTERVAL}s"
  while true; do
    remote="$(read_remote_tag)"
    local="$(read_local_tag)"
    tag="${remote:-$local}"
    if [[ -n "$tag" ]]; then
      last="$(read_last_done)"
      if [[ "$tag" != "$last" ]]; then
        run_deploy "$tag" || log "deploy failed; will retry on next poll"
      fi
    fi
    sleep "$INTERVAL"
  done
}

main "$@"
