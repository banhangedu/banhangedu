#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_all_promoted_canaries_cleaned_v3"

if [ -f "$MARKER" ]; then
  echo "[VF-CLEANUP-V3] already applied"
  exit 0
fi

ok=1
for id in   VfStageBV9Can01   VfStageCV3Can01   VfStageCV4Can01   VfStageBV10Can01   VfStageDV2Can01   VfStageCV5Can01
do
  n8n unpublish:workflow --id="$id" || ok=0
done

if [ "$ok" -eq 1 ]; then
  touch "$MARKER"
  echo "[VF-CLEANUP-V3] all known promoted canaries unpublished"
else
  echo "[VF-CLEANUP-V3] cleanup incomplete; will retry next restart"
fi
