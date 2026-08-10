#!/usr/bin/env bash
#
# Start phone-relay on purpbox with Docker and Tailscale Funnel.
# Funnel runs in the background (--bg) so it survives the terminal session
# and restarts automatically with tailscaled.
#
# Usage: bash scripts/start-purpbox.sh
#

set -euo pipefail

cd "$(dirname "$0")/.."

# ---- sanity checks ---------------------------------------------------------
if ! command -v docker &>/dev/null; then
  echo "Error: docker is not installed on purpbox." >&2
  exit 1
fi

if ! command -v tailscale &>/dev/null; then
  echo "Error: tailscale is not installed on purpbox." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.example and fill in your secrets:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

# ---- start the relay -------------------------------------------------------
echo "==> Building/starting phone-relay container..."
docker compose up -d --build

# ---- expose via Tailscale Funnel -------------------------------------------
# Tailscale Funnel must be enabled on the tailnet (HTTPS + MagicDNS).
# --bg keeps it running after this script exits and restarts with tailscaled.
echo "==> Ensuring Tailscale Funnel is exposing public HTTPS port 10000 → local 10000..."
# Port 10000 is used instead of 443 because purpbox's default 443 Funnel
# endpoint is already proxying the Kimi bridge (127.0.0.1:8003), and 8443
# is already used by lucid-harness coordinator. Clobbering 443 would break
# ARC's brain chain (ARC_LLM_BASE_URL on Vercel).
# --https=10000 makes the public HTTPS port explicit.
tailscale funnel --bg --https=10000 10000

# ---- print reachable URL ---------------------------------------------------
FUNNEL_HOST="$(tailscale status --json 2>/dev/null | grep -o '"DNSName" *: *"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [[ -n "${FUNNEL_HOST}" ]]; then
  echo ""
  echo "==> phone-relay is running."
  echo "    Health:    http://localhost:10000/health"
  echo "    Funnel:    https://${FUNNEL_HOST}"
  echo "    ARC hook:  https://${FUNNEL_HOST}:10000/voice/arc/incoming   (HTTP POST)"
  echo ""
  echo "Set your Twilio number's 'A call comes in' webhook to:"
  echo "  https://${FUNNEL_HOST}:10000/voice/arc/incoming"
else
  echo ""
  echo "==> phone-relay is running on http://localhost:10000"
  echo "    Run 'tailscale funnel status' to see the public HTTPS URL."
fi
