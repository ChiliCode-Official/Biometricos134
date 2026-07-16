const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');
let appJs = fs.readFileSync('app.js', 'utf8');

// --- Fix index.html ---

// 1. Remove the old button
indexHtml = indexHtml.replace(/<button id="btn-manage-users"[\s\S]*?<\/button>/, '');

// 2. Add the button to sidebar
const newNavBtn = `
          <button id="nav-manage-users" class="nav-btn" style="display: none;" onclick="openUserManagementModal()">
              <span class="nav-icon"><span style="font-size: 20px;">👥</span></span>
              <span class="nav-label">Gestión de Usuarios</span>
            </button>
        </nav>`;
indexHtml = indexHtml.replace('</nav>', newNavBtn);

// 3. Fix the weird symbols in modals
indexHtml = indexHtml.replace(/\?\? Gestión de Pasantes/g, '👥 Gestión de Pasantes');
indexHtml = indexHtml.replace(/\?\? Editar Biométrico/g, '✏️ Editar Biométrico');
indexHtml = indexHtml.replace(/\? Añadir/g, '➕ Añadir');

// Write back
fs.writeFileSync('index.html', indexHtml, 'utf8');

// --- Fix app.js ---

// 1. Show nav button on admin login
appJs = appJs.replace(/showView\("admin-view"\);/g, 'showView("admin-view");\n    document.getElementById("nav-manage-users").style.display = "flex";');

// 2. Hide nav button on user login
appJs = appJs.replace(/showView\("user-view"\);/g, 'showView("user-view");\n  const btnNavUsers = document.getElementById("nav-manage-users");\n  if (btnNavUsers) btnNavUsers.style.display = "none";');

// Write back
fs.writeFileSync('app.js', appJs, 'utf8');

console.log("Sidebar and symbols fixed.");
