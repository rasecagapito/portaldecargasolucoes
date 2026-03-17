const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/Seidor/.gemini/antigravity/brain/8ecc2a25-ea35-4760-bd33-3950fffea182/.system_generated/steps/25/output.txt', 'utf8'));

const nodes = data.data.nodes;
const connections = data.data.connections;

let flow = '';
Object.keys(connections).forEach(source => {
    connections[source].main.forEach((targets, index) => {
        targets.forEach(target => {
            flow += `[${source}] --(output ${index})--> [${target.node}]\n`;
        });
    });
});

fs.writeFileSync('n:/Pessoal/44-IA/Antigravity/Projetos/Projetos/central-projetos/projetos/Portal de Automação B1/portalsolucoes-master/flow.txt', flow);
