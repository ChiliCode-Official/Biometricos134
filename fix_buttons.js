const fs = require('fs');
let c = fs.readFileSync('app.js', 'latin1');

c = c.replace(/handleBiometricAction\('confirm', \{ id: logId, biometrico: bioNum \}\)/, "sendAction('confirm', { id: logId, biometrico: bioNum })");
c = c.replace(/handleBiometricAction\('cancel', \{ id: logId, biometrico: bioNum \}\)/, "sendAction('cancel', { id: logId, biometrico: bioNum })");

fs.writeFileSync('app.js', c, 'latin1');
console.log('done');
