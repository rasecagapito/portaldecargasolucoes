
const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') search(fullPath);
    } else if (file.endsWith('.json') || file.endsWith('.ts') || file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('TOCb7dM9JPWf2Ty9') || content.includes('Build Callback Signature')) {
          process.stdout.write('FOUND IN: ' + fullPath + '\n');
        }
      } catch (e) {}
    }
  }
}

search('.');
