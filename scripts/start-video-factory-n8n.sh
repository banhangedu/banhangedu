#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_canary_v1_imported"
WORKFLOW_DIR="$(pwd)/workflows/vf-canary"
STRUCTURE_MARKER="/home/node/.n8n/.vf_stage_structure_v1_logged"
PARAM_MARKER="/home/node/.n8n/.vf_selected_params_v1_logged"
INSPECT_DIR="/tmp/vf-structure"

if [ ! -f "$MARKER" ]; then
  echo "[VF] Importing Canary V1 sub-workflows..."
  n8n import:workflow --separate --input="$WORKFLOW_DIR"
  touch "$MARKER"
  echo "[VF] Canary V1 sub-workflows imported."
else
  echo "[VF] Canary V1 sub-workflows already imported; skipping."
fi

mkdir -p "$INSPECT_DIR"

if [ ! -f "$STRUCTURE_MARKER" ]; then
  echo "[VF] Exporting Stage B/D structure for safe canary patch planning..."
  if n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$INSPECT_DIR/stage-b.json"     && n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/stage-d.json"; then
    node scripts/inspect-workflow-structure.mjs "$INSPECT_DIR/stage-b.json" STAGE_B
    node scripts/inspect-workflow-structure.mjs "$INSPECT_DIR/stage-d.json" STAGE_D
    touch "$STRUCTURE_MARKER"
    echo "[VF] Stage B/D structure inspection complete."
  else
    echo "[VF] Stage B/D structure export failed; n8n will still start normally."
  fi
fi

if [ ! -f "$PARAM_MARKER" ]; then
  echo "[VF] Inspecting selected Stage B/D parameters with redaction..."
  if [ ! -f "$INSPECT_DIR/stage-b.json" ]; then
    n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$INSPECT_DIR/stage-b.json"
  fi
  if [ ! -f "$INSPECT_DIR/stage-d.json" ]; then
    n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/stage-d.json"
  fi
  if node scripts/inspect-selected-workflow-params.mjs "$INSPECT_DIR/stage-b.json" "$INSPECT_DIR/stage-d.json"; then
    touch "$PARAM_MARKER"
    echo "[VF] Selected parameter inspection complete."
  else
    echo "[VF] Selected parameter inspection failed; n8n will still start normally."
  fi
fi

exec n8n start
