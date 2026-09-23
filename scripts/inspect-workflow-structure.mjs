import { readFileSync } from 'node:fs';

const [file, label] = process.argv.slice(2);
if (!file || !label) process.exit(2);

const raw = JSON.parse(readFileSync(file, 'utf8'));
const workflow = Array.isArray(raw) ? raw[0] : raw;
const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
const connections = workflow?.connections && typeof workflow.connections === 'object'
  ? workflow.connections
  : {};

const compactNodes = nodes.map((node) => ({
  name: node.name,
  type: node.type,
  parameter_keys: Object.keys(node.parameters || {}).sort()
}));

const edges = [];
for (const [from, channels] of Object.entries(connections)) {
  for (const [channel, outputs] of Object.entries(channels || {})) {
    (outputs || []).forEach((targets, outputIndex) => {
      (targets || []).forEach((target) => edges.push({
        from,
        channel,
        output_index: outputIndex,
        to: target.node,
        input_index: target.index ?? 0
      }));
    });
  }
}

console.log('[VF-STRUCTURE] ' + label + ' ' + JSON.stringify({
  workflow_id: workflow?.id || null,
  name: workflow?.name || null,
  active: Boolean(workflow?.active),
  node_count: compactNodes.length,
  nodes: compactNodes,
  edges
}));
