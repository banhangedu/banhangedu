import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);

const raw = JSON.parse(readFileSync(inputFile, 'utf8'));
const workflow = structuredClone(Array.isArray(raw) ? raw[0] : raw);

if (workflow.id !== 'FUp4QgPhLs4PBD2L') {
  throw new Error('Unexpected Stage C workflow id: ' + workflow.id);
}

const byName = (name) => {
  const node = (workflow.nodes || []).find((n) => n.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
};

const webhook = byName('Stage C Webhook');
const wait = byName('Wait 45s for Render API Warm');

workflow.id = 'VfStageCV4Can01';
workflow.name = 'VF-MAIN-V1 STAGE C - V4 20S WARM CANARY';
workflow.active = true;

webhook.parameters ||= {};
webhook.parameters.path = 'vf-main-v1-stage-c-v4-canary';

wait.parameters ||= {};
wait.parameters.amount = 20;

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log('[VF-C-V4] prepared');
console.log('[VF-C-V4] fixed_wait_seconds=20');
