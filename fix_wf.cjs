
const fs = require('fs');

const inputPath = 'C:\\Users\\Seidor\\.gemini\\antigravity\\brain\\bb038574-aa46-4360-98cd-72c6fc72cf73\\.system_generated\\steps\\622\\output.txt';
const outputPath = 'n:\\Pessoal\\44-IA\\Antigravity\\Projetos\\Projetos\\central-projetos\\projetos\\Portal de Automação B1\\portalsolucoes-master\\wf_11_fixed.json';

const rawData = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(rawData);

let wf = data.success && data.data ? data.data : data;

wf.nodes.forEach(node => {
    // Fix Set nodes ZipCode
    if (node.type === 'n8n-nodes-base.set') {
        if (node.parameters && node.parameters.assignments && node.parameters.assignments.assignments) {
            node.parameters.assignments.assignments.forEach(ass => {
                if (ass.name === 'ZipCode' && ass.value && ass.value.includes('`')) {
                    // Replace template literal with concatenation
                    ass.value = ass.value.replace('`${cep.slice(0,5)}-${cep.slice(5)}`', "cep.slice(0,5) + '-' + cep.slice(5)");
                }
            });
        }
    }
});

const result = {
    nodes: wf.nodes,
    connections: wf.connections,
    name: wf.name,
    settings: wf.settings || {}
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Fixed workflow saved to ${outputPath}`);
