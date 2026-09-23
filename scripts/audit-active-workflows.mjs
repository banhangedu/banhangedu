import { readFileSync } from 'node:fs';

function load(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw[0] : raw;
}

const entries = process.argv.slice(2);
if (!entries.length || entries.length % 2 !== 0) process.exit(2);

for (let i = 0; i < entries.length; i += 2) {
  const label = entries[i];
  const workflow = load(entries[i + 1]);
  console.log('[VF-ACTIVE-AUDIT] ' + label + ' ' + JSON.stringify({
    id: workflow?.id || null,
    name: workflow?.name || null,
    active: Boolean(workflow?.active),
    node_count: Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0
  }));
}
