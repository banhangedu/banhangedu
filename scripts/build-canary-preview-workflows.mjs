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

function patchStageB(workflow) {
  const source = structuredClone(workflow);
  source.id = 'VfStageBCanaryPreview1';
  source.name = 'VF-MAIN-V1 STAGE B - CANARY PREVIEW V1';
  source.active = false;

  const attach = byName(source, 'Attach Source Visual Context');
  const planner = byName(source, 'VF-06 Call Edit Planner');
  ensureAuthorization(planner);

  const prepare = {
    id: 'c1111111-1111-4111-8111-111111111111',
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
    id: 'c2222222-2222-4222-8222-222222222222',
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
    id: 'c3333333-3333-4333-8333-333333333333',
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

  source.nodes.push(prepare, resolve, apply);
  setSingleConnection(source, 'Attach Source Visual Context', prepare.name);
  setSingleConnection(source, prepare.name, resolve.name);
  setSingleConnection(source, resolve.name, apply.name);
  setSingleConnection(source, apply.name, 'VF-06 Call Edit Planner');

  return source;
}

function patchStageD(workflow) {
  const source = structuredClone(workflow);
  source.id = 'VfStageDCanaryPreview1';
  source.name = 'VF-MAIN-V1 STAGE D - CANARY PREVIEW V1';
  source.active = false;

  const normalize = byName(source, 'VF-D1 Normalize Render Result');
  byName(source, 'Stage D Summary');

  const prepare = {
    id: 'd1111111-1111-4111-8111-111111111111',
    name: 'VF-CANARY Prepare Outcome',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: offset(normalize, 240, -120),
    parameters: {
      jsCode: `const result = $json || {};
return [{
  json: {
    workspace_id: $env.VF_WORKSPACE_ID,
    experiment_id: String($env.VF_CANARY_EXPERIMENT_ID || '').trim() || null,
    video_job_id: result.video_job_id || null,
    render_success: result.event === 'render.completed',
    metrics: result.metrics || {}
  }
}];`
    }
  };

  const record = {
    id: 'd2222222-2222-4222-8222-222222222222',
    name: 'VF-CANARY Record Outcome',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: offset(normalize, 480, -120),
    parameters: {
      method: 'POST',
      url: "={{ $env.VF_EDIT_PLANNER_URL + '/v1/experiments/outcomes/auto' }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: "={{ 'Bearer ' + $env.VF_SERVICE_API_KEY }}" }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify($json) }}",
      options: { timeout: 12000 }
    }
  };

  const restore = {
    id: 'd3333333-3333-4333-8333-333333333333',
    name: 'VF-CANARY Restore Render Result',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: offset(normalize, 720, -120),
    parameters: {
      jsCode: `const normalized = $('VF-D1 Normalize Render Result').item.json;
const response = $json || {};
return [{
  json: {
    ...normalized,
    vf_canary_outcome: {
      recorded: Boolean(response.data?.recorded),
      reason: response.data?.reason || 'unknown',
      variant_key: response.data?.variant_key || null,
      automatic_promotion: false
    }
  }
}];`
    }
  };

  source.nodes.push(prepare, record, restore);
  setSingleConnection(source, 'VF-D1 Normalize Render Result', prepare.name);
  setSingleConnection(source, prepare.name, record.name);
  setSingleConnection(source, record.name, restore.name);
  setSingleConnection(source, restore.name, 'Stage D Summary');

  return source;
}

const [stageBFile, stageDFile, outputDir] = process.argv.slice(2);
if (!stageBFile || !stageDFile || !outputDir) process.exit(2);

const stageB = patchStageB(load(stageBFile));
const stageD = patchStageD(load(stageDFile));

writeFileSync(outputDir + '/VF-STAGE-B-CANARY-PREVIEW-V1.json', JSON.stringify(stageB, null, 2));
writeFileSync(outputDir + '/VF-STAGE-D-CANARY-PREVIEW-V1.json', JSON.stringify(stageD, null, 2));

console.log('[VF-PREVIEW] Stage B clone nodes=' + stageB.nodes.length + ' active=' + stageB.active);
console.log('[VF-PREVIEW] Stage D clone nodes=' + stageD.nodes.length + ' active=' + stageD.active);
console.log('[VF-PREVIEW] Production workflow IDs were not modified.');
