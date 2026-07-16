const fs = require('fs');
let c = fs.readFileSync('app.js', 'latin1');
c = c.replace(/\${viewType === 'admin'/g, "${role === 'admin'");
fs.writeFileSync('app.js', c, 'latin1');
console.log('done');
