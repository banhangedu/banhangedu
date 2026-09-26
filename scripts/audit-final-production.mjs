import { readFileSync } from 'node:fs';

const [bFile, cFile, dFile] = process.argv.slice(2);
if (!bFile || !cFile || !dFile) process.exit(2);

const load = (file) => {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw[0] : raw;
};

const b = load(bFile);
const c = load(cFile);
const d = load(dFile);

const node = (wf, name) => (wf.nodes || []).find((n) => n.name === name);
const codeCount = (wf) => (wf.nodes || []).filter((n) => n.type === 'n8n-nodes-base.code').length;

const cKick = node(c, 'Kick Render API');

const checks = {
  stage_b_id: b.id === 'HGAmd1Lp70DDVxyX',
  stage_b_webhook: node(b, 'Stage B Webhook')?.parameters?.path === 'vf-main-v1-stage-b',
  stage_b_wait60_removed: !node(b, 'Wait 60s for Services Warm'),
  stage_b_wait15_present: Number(node(b, 'Wait 15s for Stage A Release')?.parameters?.amount) === 15,
  stage_b_code_nodes_zero: codeCount(b) === 0,

  stage_c_id: c.id === 'FUp4QgPhLs4PBD2L',
  stage_c_webhook: node(c, 'Stage C Webhook')?.parameters?.path === 'vf-main-v1-stage-c',
  stage_c_fixed_wait_removed: !node(c, 'Wait 45s for Render API Warm'),
  stage_c_health_retry_enabled: cKick?.retryOnFail === true,
  stage_c_health_max_tries: Number(cKick?.maxTries) === 6,
  stage_c_health_retry_gap_ms: Number(cKick?.waitBetweenTries) === 5000,
  stage_c_code_nodes_zero: codeCount(c) === 0,

  stage_d_id: d.id === 'SDrtyhG2abJ3izco',
  stage_d_code_nodes_zero: codeCount(d) === 0
};

const ok = Object.values(checks).every(Boolean);

console.log('[VF-FINAL-AUDIT-V3] ' + JSON.stringify({
  ok,
  checks,
  stage_b_node_count: (b.nodes || []).length,
  stage_c_node_count: (c.nodes || []).length,
  stage_d_node_count: (d.nodes || []).length,
  total_code_nodes: codeCount(b) + codeCount(c) + codeCount(d)
}));

if (!ok) process.exit(1);
