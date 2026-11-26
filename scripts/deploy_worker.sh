#!/bin/bash
# Deploy the Bugmelder worker with the values from ~/.config/pixel-map/report.env (never from Git).
# Prints the worker URL; put it and the Turnstile site key into config/<city>.json under "report".
set -euo pipefail
ENV=~/.config/pixel-map/report.env
set -a; source "$ENV"; set +a
for v in CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN TURNSTILE_SECRET_KEY GITHUB_REPORT_TOKEN GITHUB_REPORT_REPO; do
  [ -n "${!v:-}" ] || { echo "fehlt in $ENV: $v"; exit 1; }
done
cd "$(dirname "$0")/../worker"
W="timeout 300 npx --yes wrangler@4"
$W deploy 2>&1 | grep -E "https://|Uploaded|Error" || true
printf %s "$GITHUB_REPORT_TOKEN"  | $W secret put GITHUB_TOKEN     >/dev/null
printf %s "$GITHUB_REPORT_REPO"   | $W secret put GITHUB_REPO      >/dev/null
printf %s "$TURNSTILE_SECRET_KEY" | $W secret put TURNSTILE_SECRET >/dev/null
echo "Secrets gesetzt."
