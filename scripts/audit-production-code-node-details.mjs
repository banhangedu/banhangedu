import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) process.exit(2);

for (const file of files) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const wf = Array.isArray(raw) ? raw[0] : raw;
  const details = (wf.nodes || [])
    .filter((n) => n.type === 'n8n-nodes-base.code')
    .map((n) => ({
      name: n.name,
      js_code: String(n.parameters?.jsCode || '').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    }));
  console.log('[VF-CODE-DETAIL] ' + JSON.stringify({
    workflow_id: wf.id || null,
    workflow_name: wf.name || null,
    code_nodes: details
  }));
}
