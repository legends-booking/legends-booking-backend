#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."   # repo root, assuming package.json is there

npm ci --omit=dev
pm2 reload legends-api --update-env