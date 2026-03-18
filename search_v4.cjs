
const fs = require('fs');
const path = require('path');

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') search(fullPath);
        } else if (file.endsWith('.json')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('Build Callback Signature') || content.includes('crypto')) {
                console.log('MATCH IN:', fullPath);
            }
        }
    }
}

try {
    search('.');
} catch (e) {
    console.error(e);
}
