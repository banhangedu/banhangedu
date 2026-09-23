import { readFileSync } from 'node:fs';

function redact(value) {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer <redacted>')
      .replace(/https?:\/\/[^\s"']+/gi, '<url>')
      .replace(/[A-Za-z0-9_-]{32,}/g, '<secret-like>');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = /authorization|api[_-]?key|token|secret|password|service[_-]?role/i.test(key)
        ? '<redacted>'
        : redact(child);
    }
    return out;
  }
  return value;
}

function load(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw[0] : raw;
}

function pick(workflow, names) {
  const map = new Map((workflow.nodes || []).map((node) => [node.name, node]));
  const result = {};
  for (const name of names) {
    const node = map.get(name);
    if (!node) continue;
    result[name] = {
      type: node.type,
      typeVersion: node.typeVersion,
      parameters: redact(node.parameters || {})
    };
  }
  return result;
}

const [stageBFile, stageDFile] = process.argv.slice(2);
if (!stageBFile || !stageDFile) process.exit(2);

const stageB = load(stageBFile);
const stageD = load(stageDFile);

console.log('[VF-PARAMS] STAGE_B ' + JSON.stringify(pick(stageB, [
  'Attach Source Visual Context',
  'VF-06 Call Edit Planner',
  'Safe Handoff to Stage C'
])));

console.log('[VF-PARAMS] STAGE_D ' + JSON.stringify(pick(stageD, [
  'VF-D1 Normalize Render Result',
  'Stage D Summary'
])));
