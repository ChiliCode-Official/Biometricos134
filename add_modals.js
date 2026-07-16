const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const modals = `
  <!-- Módulo de Gestión de Usuarios -->
  <div id="modal-manage-users" class="modal">
    <div class="modal-content glass animate-slide-up" style="max-width: 500px; text-align: left;">
      <div class="modal-header">
        <h3>?? Gestión de Pasantes</h3>
        <button class="modal-close" onclick="document.getElementById('modal-manage-users').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Administra los usuarios autorizados para solicitar biométricos. Los cambios se guardan automáticamente en la nube.</p>
        
        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px;" id="user-management-list">
          <!-- Usuarios cargados dinámicamente -->
        </div>

        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <input type="text" id="new-user-name" placeholder="Nombre completo del pasante..." class="form-control" style="flex: 1;" onkeypress="if(event.key === 'Enter') addUserFromInput()">
          <button class="btn btn-primary" onclick="addUserFromInput()" style="padding: 10px 15px;">? Añadir</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Módulo de Edición de Biométricos -->
  <div id="modal-edit-biometric" class="modal">
    <div class="modal-content glass animate-slide-up" style="max-width: 500px; text-align: left;">
      <div class="modal-header">
        <h3 id="edit-bio-title">?? Editar Biométrico</h3>
        <button class="modal-close" onclick="document.getElementById('modal-edit-biometric').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap: 10px;">
        <input type="hidden" id="edit-bio-num">
        <div>
          <label style="font-size: 0.85rem; color: var(--text-secondary);">?? Laptop (Marca/Modelo)</label>
          <div style="display:flex; gap: 5px;">
            <input type="text" id="edit-bio-laptop-marca" class="form-control" placeholder="Marca (ej. HP)">
            <input type="text" id="edit-bio-laptop-modelo" class="form-control" placeholder="Modelo (ej. ProBook 440 G8)">
          </div>
        </div>
        <div>
          <label style="font-size: 0.85rem; color: var(--text-secondary);">??? Impresora (Marca/Modelo)</label>
          <div style="display:flex; gap: 5px;">
            <input type="text" id="edit-bio-impresora-marca" class="form-control" placeholder="Marca (ej. EPSON)">
            <input type="text" id="edit-bio-impresora-modelo" class="form-control" placeholder="Modelo (ej. WF-100)">
          </div>
        </div>
        <div>
          <label style="font-size: 0.85rem; color: var(--text-secondary);">?? Lector Biométrico</label>
          <input type="text" id="edit-bio-lector" class="form-control" placeholder="Lector (ej. Lector HID)">
        </div>
        <div>
          <label style="font-size: 0.85rem; color: var(--text-secondary);">?? Router BAM</label>
          <div style="display:flex; gap: 5px;">
            <input type="text" id="edit-bio-router-modelo" class="form-control" placeholder="Modelo (ej. BAM Alcatel)">
            <input type="text" id="edit-bio-router-imei" class="form-control" placeholder="IMEI">
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-edit-biometric').classList.remove('active')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveBiometricHardware()">Guardar Cambios</button>
      </div>
    </div>
  </div>
</body>`;

if (!c.includes('modal-manage-users')) {
  c = c.replace('</body>', modals);
}

if (!c.includes('btn-manage-users')) {
  c = c.replace('<div class="admin-top-actions" style="display: flex; justify-content: flex-end; margin-bottom: 15px;">',
'<div class="admin-top-actions" style="display: flex; justify-content: flex-end; margin-bottom: 15px; gap: 10px;">\n          <button id="btn-manage-users" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;" onclick="openUserManagementModal()">?? Gestión de Usuarios</button>');
}

fs.writeFileSync('index.html', c, 'utf8');
console.log('done');
