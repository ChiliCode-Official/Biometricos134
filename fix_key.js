const fs = require('fs');
let c = fs.readFileSync('config.js', 'latin1');
c = c.replace(/"clc-pLTGPJuHnGpiy"/g, '"cIc-pLTGPJuHnGPiy"');
fs.writeFileSync('config.js', c, 'latin1');
console.log('done');
