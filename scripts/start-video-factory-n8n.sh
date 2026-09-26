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


LIVE_STAGE_B_V8_AUDIT_MARKER="/home/node/.n8n/.vf_stage_b_v8_live_structure_v1_logged"

if [ ! -f "$LIVE_STAGE_B_V8_AUDIT_MARKER" ]; then
  echo "[VF-LIVE-AUDIT] Exporting current active Stage B V8 structure..."
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/stage-b-v8-live.json"; then
    node scripts/inspect-workflow-structure.mjs "$INSPECT_DIR/stage-b-v8-live.json" STAGE_B_V8_LIVE
    touch "$LIVE_STAGE_B_V8_AUDIT_MARKER"
    echo "[VF-LIVE-AUDIT] Stage B V8 live structure inspection complete."
  else
    echo "[VF-LIVE-AUDIT] Stage B V8 live structure export failed; n8n will still start normally."
  fi
fi


HOTPATH_AUDIT_MARKER="/home/node/.n8n/.vf_stage_b_v8_hotpath_v1_logged"

if [ ! -f "$HOTPATH_AUDIT_MARKER" ]; then
  echo "[VF-HOTPATH] Exporting current active Stage B V8 hot path..."
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/stage-b-v8-hotpath.json"; then
    node scripts/inspect-stage-b-v8-hotpath.mjs "$INSPECT_DIR/stage-b-v8-hotpath.json"
    touch "$HOTPATH_AUDIT_MARKER"
    echo "[VF-HOTPATH] Stage B V8 hot-path inspection complete."
  else
    echo "[VF-HOTPATH] Stage B V8 hot-path export failed; n8n will still start normally."
  fi
fi


STAGE_B_V9_CANARY_MARKER="/home/node/.n8n/.vf_stage_b_v9_fast_warm_canary_imported"

if [ ! -f "$STAGE_B_V9_CANARY_MARKER" ]; then
  echo "[VF-V9] Building Stage B V9 fast-warm canary from live V8..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$SWAP_DIR/stage-b-v8-live-for-v9.json"; then
    node scripts/build-stage-b-v9-canary.mjs "$SWAP_DIR/stage-b-v8-live-for-v9.json" "$SWAP_DIR/stage-b-v9-canary.json"
    n8n import:workflow --input="$SWAP_DIR/stage-b-v9-canary.json"
    n8n publish:workflow --id=VfStageBV9Can01
    touch "$STAGE_B_V9_CANARY_MARKER"
    echo "[VF-V9] Stage B V9 canary imported and published."
  else
    echo "[VF-V9] Live V8 export failed; V9 canary was not imported."
  fi
else
  echo "[VF-V9] Stage B V9 canary already imported; skipping."
fi


STAGE_B_V9_PUBLISH_MARKER="/home/node/.n8n/.vf_stage_b_v9_fast_warm_canary_published"

if [ ! -f "$STAGE_B_V9_PUBLISH_MARKER" ]; then
  echo "[VF-V9] Publishing Stage B V9 canary..."
  if n8n publish:workflow --id=VfStageBV9Can01; then
    touch "$STAGE_B_V9_PUBLISH_MARKER"
    echo "[VF-V9] Stage B V9 canary published."
  else
    echo "[VF-V9] Stage B V9 canary publish failed; n8n will still start normally."
  fi
else
  echo "[VF-V9] Stage B V9 canary already published; skipping."
fi


STAGE_C_V3_CANARY_MARKER="/home/node/.n8n/.vf_stage_c_v3_fast_warm_canary_imported"
STAGE_C_V3_PUBLISH_MARKER="/home/node/.n8n/.vf_stage_c_v3_fast_warm_canary_published"

if [ ! -f "$STAGE_C_V3_CANARY_MARKER" ]; then
  echo "[VF-C-V3] Building Stage C V3 fast-warm canary from production Stage C..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$SWAP_DIR/stage-c-v2-live-for-v3.json"; then
    node scripts/build-stage-c-v3-canary.mjs "$SWAP_DIR/stage-c-v2-live-for-v3.json" "$SWAP_DIR/stage-c-v3-canary.json"
    n8n import:workflow --input="$SWAP_DIR/stage-c-v3-canary.json"
    touch "$STAGE_C_V3_CANARY_MARKER"
    echo "[VF-C-V3] Stage C V3 canary imported."
  else
    echo "[VF-C-V3] Production Stage C export failed; V3 canary was not imported."
  fi
else
  echo "[VF-C-V3] Stage C V3 canary already imported; skipping."
fi

if [ ! -f "$STAGE_C_V3_PUBLISH_MARKER" ]; then
  echo "[VF-C-V3] Publishing Stage C V3 canary..."
  if n8n publish:workflow --id=VfStageCV3Can01; then
    touch "$STAGE_C_V3_PUBLISH_MARKER"
    echo "[VF-C-V3] Stage C V3 canary published."
  else
    echo "[VF-C-V3] Stage C V3 canary publish failed; n8n will still start normally."
  fi
else
  echo "[VF-C-V3] Stage C V3 canary already published; skipping."
fi


STAGE_C_V4_CANARY_MARKER="/home/node/.n8n/.vf_stage_c_v4_20s_canary_imported"
STAGE_C_V4_PUBLISH_MARKER="/home/node/.n8n/.vf_stage_c_v4_20s_canary_published"

if [ ! -f "$STAGE_C_V4_CANARY_MARKER" ]; then
  echo "[VF-C-V4] Building Stage C V4 20s canary..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$SWAP_DIR/stage-c-v2-live-for-v4.json"; then
    node scripts/build-stage-c-v4-canary.mjs "$SWAP_DIR/stage-c-v2-live-for-v4.json" "$SWAP_DIR/stage-c-v4-canary.json"
    n8n import:workflow --input="$SWAP_DIR/stage-c-v4-canary.json"
    touch "$STAGE_C_V4_CANARY_MARKER"
    echo "[VF-C-V4] Stage C V4 canary imported."
  else
    echo "[VF-C-V4] Stage C export failed; V4 canary skipped."
  fi
else
  echo "[VF-C-V4] Stage C V4 canary already imported; skipping."
fi

if [ ! -f "$STAGE_C_V4_PUBLISH_MARKER" ]; then
  echo "[VF-C-V4] Publishing Stage C V4 canary..."
  if n8n publish:workflow --id=VfStageCV4Can01; then
    touch "$STAGE_C_V4_PUBLISH_MARKER"
    echo "[VF-C-V4] Stage C V4 canary published."
  else
    echo "[VF-C-V4] Stage C V4 publish failed; n8n will still start normally."
  fi
else
  echo "[VF-C-V4] Stage C V4 canary already published; skipping."
fi


STAGE_C_V3_PROD_MARKER="/home/node/.n8n/.vf_stage_c_v3_prod_25s_applied"

if [ ! -f "$STAGE_C_V3_PROD_MARKER" ]; then
  echo "[VF-C-PROD-V3] Applying guarded 25s warm-up to production Stage C..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$SWAP_DIR/stage-c-production-before-v3.json"; then
    node scripts/build-stage-c-v3-canary.mjs "$SWAP_DIR/stage-c-production-before-v3.json" "$SWAP_DIR/stage-c-production-v3.json" --production
    n8n import:workflow --input="$SWAP_DIR/stage-c-production-v3.json"
    n8n publish:workflow --id=FUp4QgPhLs4PBD2L
    touch "$STAGE_C_V3_PROD_MARKER"
    echo "[VF-C-PROD-V3] Production Stage C updated to 25s warm-up."
  else
    echo "[VF-C-PROD-V3] Production Stage C export failed; patch skipped."
  fi
else
  echo "[VF-C-PROD-V3] Production Stage C 25s warm-up already applied; skipping."
fi


STAGE_B_V9_PROD_MARKER="/home/node/.n8n/.vf_stage_b_v9_prod_fast_warm_applied"

if [ ! -f "$STAGE_B_V9_PROD_MARKER" ]; then
  echo "[VF-B-PROD-V9] Applying guarded V9 fast-warm patch to production Stage B..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$SWAP_DIR/stage-b-production-before-v9.json"; then
    node scripts/build-stage-b-v9-canary.mjs "$SWAP_DIR/stage-b-production-before-v9.json" "$SWAP_DIR/stage-b-production-v9.json" --production
    n8n import:workflow --input="$SWAP_DIR/stage-b-production-v9.json"
    n8n publish:workflow --id=HGAmd1Lp70DDVxyX
    touch "$STAGE_B_V9_PROD_MARKER"
    echo "[VF-B-PROD-V9] Production Stage B updated to V9 fast-warm."
  else
    echo "[VF-B-PROD-V9] Production Stage B export failed; patch skipped."
  fi
else
  echo "[VF-B-PROD-V9] Production Stage B V9 already applied; skipping."
fi


CANARY_CLEANUP_MARKER="/home/node/.n8n/.vf_post_promotion_canary_cleanup_v1"

if [ ! -f "$CANARY_CLEANUP_MARKER" ]; then
  echo "[VF-CLEANUP] Unpublishing promoted canary workflows to reduce runtime overhead..."
  ok=1
  n8n unpublish:workflow --id=VfStageBV9Can01 || ok=0
  n8n unpublish:workflow --id=VfStageCV3Can01 || ok=0
  n8n unpublish:workflow --id=VfStageCV4Can01 || ok=0

  if [ "$ok" -eq 1 ]; then
    touch "$CANARY_CLEANUP_MARKER"
    echo "[VF-CLEANUP] Canary workflows unpublished; production workflows remain published."
  else
    echo "[VF-CLEANUP] One or more canary unpublish commands failed; will retry next restart."
  fi
else
  echo "[VF-CLEANUP] Canary cleanup already applied; skipping."
fi


FINAL_PROD_AUDIT_MARKER="/home/node/.n8n/.vf_final_prod_audit_v1"

if [ ! -f "$FINAL_PROD_AUDIT_MARKER" ]; then
  echo "[VF-FINAL-AUDIT] Exporting final production B/C/D..."
  mkdir -p "$INSPECT_DIR/final-prod"
  n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/final-prod/stage-b.json"
  n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$INSPECT_DIR/final-prod/stage-c.json"
  n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/final-prod/stage-d.json"
  if node scripts/audit-final-production.mjs "$INSPECT_DIR/final-prod/stage-b.json" "$INSPECT_DIR/final-prod/stage-c.json" "$INSPECT_DIR/final-prod/stage-d.json"; then
    touch "$FINAL_PROD_AUDIT_MARKER"
    echo "[VF-FINAL-AUDIT] PASS"
  else
    echo "[VF-FINAL-AUDIT] FAIL"
  fi
fi


CODE_NODE_AUDIT_MARKER="/home/node/.n8n/.vf_prod_code_node_audit_v1"

if [ ! -f "$CODE_NODE_AUDIT_MARKER" ]; then
  echo "[VF-CODE-AUDIT] Exporting active production workflows for Code node audit..."
  mkdir -p "$INSPECT_DIR/code-audit"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/code-audit/stage-b.json" \
    && n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$INSPECT_DIR/code-audit/stage-c.json" \
    && n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/code-audit/stage-d.json"; then
    node scripts/audit-production-code-nodes.mjs \
      "$INSPECT_DIR/code-audit/stage-b.json" \
      "$INSPECT_DIR/code-audit/stage-c.json" \
      "$INSPECT_DIR/code-audit/stage-d.json"
    touch "$CODE_NODE_AUDIT_MARKER"
    echo "[VF-CODE-AUDIT] Production Code node audit complete."
  else
    echo "[VF-CODE-AUDIT] Export failed; n8n will still start normally."
  fi
fi


CODE_NODE_DETAIL_AUDIT_MARKER="/home/node/.n8n/.vf_prod_code_node_detail_audit_v1"

if [ ! -f "$CODE_NODE_DETAIL_AUDIT_MARKER" ]; then
  echo "[VF-CODE-DETAIL] Exporting production workflows for Code-node detail audit..."
  mkdir -p "$INSPECT_DIR/code-detail"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/code-detail/stage-b.json" \
    && n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/code-detail/stage-d.json"; then
    node scripts/audit-production-code-node-details.mjs \
      "$INSPECT_DIR/code-detail/stage-b.json" \
      "$INSPECT_DIR/code-detail/stage-d.json"
    touch "$CODE_NODE_DETAIL_AUDIT_MARKER"
    echo "[VF-CODE-DETAIL] Production Code-node detail audit complete."
  else
    echo "[VF-CODE-DETAIL] Export failed; n8n will still start normally."
  fi
fi


STAGE_B_V10_NOCODE_MARKER="/home/node/.n8n/.vf_stage_b_v10_nocode_canary_imported"

if [ ! -f "$STAGE_B_V10_NOCODE_MARKER" ]; then
  echo "[VF-B-V10] Building Stage B V10 no-code canary..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$SWAP_DIR/stage-b-prod-for-v10.json"; then
    node scripts/build-stage-b-v10-nocode-canary.mjs "$SWAP_DIR/stage-b-prod-for-v10.json" "$SWAP_DIR/stage-b-v10-nocode.json"
    n8n import:workflow --input="$SWAP_DIR/stage-b-v10-nocode.json"
    n8n publish:workflow --id=VfStageBV10Can01
    touch "$STAGE_B_V10_NOCODE_MARKER"
    echo "[VF-B-V10] Stage B V10 no-code canary imported and published."
  else
    echo "[VF-B-V10] Production Stage B export failed; canary skipped."
  fi
else
  echo "[VF-B-V10] Stage B V10 no-code canary already imported; skipping."
fi


STAGE_B_V10_PROD_MARKER="/home/node/.n8n/.vf_stage_b_v10_nocode_prod_applied"

if [ ! -f "$STAGE_B_V10_PROD_MARKER" ]; then
  echo "[VF-B-PROD-V10] Applying guarded no-code patch to production Stage B..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$SWAP_DIR/stage-b-production-before-v10.json"; then
    node scripts/build-stage-b-v10-nocode-canary.mjs "$SWAP_DIR/stage-b-production-before-v10.json" "$SWAP_DIR/stage-b-production-v10.json" --production
    n8n import:workflow --input="$SWAP_DIR/stage-b-production-v10.json"
    n8n publish:workflow --id=HGAmd1Lp70DDVxyX
    touch "$STAGE_B_V10_PROD_MARKER"
    echo "[VF-B-PROD-V10] Production Stage B updated to V10 no-code."
  else
    echo "[VF-B-PROD-V10] Production Stage B export failed; patch skipped."
  fi
else
  echo "[VF-B-PROD-V10] Production Stage B V10 already applied; skipping."
fi


STAGE_D_V2_NOCODE_MARKER="/home/node/.n8n/.vf_stage_d_v2_nocode_canary_imported"

if [ ! -f "$STAGE_D_V2_NOCODE_MARKER" ]; then
  echo "[VF-D-V2] Building Stage D V2 no-code canary..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=SDrtyhG2abJ3izco --output="$SWAP_DIR/stage-d-prod-for-v2.json"; then
    node scripts/build-stage-d-v2-nocode-canary.mjs "$SWAP_DIR/stage-d-prod-for-v2.json" "$SWAP_DIR/stage-d-v2-nocode.json"
    n8n import:workflow --input="$SWAP_DIR/stage-d-v2-nocode.json"
    n8n publish:workflow --id=VfStageDV2Can01
    touch "$STAGE_D_V2_NOCODE_MARKER"
    echo "[VF-D-V2] Stage D V2 no-code canary imported and published."
  else
    echo "[VF-D-V2] Production Stage D export failed; canary skipped."
  fi
else
  echo "[VF-D-V2] Stage D V2 no-code canary already imported; skipping."
fi

if [ -f "scripts/promote-stage-d-v2.sh" ]; then
  sh scripts/promote-stage-d-v2.sh || echo "[VF-D2] promotion helper failed; n8n will still start"
fi


FINAL_CODE_AUDIT_V2_MARKER="/home/node/.n8n/.vf_prod_code_node_audit_v2"

if [ ! -f "$FINAL_CODE_AUDIT_V2_MARKER" ]; then
  echo "[VF-CODE-AUDIT-V2] Exporting final production workflows..."
  mkdir -p "$INSPECT_DIR/code-audit-v2"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/code-audit-v2/stage-b.json" \
    && n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$INSPECT_DIR/code-audit-v2/stage-c.json" \
    && n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/code-audit-v2/stage-d.json"; then
    node scripts/audit-production-code-nodes.mjs \
      "$INSPECT_DIR/code-audit-v2/stage-b.json" \
      "$INSPECT_DIR/code-audit-v2/stage-c.json" \
      "$INSPECT_DIR/code-audit-v2/stage-d.json"
    touch "$FINAL_CODE_AUDIT_V2_MARKER"
    echo "[VF-CODE-AUDIT-V2] Final production Code-node audit complete."
  else
    echo "[VF-CODE-AUDIT-V2] Export failed; n8n will still start normally."
  fi
fi


STAGE_C_V5_ADAPTIVE_MARKER="/home/node/.n8n/.vf_stage_c_v5_adaptive_canary_imported"

if [ ! -f "$STAGE_C_V5_ADAPTIVE_MARKER" ]; then
  echo "[VF-C-V5] Building Stage C V5 adaptive-health canary..."
  mkdir -p "$SWAP_DIR"
  if n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$SWAP_DIR/stage-c-prod-for-v5.json"; then
    node scripts/build-stage-c-v5-adaptive-health-canary.mjs "$SWAP_DIR/stage-c-prod-for-v5.json" "$SWAP_DIR/stage-c-v5-adaptive.json"
    n8n import:workflow --input="$SWAP_DIR/stage-c-v5-adaptive.json"
    n8n publish:workflow --id=VfStageCV5Can01
    touch "$STAGE_C_V5_ADAPTIVE_MARKER"
    echo "[VF-C-V5] Stage C V5 adaptive-health canary imported and published."
  else
    echo "[VF-C-V5] Production Stage C export failed; canary skipped."
  fi
else
  echo "[VF-C-V5] Stage C V5 adaptive-health canary already imported; skipping."
fi

exec n8n start
