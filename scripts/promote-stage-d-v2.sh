#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_stage_d_v2_prod_done"
TMP="/tmp/vf-stage-d-v2"

if [ -f "$MARKER" ]; then
  echo "[VF-D2] already applied"
  exit 0
fi

mkdir -p "$TMP"
n8n export:workflow --id=SDrtyhG2abJ3izco --output="$TMP/before.json"
node scripts/build-stage-d-v2-nocode-canary.mjs "$TMP/before.json" "$TMP/after.json" --production
n8n import:workflow --input="$TMP/after.json"
n8n publish:workflow --id=SDrtyhG2abJ3izco
touch "$MARKER"
echo "[VF-D2] production workflow updated"
