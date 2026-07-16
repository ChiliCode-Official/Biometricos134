const fs = require('fs');

let c = fs.readFileSync('app.js', 'utf8');

// Fix app.js emojis and accents
c = c.replace(/title="Editar Hardware">.*?<\/button>/g, 'title="Editar Hardware">✏️</button>');
c = c.replace(/title="Editar">.*?<\/button>/g, 'title="Editar">✏️</button>');
c = c.replace(/title="Eliminar">.*?<\/button>/g, 'title="Eliminar">❌</button>');
c = c.replace(/confirm\(`\?Est\?s seguro de que deseas eliminar a "\${userName}"\? No podr\? solicitar m\?s biom\?tricos.`\)/g, 'confirm(`¿Estás seguro de que deseas eliminar a "${userName}"? No podrá solicitar más biométricos.`)');
c = c.replace(/innerText = `\?\? Editar Biom\?trico \${bioNum}`/g, 'innerText = `✏️ Editar Biométrico ${bioNum}`');

// Also check showToast for "Ese nombre ya est? registrado"
c = c.replace(/showToast\("Ese nombre ya est\? registrado\.", 3000\);/g, 'showToast("Ese nombre ya está registrado.", 3000);');

fs.writeFileSync('app.js', c, 'utf8');
console.log('done fixing app.js');
