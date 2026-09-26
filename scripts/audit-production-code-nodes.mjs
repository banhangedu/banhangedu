import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) process.exit(2);

const out = [];
for (const file of files) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const wf = Array.isArray(raw) ? raw[0] : raw;
  const codeNodes = (wf.nodes || [])
    .filter((n) => n.type === 'n8n-nodes-base.code')
    .map((n) => n.name);
  out.push({
    id: wf.id || null,
    name: wf.name || null,
    node_count: (wf.nodes || []).length,
    code_node_count: codeNodes.length,
    code_nodes: codeNodes
  });
}

console.log('[VF-CODE-AUDIT] ' + JSON.stringify(out));
