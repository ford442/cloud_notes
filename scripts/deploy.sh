#!/usr/bin/env bash
#
# Deploy the production build of cloud-notes to the VPS notes host.
#
# Nothing is hardcoded: host, user, path and credentials all come from the
# environment, so the same script runs locally (with your own SSH agent) and in
# GitHub Actions (with repository secrets). See README.md § Deployment.
#
# Required:
#   DEPLOY_HOST         SSH host, e.g. test.1ink.us
#   DEPLOY_USER         SSH user
#   DEPLOY_PATH         Absolute remote directory to sync into, e.g. /var/www/notes
#
# Optional:
#   DEPLOY_PORT         SSH port (default 22)
#   DEPLOY_SSH_KEY      Private key contents. If unset, an ssh-agent identity is used.
#   DEPLOY_KNOWN_HOSTS  Output of `ssh-keyscan -p <port> <host>`. If unset, the
#                       caller's ~/.ssh/known_hosts must already trust the host.
#   DEPLOY_SKIP_BUILD   Set to 1 to deploy an existing dist/ without rebuilding.
#   DEPLOY_DRY_RUN      Set to 1 to show what rsync would transfer, and stop.
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "error: $name is required but not set" >&2
    exit 2
  fi
}

require DEPLOY_HOST
require DEPLOY_USER
require DEPLOY_PATH

port="${DEPLOY_PORT:-22}"

if [[ "${DEPLOY_SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building (npm ci && npm run build)"
  npm ci
  npm run build
fi

for bin in rsync ssh; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: $bin is required but not installed" >&2
    exit 127
  fi
done

if [[ ! -d dist ]]; then
  echo "error: dist/ does not exist — run 'npm run build' first" >&2
  exit 1
fi

# Credentials live only in a private temp dir that is removed on exit.
ssh_dir="$(mktemp -d)"
chmod 700 "$ssh_dir"
cleanup() { rm -rf "$ssh_dir"; }
trap cleanup EXIT

ssh_opts=(-p "$port" -o BatchMode=yes)

if [[ -n "${DEPLOY_KNOWN_HOSTS:-}" ]]; then
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
  chmod 600 "$ssh_dir/known_hosts"
  ssh_opts+=(-o "UserKnownHostsFile=$ssh_dir/known_hosts" -o StrictHostKeyChecking=yes)
fi

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/id_deploy"
  chmod 600 "$ssh_dir/id_deploy"
  ssh_opts+=(-i "$ssh_dir/id_deploy" -o IdentitiesOnly=yes)
fi

rsync_flags=(-az --delete --human-readable
  --exclude '.git' --exclude '.git/**'
  --exclude '.DS_Store')

if [[ "${DEPLOY_DRY_RUN:-0}" == "1" ]]; then
  rsync_flags+=(--dry-run --itemize-changes)
  echo "==> Dry run: no files will be written to $DEPLOY_HOST"
fi

echo "==> Syncing dist/ -> ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync "${rsync_flags[@]}" \
  -e "ssh ${ssh_opts[*]}" \
  dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "==> Done"
