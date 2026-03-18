
const fs = require('fs');
const content = fs.readFileSync('wf_11_fixed.json', 'utf8');
const wf = JSON.parse(content);
const nodes = wf.nodes || [];
const target = nodes.find(n => n.name.includes('Build Callback Signature') || (n.parameters && n.parameters.jsCode && n.parameters.jsCode.includes('crypto')));
if (target) {
  process.stdout.write('FOUND:' + target.name + '\n');
  process.stdout.write(JSON.stringify(target, null, 2) + '\n');
} else {
  process.stdout.write('NOT FOUND\n');
}
