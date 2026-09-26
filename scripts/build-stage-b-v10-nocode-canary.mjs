import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile, mode] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);
const productionMode = mode === '--production';

const raw = JSON.parse(readFileSync(inputFile, 'utf8'));
const workflow = structuredClone(Array.isArray(raw) ? raw[0] : raw);

if (workflow.id !== 'HGAmd1Lp70DDVxyX') throw new Error('Unexpected Stage B workflow id');

const byName = (name) => {
  const n = (workflow.nodes || []).find((x) => x.name === name);
  if (!n) throw new Error('Missing node: ' + name);
  return n;
};

const webhook = byName('Stage B Webhook');
const attach = byName('Attach Source Visual Context');
const prepare = byName('VF-CANARY Prepare Assignment');
const resolve = byName('VF-CANARY Resolve Assignment');
const apply = byName('VF-CANARY Apply Profile');

if (webhook.parameters?.path !== 'vf-main-v1-stage-b') throw new Error('Unexpected webhook path');
if ((workflow.nodes || []).some((n) => n.name === 'Wait 60s for Services Warm')) throw new Error('Expected V9 baseline');

if (!productionMode) {
  workflow.id = 'VfStageBV10Can01';
  workflow.name = 'VF-MAIN-V1 STAGE B - V10 NO-CODE CANARY';
  workflow.active = true;
  webhook.parameters.path = 'vf-main-v1-stage-b-v10-canary';
}

attach.type = 'n8n-nodes-base.set';
attach.typeVersion = 3.4;
attach.parameters = {
  mode: 'raw',
  jsonOutput: "={{ ({ ok: true, planner_input: { ...$('Build Planner Input').item.json.planner_input, contract_version: '1.1.1', source_visual_context: $('VF-05 Source Analyzer').item.json.data.source_visual_context }, analyzer_diagnostics: $('VF-05 Source Analyzer').item.json.data.diagnostics || {} }) }}",
  options: {}
};

workflow.nodes = (workflow.nodes || []).filter((n) => n.name !== prepare.name);
workflow.connections ||= {};
workflow.connections[attach.name] = { main: [[{ node: resolve.name, type: 'main', index: 0 }]] };
delete workflow.connections[prepare.name];

resolve.parameters ||= {};
resolve.parameters.jsonBody = "={{ JSON.stringify({ workspace_id: $env.VF_WORKSPACE_ID, experiment_id: String($env.VF_CANARY_EXPERIMENT_ID || '').trim() || null, video_job_id: $('Attach Source Visual Context').item.json.planner_input.video_job_id }) }}";

apply.type = 'n8n-nodes-base.set';
apply.typeVersion = 3.4;
apply.parameters = {
  mode: 'raw',
  jsonOutput: "={{ ({ ok: true, planner_input: { ...$('Attach Source Visual Context').item.json.planner_input, profile: { ...( $('Attach Source Visual Context').item.json.planner_input.profile || {} ), profile_key: ($json.data || {}).profile_key || $('Attach Source Visual Context').item.json.planner_input.profile?.profile_key || 'v1_transform' } }, analyzer_diagnostics: $('Attach Source Visual Context').item.json.analyzer_diagnostics || {}, vf_canary: { eligible: Boolean(($json.data || {}).eligible), reason: ($json.data || {}).reason || 'unknown', experiment_id: ($json.data || {}).experiment_id || null, variant_key: (($json.data || {}).assignment || {}).variant_key || null, profile_key: ($json.data || {}).profile_key || $('Attach Source Visual Context').item.json.planner_input.profile?.profile_key || 'v1_transform', automatic_promotion: false } }) }}",
  options: {}
};

const codes = (workflow.nodes || []).filter((n) => n.type === 'n8n-nodes-base.code');
if (codes.length) throw new Error('Code nodes remain: ' + codes.map((n) => n.name).join(', '));

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log(productionMode ? '[VF-B-V10] production patch prepared code_node_count=0' : '[VF-B-V10] prepared code_node_count=0');
