#!/bin/sh
set -eu

MARKER="/home/node/.n8n/.vf_canary_v1_imported"
WORKFLOW_DIR="$(pwd)/workflows/vf-canary"
STRUCTURE_MARKER="/home/node/.n8n/.vf_stage_structure_v1_logged"
PARAM_MARKER="/home/node/.n8n/.vf_selected_params_v1_logged"
PREVIEW_MARKER="/home/node/.n8n/.vf_canary_preview_v1_imported"
STAGE_B_SWAP_MARKER="/home/node/.n8n/.vf_stage_b_canary_v1_swapped"
ACTIVE_AUDIT_MARKER="/home/node/.n8n/.vf_active_state_audit_v1_logged"
TRIGGER_AUDIT_MARKER="/home/node/.n8n/.vf_stage_b_trigger_audit_v1_logged"
STAGE_B_V8_SWAP_MARKER="/home/node/.n8n/.vf_stage_b_v8_analyzer_auth_swapped"
INSPECT_DIR="/tmp/vf-structure"
PREVIEW_DIR="/tmp/vf-canary-preview"
SWAP_DIR="/tmp/vf-canary-swap"

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

if [ ! -f "$PREVIEW_MARKER" ]; then
  mkdir -p "$PREVIEW_DIR"
  echo "[VF] Building inactive Canary Stage B/D preview clones..."
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$INSPECT_DIR/stage-b-preview-source.json"
  n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/stage-d-preview-source.json"
  node scripts/build-canary-preview-workflows.mjs     "$INSPECT_DIR/stage-b-preview-source.json"     "$INSPECT_DIR/stage-d-preview-source.json"     "$PREVIEW_DIR"
  n8n import:workflow --separate --input="$PREVIEW_DIR"
  touch "$PREVIEW_MARKER"
  echo "[VF] Inactive Canary preview clones imported; production workflows unchanged."
else
  echo "[VF] Canary preview clones already imported; skipping."
fi

if [ ! -f "$STAGE_B_SWAP_MARKER" ]; then
  mkdir -p "$SWAP_DIR"
  echo "[VF-SWAP] Exporting inactive production Stage B for guarded Canary patch..."
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$SWAP_DIR/stage-b-current.json"
  node scripts/patch-stage-b-canary-in-place.mjs     "$SWAP_DIR/stage-b-current.json"     "$SWAP_DIR/stage-b-canary.json"
  n8n import:workflow --input="$SWAP_DIR/stage-b-canary.json"
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$SWAP_DIR/stage-b-verify.json"
  node scripts/inspect-workflow-structure.mjs "$SWAP_DIR/stage-b-verify.json" STAGE_B_CANARY_VERIFY
  touch "$STAGE_B_SWAP_MARKER"
  echo "[VF-SWAP] Stage B Canary patch imported and left inactive for verification."
else
  echo "[VF-SWAP] Stage B Canary patch already imported; skipping."
fi

if [ ! -f "$ACTIVE_AUDIT_MARKER" ]; then
  echo "[VF-ACTIVE-AUDIT] Exporting Stage B/C/D active states..."
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$INSPECT_DIR/stage-b-active-audit.json"
  n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$INSPECT_DIR/stage-c-active-audit.json"
  n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/stage-d-active-audit.json"
  node scripts/audit-active-workflows.mjs     STAGE_B "$INSPECT_DIR/stage-b-active-audit.json"     STAGE_C "$INSPECT_DIR/stage-c-active-audit.json"     STAGE_D "$INSPECT_DIR/stage-d-active-audit.json"
  touch "$ACTIVE_AUDIT_MARKER"
  echo "[VF-ACTIVE-AUDIT] Audit complete."
fi

if [ ! -f "$TRIGGER_AUDIT_MARKER" ]; then
  echo "[VF-TRIGGER-AUDIT] Exporting current Stage B trigger metadata..."
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$INSPECT_DIR/stage-b-trigger-audit.json"
  node scripts/inspect-stage-b-trigger.mjs "$INSPECT_DIR/stage-b-trigger-audit.json"
  touch "$TRIGGER_AUDIT_MARKER"
  echo "[VF-TRIGGER-AUDIT] Audit complete."
fi

if [ ! -f "$STAGE_B_V8_SWAP_MARKER" ]; then
  mkdir -p "$SWAP_DIR"
  echo "[VF-SWAP-V8] Exporting production Stage B for guarded V8 auth patch..."
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$SWAP_DIR/stage-b-v7-current.json"
  node scripts/patch-stage-b-v8-analyzer-auth.mjs     "$SWAP_DIR/stage-b-v7-current.json"     "$SWAP_DIR/stage-b-v8.json"
  n8n import:workflow --input="$SWAP_DIR/stage-b-v8.json"
  n8n export:workflow --id=tBMYELKUd0kfV4o2 --output="$SWAP_DIR/stage-b-v8-verify.json"
  node scripts/inspect-workflow-structure.mjs "$SWAP_DIR/stage-b-v8-verify.json" STAGE_B_V8_VERIFY
  touch "$STAGE_B_V8_SWAP_MARKER"
  echo "[VF-SWAP-V8] Stage B V8 auth patch imported and left inactive."
else
  echo "[VF-SWAP-V8] Stage B V8 auth patch already imported; skipping."
fi

exec n8n start
