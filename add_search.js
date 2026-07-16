const fs = require('fs');

// 1. Añadir barra de búsqueda a index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

const searchBarHTML = `
        <div style="margin-bottom: 10px;">
          <input type="text" id="search-user" placeholder="🔍 Buscar pasante..." class="form-control" style="width: 100%; border-radius: 8px;" oninput="renderUserList()">
        </div>
        <div style="max-height: 300px;`;

indexHtml = indexHtml.replace('<div style="max-height: 300px;', searchBarHTML);
fs.writeFileSync('index.html', indexHtml, 'utf8');

// 2. Modificar renderUserList en app.js
let appJs = fs.readFileSync('app.js', 'utf8');

const newRenderLogic = `window.renderUserList = function() {
  const listContainer = document.getElementById("user-management-list");
  listContainer.innerHTML = "";
  
  if (!state.users || state.users.length === 0) {
    listContainer.innerHTML = "<p style='color: var(--text-secondary); text-align: center;'>No hay usuarios registrados.</p>";
    return;
  }

  const searchInput = document.getElementById("search-user");
  const filterText = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let found = false;

  state.users.forEach((user, index) => {
    if (filterText && !user.toLowerCase().includes(filterText)) return;
    found = true;

    const div = document.createElement("div");`;

appJs = appJs.replace(/window\.renderUserList = function\(\) {[\s\S]*?state\.users\.forEach\(\(user, index\) => {[\s\S]*?const div = document\.createElement\("div"\);/, newRenderLogic);

// Add logic to show "no results" if found is false
const noResultsLogic = `    listContainer.appendChild(div);
  });
  
  if (filterText && !found) {
    listContainer.innerHTML = "<p style='color: var(--text-secondary); text-align: center;'>No se encontraron resultados.</p>";
  }
};`;

appJs = appJs.replace(/    listContainer\.appendChild\(div\);\n  \}\);\n\};/, noResultsLogic);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('done');
