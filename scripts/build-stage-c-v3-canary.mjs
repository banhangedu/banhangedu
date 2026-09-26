import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile, mode] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);
const productionMode = mode === '--production';

const raw = JSON.parse(readFileSync(inputFile, 'utf8'));
const workflow = structuredClone(Array.isArray(raw) ? raw[0] : raw);

if (workflow.id !== 'FUp4QgPhLs4PBD2L') {
  throw new Error('Refusing Stage C V3 canary build: unexpected workflow id ' + workflow.id);
}

const byName = (name) => {
  const node = (workflow.nodes || []).find((n) => n.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
};

const webhook = byName('Stage C Webhook');
const wait = byName('Wait 45s for Render API Warm');
byName('Kick Render API');
byName('VF-C1 Build Render Request');
byName('VF-C2 Submit Render');
byName('VF-C3 Mark Render Submitted');
byName('Stage C Summary');

if (!productionMode) {
  workflow.id = 'VfStageCV3Can01';
  workflow.name = 'VF-MAIN-V1 STAGE C - V3 FAST WARM CANARY';
  workflow.active = true;
  webhook.parameters ||= {};
  webhook.parameters.path = 'vf-main-v1-stage-c-v3-canary';
}

// Conservative first optimization: observed Render API cold-start was ~20s.
// Keep a 25s guard rather than removing the wait entirely.
wait.parameters ||= {};
wait.parameters.amount = 25;

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log(productionMode ? '[VF-C-V3] Production Stage C 25s patch prepared' : '[VF-C-V3] Stage C V3 canary prepared');
console.log('[VF-C-V3] id=' + workflow.id);
console.log('[VF-C-V3] active=' + workflow.active);
console.log('[VF-C-V3] path=' + webhook.parameters.path);
console.log('[VF-C-V3] fixed_wait_seconds=' + wait.parameters.amount);
