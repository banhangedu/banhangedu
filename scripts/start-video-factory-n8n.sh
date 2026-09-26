#!/bin/sh
set -eu

INSPECT_DIR="/tmp/vf-production-audit"
AUDIT_MARKER="/home/node/.n8n/.vf_final_prod_audit_v3"

echo "[VF-START] Video Factory production startup"

if [ -f "scripts/cleanup-promoted-canaries.sh" ]; then
  sh scripts/cleanup-promoted-canaries.sh || echo "[VF-CLEANUP-V3] helper failed; n8n will still start"
fi

if [ ! -f "$AUDIT_MARKER" ]; then
  echo "[VF-FINAL-AUDIT-V3] Exporting production B/C/D..."
  mkdir -p "$INSPECT_DIR"
  if n8n export:workflow --id=HGAmd1Lp70DDVxyX --output="$INSPECT_DIR/stage-b.json"     && n8n export:workflow --id=FUp4QgPhLs4PBD2L --output="$INSPECT_DIR/stage-c.json"     && n8n export:workflow --id=SDrtyhG2abJ3izco --output="$INSPECT_DIR/stage-d.json"     && node scripts/audit-final-production.mjs "$INSPECT_DIR/stage-b.json" "$INSPECT_DIR/stage-c.json" "$INSPECT_DIR/stage-d.json"; then
    touch "$AUDIT_MARKER"
    echo "[VF-FINAL-AUDIT-V3] PASS"
  else
    echo "[VF-FINAL-AUDIT-V3] FAIL; n8n will still start"
  fi
else
  echo "[VF-FINAL-AUDIT-V3] already passed; skipping"
fi

exec n8n start
