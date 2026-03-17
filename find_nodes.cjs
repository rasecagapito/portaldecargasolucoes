const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/Seidor/.gemini/antigravity/brain/8ecc2a25-ea35-4760-bd33-3950fffea182/.system_generated/steps/25/output.txt', 'utf8'));

const nodes = data.data.nodes.filter(n => n.name.toLowerCase().includes('crd7') || n.name.toLowerCase().includes('ocna') || n.name.toLowerCase().includes('cnae'));
console.log(JSON.stringify(nodes, null, 2));
