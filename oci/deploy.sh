#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/code/legends-booking-backend
npm ci --omit=dev
pm2 reload legends-api --update-env