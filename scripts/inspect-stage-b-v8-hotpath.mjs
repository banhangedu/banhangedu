import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2);
if (!file) process.exit(2);

const raw = JSON.parse(readFileSync(file, 'utf8'));
const workflow = Array.isArray(raw) ? raw[0] : raw;
const names = [
  'Kick Source Analyzer',
  'Kick Edit Planner',
  'Wait 60s for Services Warm',
  'Wait 15s for Stage A Release',
  'Build Planner Input',
  'VF-05 Source Analyzer',
  'VF-06 Call Edit Planner',
  'Safe Handoff to Stage C'
];

function safeUrl(value) {
  const s = String(value ?? '');
  if (!s) return null;
  const envs = [...s.matchAll(/\$env\.([A-Z0-9_]+)/g)].map(m => m[1]);
  return envs.length ? { kind: 'env_expression', env_keys: [...new Set(envs)] } : { kind: 'literal_or_expression' };
}

function sanitizeOptions(options = {}) {
  const out = {};
  for (const key of ['timeout','retry','maxTries','retryOnFail','response','redirect']) {
    if (Object.prototype.hasOwnProperty.call(options, key)) out[key] = options[key];
  }
  return out;
}

const map = new Map((workflow.nodes || []).map(n => [n.name, n]));
const result = {};
for (const name of names) {
  const n = map.get(name);
  if (!n) continue;
  result[name] = {
    type: n.type,
    amount: n.parameters?.amount ?? null,
    method: n.parameters?.method ?? 'GET',
    url: safeUrl(n.parameters?.url),
    options: sanitizeOptions(n.parameters?.options || {})
  };
}

console.log('[VF-HOTPATH] ' + JSON.stringify({
  workflow_id: workflow?.id || null,
  name: workflow?.name || null,
  nodes: result
}));
