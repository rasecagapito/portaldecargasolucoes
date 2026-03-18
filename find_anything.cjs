
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));

for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('SL • Config') || content.includes('crypto')) {
      process.stdout.write('MATCH IN FILE: ' + file + '\n');
      console.log('File:', file);
      // Try to find the node name
      if (file.includes('wf_11')) {
        const wf = JSON.parse(content);
        const nodes = wf.nodes || [];
        const node = nodes.find(n => n.name.includes('Config') || (n.parameters && n.parameters.jsCode && n.parameters.jsCode.includes('crypto')));
        if (node) console.log('Node Name:', node.name);
      }
    }
  } catch (e) {
    // skip
  }
}
