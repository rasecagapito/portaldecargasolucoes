const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/Seidor/.gemini/antigravity/brain/8ecc2a25-ea35-4760-bd33-3950fffea182/.system_generated/steps/25/output.txt', 'utf8'));

const nodeNames = [
    "OCNA • CNAE → string",
    "DATATABLE CNAE",
    "De - Para CNAECode para CNAEId",
    "Merge Junção CRD1+OCNA"
];

const connections = data.data.connections;
const relevantConnections = {};

for (const source in connections) {
    const targets = connections[source].main[0];
    if (targets) {
        targets.forEach(t => {
            if (nodeNames.includes(source) || nodeNames.includes(t.node)) {
                if (!relevantConnections[source]) relevantConnections[source] = [];
                relevantConnections[source].push(t.node);
            }
        });
    }
}

fs.writeFileSync('n:/Pessoal/44-IA/Antigravity/Projetos/Projetos/central-projetos/projetos/Portal de Automação B1/portalsolucoes-master/connections_out.json', JSON.stringify(relevantConnections, null, 2), 'utf8');
