#!/usr/bin/env bash
# Deploy zeugnisvalidator to zeugnisvalidator.it.bzz.ch
# Syncs sources to the server and rebuilds the container there.
# Requires SSH access as the zeugnisvalidator user (see DEPLOYMENT.md).
set -euo pipefail

HOST=it.bzz.ch
USER=zeugnisvalidator
APP_DIR=/opt/zeugnisvalidator/app
SSH_KEY="${SSH_KEY:-$HOME/.ssh/maurizi.kevin}"

echo "==> Syncing sources to $USER@$HOST:$APP_DIR"
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .DS_Store \
  -e "ssh -i $SSH_KEY" \
  ./ "$USER@$HOST:$APP_DIR/"

echo "==> Rebuilding and restarting container"
# --force-recreate: `docker compose up -d` alone can keep the old container
# running when only the image content changed, silently shipping stale code.
ssh -i "$SSH_KEY" "$USER@$HOST" \
  "cd $APP_DIR && docker compose build && docker compose up -d --force-recreate && docker image prune -f"

echo "==> Smoke test"
sleep 2
curl -fsS -o /dev/null -w "https://zeugnisvalidator.it.bzz.ch -> HTTP %{http_code}\n" \
  https://zeugnisvalidator.it.bzz.ch/
