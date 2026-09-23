import { readFileSync } from 'node:fs';

function load(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw[0] : raw;
}

function find(workflow, name) {
  return (workflow.nodes || []).find((node) => node.name === name) || null;
}

function safeUrl(value) {
  const text = String(value || '');
  return text
    .replace(/https?:\/\/[^\s"'\)]+/gi, '<origin>')
    .replace(/Bearer\s+[^\s"'\)]+/gi, 'Bearer <redacted>');
}

const file = process.argv[2];
if (!file) process.exit(2);
const workflow = load(file);
const webhook = find(workflow, 'Stage B Webhook');
const build = find(workflow, 'Build Planner Input');

console.log('[VF-TRIGGER-AUDIT] ' + JSON.stringify({
  workflow_id: workflow.id || null,
  workflow_name: workflow.name || null,
  active: Boolean(workflow.active),
  webhook: webhook ? {
    method: webhook.parameters?.httpMethod || 'GET',
    path: webhook.parameters?.path || null
  } : null,
  build_planner_input: build ? {
    method: build.parameters?.method || 'GET',
    url: safeUrl(build.parameters?.url),
    send_body: Boolean(build.parameters?.sendBody),
    body_mode: build.parameters?.specifyBody || null,
    json_body: build.parameters?.jsonBody || null,
    header_names: (build.parameters?.headerParameters?.parameters || []).map((h) => h.name)
  } : null
}));
