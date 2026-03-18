
const fs = require('fs');
const content = fs.readFileSync('wf_11_fixed.json', 'utf8');
const wf = JSON.parse(content);
(wf.nodes || []).forEach(n => console.log(n.name));
