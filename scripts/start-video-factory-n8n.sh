#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_canary_v1_imported"
WORKFLOW_DIR="$(pwd)/workflows/vf-canary"

if [ ! -f "$MARKER" ]; then
  echo "[VF] Importing Canary V1 sub-workflows..."
  n8n import:workflow --separate --input="$WORKFLOW_DIR"
  touch "$MARKER"
  echo "[VF] Canary V1 sub-workflows imported."
else
  echo "[VF] Canary V1 sub-workflows already imported; skipping."
fi

exec n8n start
