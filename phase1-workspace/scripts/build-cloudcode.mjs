import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/astanavis-cloudcode.js', ['balance.js', 'handlers.js'].map(name => readFileSync('src/modules/astanavis-progress/server/' + name, 'utf8')).join('\n'));
console.log('CloudCode bundle: artifacts/astanavis-cloudcode.js (not deployed)');
