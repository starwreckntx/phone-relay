#!/usr/bin/env bash
#
# Stop phone-relay on purpbox.
# This stops the Docker container but leaves Tailscale Funnel configured.
# To also remove the public HTTPS endpoint, run:
#   tailscale funnel 10000 off
#
# Usage: bash scripts/stop-purpbox.sh
#

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Stopping phone-relay container..."
docker compose down

echo "==> Done. Tailscale Funnel is still configured; run 'tailscale funnel 3000 off' to disable it."
