const fs = require('fs');

function repairFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  // Fix words
  c = c.replace(/Biom\?trico/g, 'Biométrico');
  c = c.replace(/Biomtrico/g, 'Biométrico');
  c = c.replace(/est\? registrado/g, 'está registrado');
  c = c.replace(/Gesti\?n de Pasantes/g, 'Gestión de Pasantes');
  c = c.replace(/Gesti\?n de Usuarios/g, 'Gestión de Usuarios');

  // Fix Emojis in index.html
  c = c.replace(/\?\? Gesti\?n de Usuarios/g, '👥 Gestión de Usuarios');
  c = c.replace(/\?\? Gestión de Usuarios/g, '👥 Gestión de Usuarios');
  c = c.replace(/\?\? Editar Biométrico/g, '✏️ Editar Biométrico');
  c = c.replace(/\?\? Laptop \(Marca\/Modelo\)/g, '💻 Laptop (Marca/Modelo)');
  c = c.replace(/\?\?\? Impresora \(Marca\/Modelo\)/g, '🖨️ Impresora (Marca/Modelo)');
  c = c.replace(/\?\? Lector Biométrico/g, '👆 Lector Biométrico');
  c = c.replace(/\?\? Router BAM/g, '📶 Router BAM');
  c = c.replace(/\?\? Añadir/g, '➕ Añadir');

  // Fix emojis in app.js
  c = c.replace(/title="Editar Hardware">\?\?</g, 'title="Editar Hardware">✏️<');
  c = c.replace(/title="Editar">\?\?</g, 'title="Editar">✏️<');
  c = c.replace(/title="Eliminar">\?\?</g, 'title="Eliminar">❌<');

  fs.writeFileSync(filePath, c, 'utf8');
}

try {
  repairFile('index.html');
  repairFile('app.js');
  console.log('Archivos reparados exitosamente.');
} catch(e) {
  console.error(e);
}
