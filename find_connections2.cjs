const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/Seidor/.gemini/antigravity/brain/8ecc2a25-ea35-4760-bd33-3950fffea182/.system_generated/steps/25/output.txt', 'utf8'));

const relevantNodes = [
    "Montar CRD7 - Contábil",
    "Montar CRD7 - Cobranca",
    "Montar CRD7 - Entrega",
    "CRD7 • Merge (C+B+S)",
    "DATATABLE CNAE",
    "OCNA • CNAE → string",
    "Merge Junção CRD1+OCNA",
    "De - Para CNAECode para CNAEId"
];

const connections = data.data.connections;
const output = {};

for (const source in connections) {
    if (!output[source]) output[source] = [];
    connections[source].main.forEach(arr => {
        arr.forEach(t => {
            output[source].push(t.node);
        });
    });
}

const filteredOutput = {};
for (const source in output) {
    if (relevantNodes.includes(source) || output[source].some(t => relevantNodes.includes(t))) {
        filteredOutput[source] = output[source];
    }
}

fs.writeFileSync('n:/Pessoal/44-IA/Antigravity/Projetos/Projetos/central-projetos/projetos/Portal de Automação B1/portalsolucoes-master/connections_out2.json', JSON.stringify(filteredOutput, null, 2), 'utf8');
