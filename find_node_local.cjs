
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'wf_11_fixed.json');
if (!fs.existsSync(filePath)) {
  process.stdout.write('File not found: ' + filePath + '\n');
  process.exit(1);
}
const content = fs.readFileSync(filePath, 'utf8');
const wf = JSON.parse(content);
const nodes = wf.nodes || [];
const target = nodes.find(n => n.name.includes('Build Callback Signature') || (n.parameters && n.parameters.jsCode && n.parameters.jsCode.includes('crypto')));
if (target) {
  process.stdout.write('FOUND:' + target.name + '\n');
  process.stdout.write(JSON.stringify(target, null, 2) + '\n');
} else {
  process.stdout.write('NOT FOUND\n');
}
