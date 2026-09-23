import { readFileSync, writeFileSync } from 'node:fs';

function load(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw[0] : raw;
}

function byName(workflow, name) {
  const node = (workflow.nodes || []).find((item) => item.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function setSingleConnection(workflow, from, to) {
  workflow.connections ||= {};
  workflow.connections[from] = {
    main: [[{ node: to, type: 'main', index: 0 }]]
  };
}

function offset(node, dx, dy = 0) {
  const [x, y] = Array.isArray(node.position) ? node.position : [0, 0];
  return [x + dx, y + dy];
}

function ensureAuthorization(node) {
  node.parameters ||= {};
  node.parameters.sendHeaders = true;
  node.parameters.headerParameters ||= { parameters: [] };
  node.parameters.headerParameters.parameters ||= [];
  const parameters = node.parameters.headerParameters.parameters;
  const exists = parameters.some((item) => String(item.name || '').toLowerCase() === 'authorization');
  if (!exists) {
    parameters.push({
      name: 'Authorization',
      value: "={{ 'Bearer ' + $env.VF_SERVICE_API_KEY }}"
    });
  }
}

const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);

const workflow = load(inputFile);

if (workflow.id !== 'tBMYELKUd0kfV4o2') {
  throw new Error('Refusing Stage B patch: unexpected workflow id ' + workflow.id);
}
if (workflow.active !== false) {
  throw new Error('Refusing Stage B patch: production Stage B must be inactive');
}
if ((workflow.nodes || []).some((node) => String(node.name || '').startsWith('VF-CANARY '))) {
  throw new Error('Refusing Stage B patch: canary nodes already present');
}

const attach = byName(workflow, 'Attach Source Visual Context');
const planner = byName(workflow, 'VF-06 Call Edit Planner');
byName(workflow, 'VF-07 Save Edit Plan');

ensureAuthorization(planner);

const prepare = {
  id: 'c4111111-1111-4111-8111-111111111111',
  name: 'VF-CANARY Prepare Assignment',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: offset(attach, 220, -120),
  parameters: {
    jsCode: `const planner_input = $json.planner_input;
if (!planner_input) throw new Error('VF_CANARY: planner_input missing');
return [{
  json: {
    planner_input,
    workspace_id: $env.VF_WORKSPACE_ID,
    experiment_id: String($env.VF_CANARY_EXPERIMENT_ID || '').trim() || null,
    video_job_id: planner_input.video_job_id
  }
}];`
  }
};

const resolve = {
  id: 'c4222222-2222-4222-8222-222222222222',
  name: 'VF-CANARY Resolve Assignment',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: offset(attach, 440, -120),
  parameters: {
    method: 'POST',
    url: "={{ $env.VF_EDIT_PLANNER_URL + '/v1/experiments/assignment/auto' }}",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Authorization', value: "={{ 'Bearer ' + $env.VF_SERVICE_API_KEY }}" }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ workspace_id: $json.workspace_id, experiment_id: $json.experiment_id, video_job_id: $json.video_job_id }) }}",
    options: { timeout: 12000 }
  }
};

const apply = {
  id: 'c4333333-3333-4333-8333-333333333333',
  name: 'VF-CANARY Apply Profile',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: offset(attach, 660, -120),
  parameters: {
    jsCode: `const prepared = $('VF-CANARY Prepare Assignment').item.json;
const response = $json || {};
const data = response.data || {};
const planner_input = structuredClone(prepared.planner_input);
planner_input.profile = {
  ...(planner_input.profile || {}),
  profile_key: data.profile_key || planner_input.profile?.profile_key || 'v1_transform'
};
return [{
  json: {
    ok: true,
    planner_input,
    analyzer_diagnostics: $('Attach Source Visual Context').item.json.analyzer_diagnostics || {},
    vf_canary: {
      eligible: Boolean(data.eligible),
      reason: data.reason || 'unknown',
      experiment_id: data.experiment_id || null,
      variant_key: data.assignment?.variant_key || null,
      profile_key: planner_input.profile.profile_key,
      automatic_promotion: false
    }
  }
}];`
  }
};

workflow.nodes.push(prepare, resolve, apply);
setSingleConnection(workflow, 'Attach Source Visual Context', prepare.name);
setSingleConnection(workflow, prepare.name, resolve.name);
setSingleConnection(workflow, resolve.name, apply.name);
setSingleConnection(workflow, apply.name, 'VF-06 Call Edit Planner');

workflow.name = 'VF-MAIN-V1 STAGE B - FIXED V7 CANARY SAFE';
workflow.active = false;

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));

console.log('[VF-SWAP] Stage B patch prepared');
console.log('[VF-SWAP] workflow_id=' + workflow.id);
console.log('[VF-SWAP] active=' + workflow.active);
console.log('[VF-SWAP] node_count=' + workflow.nodes.length);
console.log('[VF-SWAP] canary_nodes=' + workflow.nodes.filter((node) => String(node.name || '').startsWith('VF-CANARY ')).length);
