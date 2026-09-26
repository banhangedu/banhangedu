import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile, mode] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);
const productionMode = mode === '--production';

const raw = JSON.parse(readFileSync(inputFile, 'utf8'));
const workflow = structuredClone(Array.isArray(raw) ? raw[0] : raw);

if (workflow.id !== 'HGAmd1Lp70DDVxyX') {
  throw new Error('Refusing V9 canary build: unexpected Stage B V8 id ' + workflow.id);
}

const byName = (name) => {
  const node = (workflow.nodes || []).find((n) => n.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
};

byName('Kick Source Analyzer');
byName('Kick Edit Planner');
byName('Wait 60s for Services Warm');
byName('Wait 15s for Stage A Release');
byName('Build Planner Input');
byName('VF-05 Source Analyzer');
byName('VF-06 Call Edit Planner');
byName('Safe Handoff to Stage C');

const webhook = byName('Stage B Webhook');
webhook.parameters ||= {};

if (productionMode) {
  if (webhook.parameters.path !== 'vf-main-v1-stage-b') {
    throw new Error('Refusing production V9 patch: unexpected webhook path ' + webhook.parameters.path);
  }
} else {
  workflow.id = 'VfStageBV9Can01';
  workflow.name = 'VF-MAIN-V1 STAGE B - V9 FAST WARM CANARY';
  workflow.active = true;
  webhook.parameters.path = 'vf-main-v1-stage-b-v9-canary';
}

workflow.nodes = (workflow.nodes || []).filter((n) => n.name !== 'Wait 60s for Services Warm');
workflow.connections ||= {};
workflow.connections['Kick Edit Planner'] = {
  main: [[{ node: 'Wait 15s for Stage A Release', type: 'main', index: 0 }]]
};
delete workflow.connections['Wait 60s for Services Warm'];

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log(productionMode ? '[VF-V9] Production Stage B V9 patch prepared' : '[VF-V9] Stage B V9 canary prepared');
console.log('[VF-V9] id=' + workflow.id);
console.log('[VF-V9] active=' + workflow.active);
console.log('[VF-V9] path=' + webhook.parameters.path);
console.log('[VF-V9] node_count=' + workflow.nodes.length);
console.log('[VF-V9] fixed_wait_seconds=15');
