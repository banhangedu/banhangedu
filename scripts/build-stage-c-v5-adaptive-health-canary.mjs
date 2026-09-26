import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, outputFile, mode] = process.argv.slice(2);
if (!inputFile || !outputFile) process.exit(2);
const productionMode = mode === '--production';

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
const kick = byName('Kick Render API');
const wait = byName('Wait 45s for Render API Warm');
byName('VF-C1 Build Render Request');

if (webhook.parameters?.path !== 'vf-main-v1-stage-c') {
  throw new Error('Unexpected Stage C production webhook path');
}

if (!productionMode) {
  workflow.id = 'VfStageCV5Can01';
  workflow.name = 'VF-MAIN-V1 STAGE C - V5 ADAPTIVE HEALTH CANARY';
  workflow.active = true;
  webhook.parameters.path = 'vf-main-v1-stage-c-v5-canary';
}

// Reuse the existing health-kick request, but make readiness explicit:
// retry up to 6 times with a 5s gap, so a warm API proceeds immediately
// while a cold free service gets ~25s additional recovery budget.
kick.retryOnFail = true;
kick.maxTries = 6;
kick.waitBetweenTries = 5000;
kick.onError = 'stopWorkflow';
kick.parameters ||= {};
kick.parameters.options ||= {};
kick.parameters.options.timeout = 10000;

workflow.nodes = (workflow.nodes || []).filter((n) => n.name !== wait.name);
workflow.connections ||= {};
workflow.connections[kick.name] = {
  main: [[{ node: 'VF-C1 Build Render Request', type: 'main', index: 0 }]]
};
delete workflow.connections[wait.name];

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));
console.log(productionMode ? '[VF-C-V5] production adaptive-health patch prepared' : '[VF-C-V5] adaptive health canary prepared');
console.log('[VF-C-V5] fixed_wait_seconds=0');
console.log('[VF-C-V5] health_max_tries=6');
console.log('[VF-C-V5] health_retry_gap_ms=5000');
