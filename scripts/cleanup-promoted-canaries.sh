#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_promoted_nocode_canaries_cleaned"

if [ -f "$MARKER" ]; then
  echo "[VF-CLEANUP-V2] already applied"
  exit 0
fi

ok=1
n8n unpublish:workflow --id=VfStageBV10Can01 || ok=0
n8n unpublish:workflow --id=VfStageDV2Can01 || ok=0

if [ "$ok" -eq 1 ]; then
  touch "$MARKER"
  echo "[VF-CLEANUP-V2] promoted no-code canaries unpublished"
else
  echo "[VF-CLEANUP-V2] cleanup incomplete; will retry next restart"
fi
