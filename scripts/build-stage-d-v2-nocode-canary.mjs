import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);

const raw = JSON.parse(readFileSync(inputFile, 'utf8'));
const workflow = structuredClone(Array.isArray(raw) ? raw[0] : raw);

if (workflow.id !== 'SDrtyhG2abJ3izco') throw new Error('Unexpected Stage D workflow');

const webhook = (workflow.nodes || []).find((node) => node.type === 'n8n-nodes-base.webhook');
const normalize = (workflow.nodes || []).find((node) => node.name === 'VF-D1 Normalize Render Result');

if (!webhook || !normalize) throw new Error('Stage D required nodes missing');
if (webhook.parameters?.path !== 'vf-main-v1-stage-d') throw new Error('Unexpected Stage D webhook');

workflow.id = 'VfStageDV2Can01';
workflow.name = 'VF-MAIN-V1 STAGE D - V2 NO-CODE CANARY';
workflow.active = true;
webhook.parameters.path = 'vf-main-v1-stage-d-v2-canary';

normalize.type = 'n8n-nodes-base.set';
normalize.typeVersion = 3.4;
normalize.parameters = {
  mode: 'raw',
  jsonOutput: "={{ ({ ok: true, pipeline: 'VF-MAIN-V1', stage: (($json.body || $json).event || 'unknown') === 'render.completed' ? 'completed' : 'render_failed_or_retrying', event: ($json.body || $json).event || 'unknown', video_job_id: ($json.body || $json).video_job_id || null, render_job_id: ($json.body || $json).render_job_id || null, final_mp4_url: ($json.body || $json).final_mp4_url || null, output_asset: ($json.body || $json).output_asset || null, metrics: ($json.body || $json).metrics || null, error: ($json.body || $json).error || null, occurred_at: ($json.body || $json).occurred_at || null, source_of_truth: 'supabase-render-callback', next_action: (($json.body || $json).event || 'unknown') === 'render.completed' ? 'READY_FOR_QC_OR_PUBLISH' : 'CHECK_DURABLE_QUEUE_RETRY_OR_DLQ' }) }}",
  options: {}
};

const codeNodes = (workflow.nodes || []).filter((node) => node.type === 'n8n-nodes-base.code');
if (codeNodes.length) throw new Error('Stage D V2 still has Code nodes');

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log('[VF-D-V2] prepared code_node_count=0');
