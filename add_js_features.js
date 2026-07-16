const fs = require('fs');
let c = fs.readFileSync('app.js', 'latin1');

const jsCode = `
// ==========================================
// MODULO: GESTION DE USUARIOS
// ==========================================

window.openUserManagementModal = function() {
  document.getElementById("modal-manage-users").classList.add("active");
  renderUserList();
};

window.renderUserList = function() {
  const listContainer = document.getElementById("user-management-list");
  listContainer.innerHTML = "";
  
  if (!state.users || state.users.length === 0) {
    listContainer.innerHTML = "<p style='color: var(--text-secondary); text-align: center;'>No hay usuarios registrados.</p>";
    return;
  }

  state.users.forEach((user, index) => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.style.padding = "8px 0";
    div.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    
    div.innerHTML = \`
      <span style="color: var(--text-primary); font-size: 0.95rem;">\${user}</span>
      <div style="display:flex; gap: 8px;">
        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editUserItem(\${index})" title="Editar">??</button>
        <button class="btn btn-orange" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteUserItem(\${index})" title="Eliminar">?</button>
      </div>
    \`;
    listContainer.appendChild(div);
  });
};

window.addUserFromInput = function() {
  const input = document.getElementById("new-user-name");
  const name = input.value.trim().toUpperCase();
  if (!name) return;

  if (state.users.includes(name)) {
    showToast("El usuario ya existe.", 3000);
    return;
  }

  state.users.push(name);
  input.value = "";
  renderUserList();
  saveUsersToFirebase();
};

window.editUserItem = function(index) {
  const oldName = state.users[index];
  const newName = prompt("Edita el nombre del pasante:", oldName);
  
  if (newName !== null) {
    const trimmed = newName.trim().toUpperCase();
    if (trimmed && trimmed !== oldName) {
      if (state.users.includes(trimmed)) {
        showToast("Ese nombre ya est registrado.", 3000);
      } else {
        state.users[index] = trimmed;
        renderUserList();
        saveUsersToFirebase();
      }
    }
  }
};

window.deleteUserItem = function(index) {
  const userName = state.users[index];
  if (confirm(\`¿Estás seguro de que deseas eliminar a "\${userName}"? No podrá solicitar más biométricos.\`)) {
    state.users.splice(index, 1);
    renderUserList();
    saveUsersToFirebase();
  }
};

window.saveUsersToFirebase = async function() {
  if (state.connectionMode === "online" && typeof db !== "undefined") {
    try {
      showToast("Guardando usuarios...", 2000);
      await db.collection("app_data").doc("users").set({ items: sanitizeForFirestore(state.users) });
      showToast("Usuarios guardados.", 2000);
      populateUserSelects(); // Actualizar el dropdown del modal de reservas
    } catch (error) {
      console.error("Error al guardar usuarios:", error);
      showToast("Error al guardar en la nube.", 3000);
    }
  } else {
    showToast("Guardado local (Modo Offline).", 2000);
    saveLocalBackup();
    populateUserSelects();
  }
};

// ==========================================
// MODULO: EDICION DE HARDWARE DE BIOMETRICO
// ==========================================

window.openEditBiometricModal = function(bioNum) {
  const bio = state.biometrics.find(b => b.biometrico == bioNum);
  if (!bio) return;

  document.getElementById("edit-bio-title").innerText = \`?? Editar Biométrico \${bioNum}\`;
  document.getElementById("edit-bio-num").value = bioNum;

  document.getElementById("edit-bio-laptop-marca").value = bio.laptop_marca || "";
  document.getElementById("edit-bio-laptop-modelo").value = bio.laptop_modelo || "";
  
  document.getElementById("edit-bio-impresora-marca").value = bio.impresora_marca || "";
  document.getElementById("edit-bio-impresora-modelo").value = bio.impresora_modelo || "";
  
  document.getElementById("edit-bio-lector").value = bio.biometrico_lector || "";
  
  document.getElementById("edit-bio-router-modelo").value = bio.router_modelo || "";
  document.getElementById("edit-bio-router-imei").value = bio.router_imei || "";

  document.getElementById("modal-edit-biometric").classList.add("active");
};

window.saveBiometricHardware = async function() {
  const bioNum = document.getElementById("edit-bio-num").value;
  const bio = state.biometrics.find(b => b.biometrico == bioNum);
  if (!bio) return;

  bio.laptop_marca = document.getElementById("edit-bio-laptop-marca").value.trim();
  bio.laptop_modelo = document.getElementById("edit-bio-laptop-modelo").value.trim();
  
  bio.impresora_marca = document.getElementById("edit-bio-impresora-marca").value.trim();
  bio.impresora_modelo = document.getElementById("edit-bio-impresora-modelo").value.trim();
  
  bio.biometrico_lector = document.getElementById("edit-bio-lector").value.trim();
  
  bio.router_modelo = document.getElementById("edit-bio-router-modelo").value.trim();
  bio.router_imei = document.getElementById("edit-bio-router-imei").value.trim();

  document.getElementById("modal-edit-biometric").classList.remove("active");
  
  if (state.connectionMode === "online" && typeof db !== "undefined") {
    try {
      showToast("Actualizando hardware...", 2000);
      await db.collection("app_data").doc("biometrics").set({ items: sanitizeForFirestore(state.biometrics) });
      showToast("Hardware actualizado.", 2000);
      // Forzar re-render si no se actualiza por onSnapshot
      if (document.getElementById("admin-view").style.display !== "none") {
        recalculateBiometricStates();
      }
    } catch (error) {
      console.error("Error actualizando hardware:", error);
    }
  } else {
    saveLocalBackup();
    recalculateBiometricStates();
  }
};
`;

if (!c.includes('window.openUserManagementModal')) {
  c += '\n' + jsCode;
}

const originalHeader = `<span class="state-pill \${statusClass}">\${statusText}</span>\n    </div>`;
const replacementHeader = `<span class="state-pill \${statusClass}">\${statusText}</span>\n      \${viewType === 'admin' ? \`<button onclick="openEditBiometricModal('\${bio.biometrico}')" class="btn btn-icon" style="background:transparent; border:none; font-size:1.1rem; color: var(--text-secondary); cursor:pointer; margin-left:10px; padding:0;" title="Editar Hardware">??</button>\` : ''}\n    </div>`;

c = c.replace(originalHeader, replacementHeader);

fs.writeFileSync('app.js', c, 'latin1');
console.log('done');
