import fs from 'node:fs';

const file = process.argv[2];
if (!file) process.exit(2);

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const wf = Array.isArray(raw) ? raw[0] : raw;

function safeUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const u = new URL(value);
    return u.origin + u.pathname;
  } catch {
    return value.includes('?') ? value.split('?')[0] : value.slice(0, 200);
  }
}

const nodes = (wf.nodes || []).map((node) => {
  const p = node.parameters || {};
  const out = {
    name: node.name,
    type: node.type,
    disabled: Boolean(node.disabled)
  };
  if (node.type?.includes('webhook')) {
    out.webhook = {
      path: p.path || null,
      httpMethod: p.httpMethod || null,
      responseMode: p.responseMode || null
    };
  }
  if (node.type?.includes('httpRequest')) {
    out.http = {
      method: p.method || p.requestMethod || 'GET',
      url: safeUrl(p.url || '')
    };
  }
  if (node.type?.includes('openAi') || node.type?.toLowerCase().includes('openai')) {
    out.ai = {
      operation: p.operation || null,
      resource: p.resource || null,
      model: p.model || p.modelId || null
    };
  }
  return out;
});

const report = {
  id: wf.id,
  name: wf.name,
  active: wf.active,
  node_count: nodes.length,
  nodes,
  connections_from: Object.keys(wf.connections || {})
};

console.log('[VF-STAGE-B-STRUCTURE] ' + JSON.stringify(report));
