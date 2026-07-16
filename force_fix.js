const fs = require('fs');

function forceFix(file) {
  let c = fs.readFileSync(file, 'utf8');
  
  c = c.replace(/\?\? Gesti\?n de Usuarios/g, '👥 Gestión de Usuarios');
  c = c.replace(/\?\? Gestión de Usuarios/g, '👥 Gestión de Usuarios');
  c = c.replace(/Gesti\?n de Usuarios/g, 'Gestión de Usuarios');

  fs.writeFileSync(file, c, 'utf8');
}

forceFix('index.html');
console.log("Fixed.");
