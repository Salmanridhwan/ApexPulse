import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('data/template-pratinjau.json', 'utf8'));
const w = d.flatMap((e: any) => e.widgets || []).find((x: any) => x.title === 'Pesanan per Status');
console.log(Object.keys(w));
console.log(JSON.stringify(w, null, 1).slice(0, 1200));
