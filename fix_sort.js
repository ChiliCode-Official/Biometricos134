const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const targetStr = `const newLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));`;

const newStr = `const newLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        function parseId(id) {
          const parts = id.split('-');
          if (parts[1] === "NaN") {
            return parseInt(parts[2], 10) || 0;
          } else {
            return parseInt(parts[1], 10) || 0;
          }
        }
        return parseId(a.id) - parseId(b.id);
      });`;

appJs = appJs.replace(targetStr, newStr);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log("Sort fixed.");
