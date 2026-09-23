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
  throw new Error('Refusing Stage B V8 patch: unexpected workflow id ' + workflow.id);
}
if (workflow.active !== false) {
  throw new Error('Refusing Stage B V8 patch: production Stage B must be inactive');
}

const analyzer = byName(workflow, 'VF-05 Source Analyzer');
const planner = byName(workflow, 'VF-06 Call Edit Planner');
const prepare = byName(workflow, 'VF-CANARY Prepare Assignment');
const resolve = byName(workflow, 'VF-CANARY Resolve Assignment');
const apply = byName(workflow, 'VF-CANARY Apply Profile');

ensureAuthorization(analyzer);
ensureAuthorization(planner);

workflow.name = 'VF-MAIN-V1 STAGE B - FIXED V8 CANARY AUTH SAFE';
workflow.active = false;

writeFileSync(outputFile, JSON.stringify(workflow, null, 2));

const authCount = [analyzer, planner, resolve].filter((node) =>
  (node.parameters?.headerParameters?.parameters || []).some(
    (item) => String(item.name || '').toLowerCase() === 'authorization'
  )
).length;

console.log('[VF-SWAP-V8] Stage B V8 patch prepared');
console.log('[VF-SWAP-V8] workflow_id=' + workflow.id);
console.log('[VF-SWAP-V8] active=' + workflow.active);
console.log('[VF-SWAP-V8] node_count=' + workflow.nodes.length);
console.log('[VF-SWAP-V8] auth_nodes=' + authCount);
console.log('[VF-SWAP-V8] canary_nodes=' + [prepare, resolve, apply].length);
