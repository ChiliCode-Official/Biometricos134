/* ==========================================================================
   APPLICATION LOGIC - CONTROL DE BIOMÉTRICOS (NOTARÍA 134)
   ========================================================================== */

// --- Global State ---
let state = {
  connectionMode: "demo", // "online" | "demo"
  currentUser: null,      // { name: "", role: "user" | "admin" }
  biometrics: [],         // Inventario de 8 equipos y su estado actual
  logs: [],               // Historial de préstamos (LOG_USO)
  inkLogs: [],            // Cambios de tinta (LOG_TINTAS)
  internetLogs: [],       // Planes de BAM (LOG_INTERNET)
  users: []               // Lista de usuarios (pasantes)
};

// --- Theme & Install App Logic ---
let deferredPrompt;

function initTheme() {
  const savedTheme = localStorage.getItem("n134_theme");
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  } else {
    setTheme('light');
  }
  
  const savedColor = localStorage.getItem("n134_accent_color");
  if (savedColor) {
    setAccentColor(savedColor, false);
  }
}

function setTheme(themeName) {
  if (themeName === 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    document.getElementById('btn-theme-dark').style.border = "2px solid var(--accent)";
    document.getElementById('btn-theme-light').style.border = "none";
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.getElementById('btn-theme-light').style.border = "2px solid var(--accent)";
    document.getElementById('btn-theme-dark').style.border = "none";
  }
  localStorage.setItem("n134_theme", themeName);
}

function setAccentColor(colorHex, save = true) {
  document.documentElement.style.setProperty('--accent', colorHex);
  // Calculate a lighter version for hover states / backgrounds
  document.documentElement.style.setProperty('--accent-light', colorHex + '20'); // 20% opacity approx
  const picker = document.getElementById("accent-color-picker");
  if(picker) picker.value = colorHex;
  
  if (save) {
    localStorage.setItem("n134_accent_color", colorHex);
  }
}

function resetAccentColor() {
  document.documentElement.style.removeProperty('--accent');
  document.documentElement.style.removeProperty('--accent-light');
  localStorage.removeItem("n134_accent_color");
  const picker = document.getElementById("accent-color-picker");
  if(picker) picker.value = "#007AFF"; // Default blue
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installSection = document.getElementById('install-app-section');
  if (installSection) installSection.style.display = 'block';
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  
  // Detect iOS Safari
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  
  if (isIos && !isStandalone) {
    const iosSection = document.getElementById('ios-install-section');
    if (iosSection) iosSection.style.display = 'block';
  }
  const installBtn = document.getElementById('btn-install-app');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('App instalada');
          document.getElementById('install-app-section').style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }
});


// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
});

// --- PTR Variables ---
let ptrStartY = 0;
let ptrCurrentY = 0;
let isPulling = false;
const ptrIndicator = document.getElementById('pull-to-refresh-indicator');

// --- Notification Polling Variables ---
let notificationPollingTimer = null;
let lastKnownLogs = [];

// --- Offline Queue ---
let offlineQueue = JSON.parse(localStorage.getItem('n134_offline_queue')) || [];

function updateOfflineBadge() {
  const cnt = offlineQueue.length;
  const userBadge = document.getElementById('user-offline-badge');
  const adminBadge = document.getElementById('admin-offline-badge');
  if (userBadge) {
    userBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
    userBadge.innerText = `☁️ ${cnt} pte.`;
  }
  if (adminBadge) {
    adminBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
    adminBadge.innerText = `☁️ ${cnt} pte.`;
  }
}

async function processOfflineQueue() {
  if (state.connectionMode !== "online" || offlineQueue.length === 0) return;
  if (!navigator.onLine) return; // Prevent processing if totally offline
  
  showToast(`Sincronizando ${offlineQueue.length} acciones pendientes...`);
  const queueToProcess = [...offlineQueue];
  offlineQueue = [];
  localStorage.setItem('n134_offline_queue', JSON.stringify(offlineQueue));
  updateOfflineBadge();
  
  let successCount = 0;
  for (const item of queueToProcess) {
    try {
      const queryParams = new URLSearchParams({ action: item.action, ...item.payload, _t: Date.now() }).toString();
      const res = await fetch(`${CONFIG.GOOGLE_SHEET_API_URL}?${queryParams}`);
      if (res.ok) successCount++;
    } catch (e) {
      console.error("Fallo re-intento de offline item:", item);
      offlineQueue.push(item); // Vuelve a la cola si falla
    }
  }
  localStorage.setItem('n134_offline_queue', JSON.stringify(offlineQueue));
  updateOfflineBadge();
  if (successCount > 0) {
    loadDatabase(); // Actualizar todo tras sincronizar exitosamente
    showToast(`${successCount} acciones sincronizadas correctamente con la nube.`);
  }
}

window.addEventListener('online', processOfflineQueue);

// --- Core App Init ---
async function initApp() {
  updateOfflineBadge();
  // 1. Detectar si hay sesión guardada en localStorage
  const savedSession = localStorage.getItem("n134_session");
  if (savedSession) {
    state.currentUser = JSON.parse(savedSession);
    if (state.currentUser && state.currentUser.role === "admin") {
      requestNotificationPermission();
      startNotificationPolling();
    }
  }

  // 2. Determinar modo de conexión
  if (CONFIG.GOOGLE_SHEET_API_URL && CONFIG.GOOGLE_SHEET_API_URL.trim() !== "") {
    state.connectionMode = "online";
    updateConnectionBar("loading", "Revisando biométricos disponibles...");
  } else {
    state.connectionMode = "demo";
    updateConnectionBar("demo", "Modo Demostración (Local) - Edita config.js para conectar Google Sheets");
  }

  // Cargar base local de inmediato para respuesta instantánea antes de red
  loadLocalDatabase();
  renderBiometrics();
  populateExitTimeDropdown();
  updateSequentialSuggestion();

  // Intentar precargar la plantilla de Excel original en segundo plano
  try {
    const response = await fetch('RESPONSIVA DE EQUIPO DE COMPUTO Firmas 1 JULIO 2022.xlsx');
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      state.originalWorkbookBuffer = arrayBuffer;
      state.originalWorkbook = XLSX.read(new Uint8Array(arrayBuffer), { 
        type: "array", 
        cellStyles: true, 
        cellFormulas: true, 
        cellDates: true, 
        cellNF: true 
      });
      console.log("Plantilla Excel precargada con éxito");
    }
  } catch (err) {
    console.warn("No se pudo precargar la plantilla Excel automáticamente:", err);
  }

  // 3. Cargar Base de Datos (Nube) de forma asíncrona sin bloquear la UI
  setButtonsState(false); // Deshabilitar botones durante la carga
  loadDatabase().then(() => {
    setButtonsState(true); // Habilitar botones al terminar de cargar
    renderBiometrics();
    updateSequentialSuggestion();
    if (state.currentUser && state.currentUser.role === "admin") {
      renderAdminDashboard();
    }
  });

  // 4. Mostrar vista según sesión
  if (state.currentUser) {
    showView(state.currentUser.role === "admin" ? "admin-view" : "user-view");
    document.getElementById("display-user-name").innerText = state.currentUser.name;
    if (state.currentUser.role === "admin") {
       const adminBadge = document.getElementById("admin-badge-top");
       if (adminBadge) adminBadge.classList.remove("hidden");
    } else {
       const adminBadge = document.getElementById("admin-badge-top");
       if (adminBadge) adminBadge.classList.add("hidden");
    }
  } else {
    showView("login-view");
  }
}

// --- Setup DOM Events ---
function setupEventListeners() {
  // Login Role Tabs
  document.getElementById("btn-role-user").addEventListener("click", () => switchLoginTab("user"));
  document.getElementById("btn-role-admin").addEventListener("click", () => switchLoginTab("admin"));

  // Autocomplete User Search
  const userSearchInput = document.getElementById("user-search");
  userSearchInput.addEventListener("input", handleUserSearch);
  userSearchInput.addEventListener("focus", () => {
    handleUserSearch({ target: userSearchInput });
  });

  // Autocomplete Admin User Search in assignment modal
  const adminSelectUserInput = document.getElementById("admin-select-user");
  adminSelectUserInput.addEventListener("input", handleAdminUserSearch);
  adminSelectUserInput.addEventListener("focus", () => {
    handleAdminUserSearch({ target: adminSelectUserInput });
  });
  
  // Close autocompletes on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      document.getElementById("user-results").classList.add("hidden");
      document.getElementById("admin-user-results").classList.add("hidden");
    }
  });

  const btnRequestSequential = document.getElementById("btn-request-sequential");
  if (btnRequestSequential) {
    let seqHoldTimer;
    const holdDuration = 1500;
    
    const startSeqHold = (e) => {
      if (btnRequestSequential.disabled) return;
      const suggestNum = getNextSequentialBiometric();
      if (!suggestNum) return;
      
      e.preventDefault();
      btnRequestSequential.classList.add("holding");
      seqHoldTimer = setTimeout(() => {
        btnRequestSequential.classList.remove("holding");
        openRequestModal(suggestNum);
      }, holdDuration);
    };
    
    const stopSeqHold = () => {
      if (btnRequestSequential.disabled) return;
      btnRequestSequential.classList.remove("holding");
      clearTimeout(seqHoldTimer);
    };

    btnRequestSequential.addEventListener("mousedown", startSeqHold);
    btnRequestSequential.addEventListener("touchstart", startSeqHold, {passive: false});
    
    btnRequestSequential.addEventListener("mouseup", stopSeqHold);
    btnRequestSequential.addEventListener("mouseleave", stopSeqHold);
    btnRequestSequential.addEventListener("touchend", stopSeqHold);
    btnRequestSequential.addEventListener("touchcancel", stopSeqHold);
  }

  // Login Trigger Buttons
  document.getElementById("btn-login-user").addEventListener("click", loginAsUser);
  document.getElementById("btn-login-admin").addEventListener("click", loginAsAdmin);

  // Admin PIN input handle (enter key)
  document.getElementById("admin-pin").addEventListener("keypress", (e) => {
    if (e.key === "Enter") loginAsAdmin();
  });

  // Logout Buttons
  document.querySelectorAll(".logout-btn").forEach(btn => {
    btn.addEventListener("click", logout);
  });

  // Admin Tab Navigation
  document.querySelectorAll(".tab-link").forEach(tab => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-link").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      e.target.classList.add("active");
      const targetId = e.target.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Modals Close handlers
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) closeModal();
  });

  // Confirm Reservation Button
  document.getElementById("btn-confirm-reservation").addEventListener("click", confirmReservation);

  // Logistics Forms Submission
  document.getElementById("ink-form").addEventListener("submit", submitInkLog);
  document.getElementById("internet-form").addEventListener("submit", submitInternetLog);

  // Excel Modal Trigger
  document.getElementById("btn-excel-actions").addEventListener("click", () => openModal("modal-excel"));

  // Excel Drag and Drop
  const dropZone = document.getElementById("drop-zone");
  dropZone.addEventListener("click", () => document.getElementById("excel-file-input").click());
  document.getElementById("excel-file-input").addEventListener("change", handleExcelFileSelect);
  
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  });

  // Export Excel
  document.getElementById("btn-export-excel").addEventListener("click", exportToExcel);

  // Print Preview Actions
  document.getElementById("btn-trigger-print").addEventListener("click", () => {
    window.print();
  });

  // History Filter Search
  document.getElementById("history-search").addEventListener("input", filterHistoryTable);
  
  // Pull to Refresh Listeners
  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      ptrStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }, {passive: true});

  document.addEventListener('touchmove', e => {
    if (!isPulling || window.scrollY > 0) return;
    ptrCurrentY = e.touches[0].clientY;
    const distance = ptrCurrentY - ptrStartY;
    if (distance > 0 && distance < 150 && ptrIndicator) {
      ptrIndicator.style.transform = `translateY(${distance - 60}px)`;
    }
  }, {passive: false});

  document.addEventListener('touchend', e => {
    if (!isPulling) return;
    isPulling = false;
    const distance = ptrCurrentY - ptrStartY;
    if (distance > 60 && ptrIndicator) {
      ptrIndicator.style.transform = `translateY(0px)`;
      loadDatabase().then(() => {
        ptrIndicator.style.transform = `translateY(-100%)`;
      });
    } else if (ptrIndicator) {
      ptrIndicator.style.transform = `translateY(-100%)`;
    }
    ptrStartY = 0;
    ptrCurrentY = 0;
  });
}

/* ==========================================================================
   DATABASE MANAGEMENT (CLOUD & LOCAL)
   ========================================================================== */

// Cargar Base de datos
async function loadDatabase() {
  const progressContainer = document.getElementById("loading-progress-container");
  const progressBar = document.getElementById("loading-progress-bar");
  
  // Renderizar Skeletons iniciales
  renderSkeletons();

  if (state.connectionMode === "online") {
    try {
      if (progressContainer && progressBar) {
        progressContainer.style.display = "block";
        progressBar.style.width = "15%";
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(`${CONFIG.GOOGLE_SHEET_API_URL}?_t=${Date.now()}`, {
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (progressContainer && progressBar) progressBar.style.width = "50%";
      
      if (!response.ok) throw new Error("Fallo de red al conectar GAS");
      
      const db = await response.json();
      if (progressContainer && progressBar) progressBar.style.width = "85%";
      
      if (db.success) {
        if (db.version !== "v2") {
          setTimeout(() => {
            alert("⚠️ ¡ATENCIÓN SISTEMAS!\n\nTu Google Apps Script está desactualizado y la aplicación no responderá al marcar como entregado o solicitar equipos.\n\nPor favor, actualiza tu script en Google Sheets con la última versión de google_apps_script.js y asegúrate de crear una NUEVA IMPLEMENTACIÓN (Aplicación Web) en el menú.");
          }, 1000);
        }
        state.users = db.users.map(u => typeof u === "object" && u !== null ? (u.nombre || u.name || "") : u).filter(Boolean);
        // Si no hay usuarios en la nube, precargar del config.js
        if (state.users.length === 0) state.users = CONFIG.USUARIOS;

        state.biometrics = db.biometrics.length > 0 ? db.biometrics : JSON.parse(JSON.stringify(CONFIG.BIOMETRICOS));
        state.logs = db.logs;
        // Fix for notifications firing on initial load:
        lastKnownLogs = JSON.parse(JSON.stringify(state.logs));
        
        state.inkLogs = db.inkLogs;
        state.internetLogs = db.internetLogs;
        
        // Calcular estado de biometria dinámicamente con base en LOG_USO activo
        recalculateBiometricStates();

        updateConnectionBar("online", "Conectado con disponibilidad de biométricos");
        saveLocalBackup(); // Guardar copia local de respaldo
        
        if (progressContainer && progressBar) {
          progressBar.style.width = "100%";
          setTimeout(() => {
            progressContainer.style.display = "none";
            progressBar.style.width = "0%";
          }, 600);
        }
        return;
      }
    } catch (err) {
      console.error("Error al sincronizar con Google Sheets, cayendo en respaldo local:", err);
      if (progressContainer) progressContainer.style.display = "none";
    }
  }

  // Respaldo local
  updateConnectionBar("demo", "Modo Local (Respaldo/Sin conexión) - Cambios guardados en navegador");
  loadLocalDatabase();
}

// Recalcular estado de los biométricos con base en LOG_USO
function recalculateBiometricStates() {
  // Inicializar todos como disponible
  state.biometrics.forEach(b => {
    b.status = "Disponible";
    b.holder = "";
    b.time = "";
    b.logId = "";
  });

  // Recorrer logs de uso y aplicar el estado secuencialmente
  state.logs.forEach(log => {
    const bioNum = parseInt(log.biometrico);
    const bio = state.biometrics.find(b => b.biometrico == bioNum);
    if (bio) {
      if (log.estado === "Activo") {
        bio.status = "Ocupado";
        bio.holder = log.usuario;
        bio.time = log.hora_salida_solicitada;
        bio.logId = log.id;
      } else if (log.estado === "Pendiente") {
        bio.status = "Pendiente";
        bio.holder = log.usuario;
        bio.time = log.hora_salida_solicitada || "Pendiente";
        bio.logId = log.id;
      } else if (log.estado === "Entregado") {
        bio.status = "Disponible";
        bio.holder = "";
        bio.time = "";
        bio.logId = "";
      }
    }
  });
}

// Carga base de datos desde localStorage
function loadLocalDatabase() {
  const localDb = localStorage.getItem("n134_local_db");
  if (localDb) {
    const db = JSON.parse(localDb);
    state.users = db.users || CONFIG.USUARIOS;
    state.biometrics = db.biometrics || JSON.parse(JSON.stringify(CONFIG.BIOMETRICOS));
    state.logs = db.logs || [];
    state.inkLogs = db.inkLogs || [];
    state.internetLogs = db.internetLogs || [];
    recalculateBiometricStates();
  } else {
    // Inicializar base de datos local vacía con el config.js
    state.users = CONFIG.USUARIOS;
    state.biometrics = JSON.parse(JSON.stringify(CONFIG.BIOMETRICOS));
    state.biometrics.forEach(b => {
      b.status = "Disponible";
      b.holder = "";
      b.time = "";
      b.logId = "";
    });
    state.logs = [];
    state.inkLogs = [];
    state.internetLogs = [];
    saveLocalBackup();
  }
}

// Guarda una copia local en localStorage
function saveLocalBackup() {
  const dbToSave = {
    users: state.users,
    biometrics: state.biometrics,
    logs: state.logs,
    inkLogs: state.inkLogs,
    internetLogs: state.internetLogs
  };
  localStorage.setItem("n134_local_db", JSON.stringify(dbToSave));
}

// Lógica de desglose rotativo secuencial ("Gasto a la par")
function getNextSequentialBiometric() {
  // 1. Encontrar el número del último biométrico asignado en el historial logs, ignorando los Cancelados
  let lastAssignedNum = 0;
  // Recorremos los logs de atrás hacia adelante para ver el último biométrico solicitado
  for (let i = state.logs.length - 1; i >= 0; i--) {
    // Ignorar logs cancelados para no tomarlos en cuenta en la secuencia
    if (state.logs[i].estado === "Cancelado" || state.logs[i].estado === "Cancelada") continue;
    
    const num = parseInt(state.logs[i].biometrico);
    if (!isNaN(num) && num >= 1 && num <= 8) {
      lastAssignedNum = num;
      break;
    }
  }

  // 2. Determinar la secuencia a partir del último biométrico
  // Si no hay asignación previa, empezamos en 1
  let currentNum = lastAssignedNum === 0 ? 1 : (lastAssignedNum % 8) + 1;

  // 3. Probar disponibilidad en secuencia circular
  for (let step = 0; step < 8; step++) {
    const bio = state.biometrics.find(b => b.biometrico == currentNum);
    if (bio && bio.status === "Disponible") {
      return currentNum;
    }
    currentNum = (currentNum % 8) + 1;
  }

  // Si ninguno está disponible, retornar null
  return null;
}

// Actualiza el texto en la UI con el biométrico sugerido
function updateSequentialSuggestion() {
  const suggestSpan = document.getElementById("suggested-bio-name");
  const container = document.getElementById("sequential-suggested-container");
  const btn = document.getElementById("btn-request-sequential");
  const btnText = document.getElementById("btn-request-sequential-text");
  
  if (!suggestSpan) return;

  const nextBio = getNextSequentialBiometric();
  if (nextBio) {
    suggestSpan.innerText = `Biométrico ${nextBio}`;
    container.style.backgroundColor = "var(--accent-light)";
    container.style.color = "var(--accent)";
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.innerText = `⚡ Mantén para Solicitar Biométrico ${nextBio}`;
      btn.setAttribute("data-bio", nextBio);
    }
  } else {
    suggestSpan.innerText = "Ninguno disponible (Todos ocupados)";
    container.style.backgroundColor = "var(--color-error-bg)";
    container.style.color = "var(--color-error)";
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.innerText = "❌ Todos los Equipos Ocupados";
      btn.removeAttribute("data-bio");
    }
  }
}

// Renderiza Skeletons mientras se carga la app
function renderSkeletons() {
  const grids = ["user-biometrics-grid", "admin-biometrics-grid"];
  grids.forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (grid) {
      grid.innerHTML = "";
      for(let i = 0; i < 8; i++) {
        grid.innerHTML += `
          <div class="skeleton">
            <div class="skeleton-title"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-btn"></div>
          </div>
        `;
      }
    }
  });
}

// Enviar comandos al Backend en segundo plano sin bloquear al usuario
async function sendAction(action, payload) {
  // Lógica local INMEDIATA para que la app se sienta instantánea
  let localLogId = "LOG-" + new Date().getTime();
  if (action === "request") {
    const dateStr = getTodayDateString();
    const timeStr = getNowTimeString();
    
    state.logs.push({
      id: localLogId,
      biometrico: payload.biometrico,
      usuario: payload.usuario,
      fecha_salida: dateStr,
      hora_salida_solicitada: payload.hora_salida || "Al momento",
      hora_salida_real: timeStr,
      fecha_entrada: "",
      hora_entrada: "",
      estado: "Activo",
      devuelto_por: ""
    });
  } else if (action === "return") {
    const logItem = state.logs.find(l => l.id === payload.id);
    if (logItem) {
      logItem.fecha_entrada = getTodayDateString();
      logItem.hora_entrada = getNowTimeString();
      logItem.estado = "Entregado";
      logItem.devuelto_por = payload.usuario_retorno || "Admin";
    }
  } else if (action === "logInk") {
    state.inkLogs.push({
      id: "INK-" + new Date().getTime(),
      biometrico: payload.biometrico,
      fecha: getTodayDateString() + " " + getNowTimeString(),
      usuario: payload.usuario,
      observaciones: payload.observaciones
    });
  } else if (action === "logInternet") {
    state.internetLogs.push({
      id: "NET-" + new Date().getTime(),
      biometrico: payload.biometrico,
      fecha: getTodayDateString() + " " + getNowTimeString(),
      usuario: payload.usuario,
      plan: payload.plan,
      observaciones: payload.observaciones
    });
    const bio = state.biometrics.find(b => b.biometrico == payload.biometrico);
    if (bio) bio.internet_plan = payload.plan;
  } else if (action === "cancel") {
    const logItem = state.logs.find(l => l.id === payload.id);
    if (logItem) {
      logItem.estado = "Cancelado";
    }
  }

  // Guardar local, refrescar UI y sugerencias secuenciales
  saveLocalBackup();
  recalculateBiometricStates();
  renderBiometrics();
  updateSequentialSuggestion();
  if (state.currentUser && state.currentUser.role === "admin") {
    renderAdminDashboard();
  }

  // Procesar llamada a Google Sheets en segundo plano
  if (state.connectionMode === "online") {
    setButtonsState(false);
    showToast("Sincronizando con la nube...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const queryParams = new URLSearchParams({ action: action, ...payload, _t: Date.now() }).toString();
    fetch(`${CONFIG.GOOGLE_SHEET_API_URL}?${queryParams}`, {
      redirect: 'follow',
      signal: controller.signal
    })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Fallo de red al conectar GAS");
        return response.json();
      })
      .then(db => {
        if (db && db.success) {
          if (db.version !== "v2") {
            alert("⚠️ ¡ATENCIÓN SISTEMAS!\n\nTu Google Apps Script está desactualizado y la acción no se aplicó en Google Sheets.\n\nPor favor, actualiza tu script.");
          }
          
          if (db.logs) {
            state.users = db.users.map(u => typeof u === "object" && u !== null ? (u.nombre || u.name || "") : u).filter(Boolean);
            if (state.users.length === 0) state.users = CONFIG.USUARIOS;

            state.biometrics = db.biometrics.length > 0 ? db.biometrics : JSON.parse(JSON.stringify(CONFIG.BIOMETRICOS));
            state.logs = db.logs;
            state.inkLogs = db.inkLogs;
            state.internetLogs = db.internetLogs;
          }
          
          recalculateBiometricStates();
          updateConnectionBar("online", "Conectado con disponibilidad de biométricos");
          saveLocalBackup();
        } else {
          throw new Error((db && db.error) || "Error desconocido");
        }
        
        renderBiometrics();
        updateSequentialSuggestion();
        if (state.currentUser && state.currentUser.role === "admin") {
          renderAdminDashboard();
        }
        setButtonsState(true);
        hideToast();
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error("Error al guardar en la nube:", err);
        setButtonsState(true);
        hideToast();
        
        // Push to offline queue
        offlineQueue.push({ action: action, payload: payload });
        localStorage.setItem('n134_offline_queue', JSON.stringify(offlineQueue));
        updateOfflineBadge();
        
        if (err.name === 'AbortError') {
          showToast("Red muy lenta. Acción guardada en la nube pendiente (Offline).");
        } else {
          showToast("Sin internet. Acción guardada en cola local (Offline).");
        }
      });
  } else {
    showToast("Registrado localmente.");
  }

  return { success: true };
}

/* ==========================================================================
   AUTHENTICATION & LOGIN (Remember Me)
   ========================================================================== */

function switchLoginTab(role) {
  document.querySelectorAll(".role-tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".login-form").forEach(form => form.classList.remove("active"));

  if (role === "user") {
    document.getElementById("btn-role-user").classList.add("active");
    document.getElementById("form-user").classList.add("active");
  } else {
    document.getElementById("btn-role-admin").classList.add("active");
    document.getElementById("form-admin").classList.add("active");
  }
}

// Normalización de texto para búsqueda (ignora acentos)
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Búsqueda autocompletado de usuarios
function handleUserSearch(e) {
  const query = normalizeText(e.target.value);
  const list = document.getElementById("user-results");
  const loginBtn = document.getElementById("btn-login-user");
  list.innerHTML = "";
  
  // Si está vacío, mostrar los primeros 5 usuarios por defecto para que puedan seleccionar
  const matches = query === "" 
    ? state.users.slice(0, 5)
    : state.users.filter(u => normalizeText(u).includes(query)).slice(0, 5);
  
  if (matches.length > 0) {
    list.classList.remove("hidden");
    matches.forEach(name => {
      const li = document.createElement("li");
      li.innerText = name;
      li.style.padding = "12px 16px";
      li.style.cursor = "pointer";
      li.addEventListener("mousedown", (evt) => {
        // Usar mousedown para que ocurra antes del blur del input
        evt.preventDefault();
        document.getElementById("user-search").value = name;
        list.classList.add("hidden");
        loginBtn.disabled = false;
      });
      list.appendChild(li);
    });
  } else {
    list.classList.add("hidden");
    loginBtn.disabled = true;
  }
}

// Búsqueda autocompletado para el administrador en el modal
function handleAdminUserSearch(e) {
  const query = normalizeText(e.target.value);
  const list = document.getElementById("admin-user-results");
  list.innerHTML = "";
  
  if (query === "") {
    list.classList.add("hidden");
    return;
  }

  // Filtrar nombres por coincidencia parcial en cualquier posición
  const matches = state.users.filter(u => normalizeText(u).includes(query)).slice(0, 5);
  
  if (matches.length > 0) {
    list.classList.remove("hidden");
    matches.forEach(name => {
      const li = document.createElement("li");
      li.innerText = name;
      li.style.padding = "12px 16px";
      li.style.cursor = "pointer";
      li.addEventListener("mousedown", (evt) => {
        evt.preventDefault();
        document.getElementById("admin-select-user").value = name;
        list.classList.add("hidden");
      });
      list.appendChild(li);
    });
  } else {
    list.classList.add("hidden");
  }
}

// Iniciar sesión como Usuario
function loginAsUser() {
  const name = document.getElementById("user-search").value.trim();
  if (name === "" || !state.users.includes(name)) {
    showToast("Por favor selecciona un usuario válido.");
    return;
  }

  state.currentUser = { name: name, role: "user" };
  localStorage.setItem("n134_session", JSON.stringify(state.currentUser));
  
  document.getElementById("display-user-name").innerText = name;
  const adminBadge = document.getElementById("admin-badge-top");
  if (adminBadge) adminBadge.classList.add("hidden");
  
  showView("user-view");
  renderBiometrics();
  updateSequentialSuggestion();
  showToast(`Sesión iniciada como ${name}`);
}

// Iniciar sesión como Administrador
function loginAsAdmin() {
  const pin = document.getElementById("admin-pin").value;
  if (pin === CONFIG.ADMIN_PIN) {
    state.currentUser = { name: "Administrador", role: "admin" };
    localStorage.setItem("n134_session", JSON.stringify(state.currentUser));
    
    document.getElementById("display-user-name").innerText = state.currentUser.name;
    const adminBadge = document.getElementById("admin-badge-top");
    if (adminBadge) adminBadge.classList.remove("hidden");
    
    showView("admin-view");
    renderBiometrics();
    renderAdminDashboard();
    updateSequentialSuggestion();
    showToast("Sesión de administrador iniciada.");
    document.getElementById("admin-pin").value = "";
    
    // Notifications init
    requestNotificationPermission();
    startNotificationPolling();
  } else {
    showToast("PIN incorrecto. Intenta de nuevo.");
  }
}

// Cerrar Sesión
function logout() {
  state.currentUser = null;
  localStorage.removeItem("n134_session");
  stopNotificationPolling();
  
  // Limpiar campos de login
  document.getElementById("user-search").value = "";
  document.getElementById("admin-pin").value = "";
  document.getElementById("btn-login-user").disabled = true;
  
  showView("login-view");
  updateSequentialSuggestion();
  showToast("Sesión cerrada.");
}

/* ==========================================================================
   UI RENDERING
   ========================================================================== */

function showView(viewId) {
  // Manejar el contenedor principal del Dashboard vs Login
  const loginView = document.getElementById("login-view");
  const dashboardLayout = document.getElementById("dashboard-layout");
  
  if (viewId === "login-view") {
    loginView.classList.add("active");
    dashboardLayout.classList.add("hidden");
    // Ocultar vistas internas
    document.querySelectorAll(".dashboard-views .view-panel").forEach(panel => {
      panel.classList.remove("active");
    });
  } else {
    loginView.classList.remove("active");
    dashboardLayout.classList.remove("hidden");
    
    // Toggle vistas internas
    document.querySelectorAll(".dashboard-views .view-panel").forEach(panel => {
      panel.classList.remove("active");
    });
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add("active");
    
    // Ocultar sidebar en móvil al cambiar vista
    document.querySelector('.dashboard-sidebar').classList.remove('open');
      
    // Actualizar estado activo de los botones del menú lateral
    const navDashboard = document.getElementById("nav-dashboard");
    const navProfile = document.getElementById("nav-profile");
    if (navDashboard && navProfile) {
      if (viewId === "profile-view") {
        navDashboard.classList.remove("active");
        navProfile.classList.add("active");
      } else if (viewId === "admin-view" || viewId === "user-view") {
        navProfile.classList.remove("active");
        navDashboard.classList.add("active");
      }
    }
  }
  
  if (viewId === "profile-view") {
    const adminTestBlock = document.getElementById("admin-test-notification");
    if (adminTestBlock) {
      if (state.currentUser && state.currentUser.role === "admin") {
        adminTestBlock.style.display = "block";
      } else {
        adminTestBlock.style.display = "none";
      }
    }
  }
}

function updateConnectionBar(mode, text) {
  const bar = document.getElementById("connection-bar");
  const textSpan = document.getElementById("connection-text");
  
  bar.className = "connection-bar " + mode;
  textSpan.innerText = text;
}

function createActiveEquipmentChecklist(bio) {
  const card = document.createElement("div");
  card.className = "bio-card glass fade-in";
  card.style.border = "2px solid var(--accent)";
  
  const checklistId = `checklist-${bio.biometrico}`;
  
  card.innerHTML = `
    <div class="bio-card-header" style="background: var(--accent-light); margin: -20px -20px 15px -20px; padding: 15px 20px; border-radius: 12px 12px 0 0;">
      <div class="bio-title-box">
        <h4 style="color: var(--accent); font-size: 1.1rem; font-weight: 700;">Biométrico ${bio.biometrico} Asignado</h4>
      </div>
    </div>
    
    ${bio.status === 'Pendiente' ? `
      <div style="padding: 0 20px 20px; text-align: center; color: var(--text-light);">
        Tu solicitud está en espera de que pases por el equipo a la oficina.
      </div>
      <div class="card-actions" style="display: flex; gap: 10px;">
        <button class="btn btn-primary" onclick="confirmDelivery('${bio.logId}', '${bio.biometrico}')" style="flex: 1; padding: 12px 5px; font-size: 0.9rem;">✅ Ya lo recibí</button>
        <button class="btn btn-orange" onclick="cancelDelivery('${bio.logId}', '${bio.biometrico}')" style="flex: 1; padding: 12px 5px; font-size: 0.9rem;">❌ Cancelar</button>
      </div>
    ` : `
      <div class="checklist-container" id="${checklistId}" style="margin-bottom: 20px; font-size: 0.95rem;">
        <label class="checklist-item" style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" onchange="checkReturnChecklist(${bio.biometrico})" style="margin-right: 12px; width: 20px; height: 20px; accent-color: var(--accent);">
          <span>💻 Laptop ${bio.laptop_marca} ${bio.laptop_modelo}</span>
        </label>
        <label class="checklist-item" style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" onchange="checkReturnChecklist(${bio.biometrico})" style="margin-right: 12px; width: 20px; height: 20px; accent-color: var(--accent);">
          <span>🖨️ Impresora ${bio.impresora_marca} ${bio.impresora_modelo}</span>
        </label>
        <label class="checklist-item" style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" onchange="checkReturnChecklist(${bio.biometrico})" style="margin-right: 12px; width: 20px; height: 20px; accent-color: var(--accent);">
          <span>☝️ Lector ${bio.biometrico_lector}</span>
        </label>
        <label class="checklist-item" style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" onchange="checkReturnChecklist(${bio.biometrico})" style="margin-right: 12px; width: 20px; height: 20px; accent-color: var(--accent);">
          <span>📶 Router BAM ${bio.router_modelo}</span>
        </label>
      </div>
      
      <div class="card-actions">
        <button id="btn-return-${bio.biometrico}" class="btn btn-primary hold-to-confirm-btn" disabled 
                style="width: 100%; box-shadow: 0 4px 15px rgba(0, 113, 227, 0.2);">
          <div class="progress-fill"></div>
          <span>Mantén presionado para Entregar</span>
        </button>
      </div>
    `}
  `;
  
  // Attach Hold-to-Confirm logic after element is created (done in render loop or here)
  setTimeout(() => {
    const btn = document.getElementById(`btn-return-${bio.biometrico}`);
    if (!btn) return;
    
    let holdTimer;
    const holdDuration = 1500; // 1.5 seconds
    
    const startHold = (e) => {
      if (btn.disabled) return;
      e.preventDefault(); // Prevent touch scroll/click issues
      btn.classList.add("holding");
      holdTimer = setTimeout(() => {
        btn.classList.remove("holding");
        triggerReturn(bio.logId, bio.biometrico);
        // Shoot confetti on success!
        if(typeof confetti === 'function') {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()] });
        }
      }, holdDuration);
    };
    
    const stopHold = () => {
      if (btn.disabled) return;
      btn.classList.remove("holding");
      clearTimeout(holdTimer);
    };
    
    btn.addEventListener("mousedown", startHold);
    btn.addEventListener("touchstart", startHold, {passive: false});
    
    btn.addEventListener("mouseup", stopHold);
    btn.addEventListener("mouseleave", stopHold);
    btn.addEventListener("touchend", stopHold);
    btn.addEventListener("touchcancel", stopHold);
    
  }, 0);
  
  return card;
}

window.checkReturnChecklist = function(biometricoNum) {
  const container = document.getElementById(`checklist-${biometricoNum}`);
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  const btn = document.getElementById(`btn-return-${biometricoNum}`);
  if (btn) {
    btn.disabled = !allChecked;
  }
};

// Renderizar tarjetas de los biométricos
function renderBiometrics() {
  const userGrid = document.getElementById("user-biometrics-grid");
  const adminGrid = document.getElementById("admin-biometrics-grid");
  const userActiveSection = document.getElementById("user-active-equipment-section");
  const userActiveGrid = document.getElementById("user-active-equipment-container");
  
  if (userGrid) userGrid.innerHTML = "";
  if (adminGrid) adminGrid.innerHTML = "";
  if (userActiveGrid) userActiveGrid.innerHTML = "";
  
  const oldReminder = document.getElementById("pending-reminder");
  if (oldReminder) oldReminder.remove();

  let hasActiveEquipment = false;

  state.biometrics.forEach(bio => {
    // 1. Crear tarjeta para Usuarios
    const userCard = createBiometricCard(bio, "user");
    if (userGrid) userGrid.appendChild(userCard);

    // 2. Crear tarjeta para Administrador
    const adminCard = createBiometricCard(bio, "admin");
    if (adminGrid) adminGrid.appendChild(adminCard);

    // 3. Crear tarjeta activa con checklist si el usuario actual es el poseedor
    if (state.currentUser && state.currentUser.role === "user" && 
       (bio.status === "Ocupado" || bio.status === "Pendiente") && 
       bio.holder === state.currentUser.name) {
      hasActiveEquipment = true;
      const activeCard = createActiveEquipmentChecklist(bio);
      if (userActiveGrid) userActiveGrid.appendChild(activeCard);
    }

    // 4. Recordatorio de equipo pendiente para pasantes
    if (state.currentUser && state.currentUser.role === "user" && bio.status === "Pendiente" && bio.holder === state.currentUser.name) {
      const reminderDiv = document.createElement("div");
      reminderDiv.className = "alert alert-warning";
      reminderDiv.style.backgroundColor = "#fff3cd";
      reminderDiv.style.color = "#856404";
      reminderDiv.style.padding = "15px";
      reminderDiv.style.borderRadius = "8px";
      reminderDiv.style.marginBottom = "20px";
      reminderDiv.style.fontWeight = "bold";
      reminderDiv.innerHTML = `🔔 No olvides pasar por tu Biométrico ${bio.biometrico} a la oficina antes de las 4.`;
      
      // Insertar al principio de la vista de usuario
      const userView = document.getElementById("user-view");
      if (userView) {
        reminderDiv.id = "pending-reminder";
        userView.insertBefore(reminderDiv, userView.firstChild);
      }
    }
  });

  if (userActiveSection) {
    userActiveSection.style.display = hasActiveEquipment ? "block" : "none";
  }

  // Lógica para ocultar secciones completas si el usuario tiene un equipo activo
  if (state.currentUser && state.currentUser.role === "user") {
    const quickBox = document.querySelector(".quick-sequential-box");
    const othersSection = document.getElementById("user-others-section");
    
    if (hasActiveEquipment) {
      if (quickBox) quickBox.style.display = "none";
      if (othersSection) othersSection.style.display = "none";
    } else {
      if (quickBox) quickBox.style.display = "block";
      if (othersSection) othersSection.style.display = "block";
    }
  }
}

// Construye la tarjeta de biométrico dinámicamente
function createBiometricCard(bio, role) {
  const card = document.createElement("div");
  card.className = "bio-card glass fade-in";
  card.id = `bio-card-${bio.biometrico}`;
  const isAvailable = bio.status === "Disponible";
  const statusClass = isAvailable ? "available" : "occupied";
  const statusText = isAvailable ? "Disponible" : "Ocupado";

  card.innerHTML = `
    <div class="bio-card-header">
      <div class="bio-title-box">
        <h4>Biométrico ${bio.biometrico}</h4>
        <div class="bio-phone-number">Chip: ${bio.bam_telefono || 'Sin Asignar'}</div>
      </div>
      <span class="state-pill ${statusClass}">${statusText}</span>
    </div>
    
    <div class="hw-info-box">
      <div class="hw-item">
        <span class="hw-icon"><img src="assets/icons/laptop.png" class="hw-icon-img" alt="Laptop"></span>
        <div class="hw-desc">${bio.laptop_marca} ${bio.laptop_modelo} <span>S/N: ${bio.laptop_serie}</span></div>
      </div>
      <div class="hw-item">
        <span class="hw-icon"><img src="assets/icons/printer.png" class="hw-icon-img" alt="Impresora"></span>
        <div class="hw-desc">${bio.impresora_marca} ${bio.impresora_modelo} <span>S/N: ${bio.impresora_serie}</span></div>
      </div>
      <div class="hw-item">
        <span class="hw-icon"><img src="assets/icons/touch.png" class="hw-icon-img" alt="Lector"></span>
        <div class="hw-desc">${bio.biometrico_lector} <span>S/N: ${bio.biometrico_serie}</span></div>
      </div>
      <div class="hw-item">
        <span class="hw-icon"><img src="assets/icons/bam.png" class="hw-icon-img" alt="BAM"></span>
        <div class="hw-desc">BAM ${bio.router_modelo} <span>IMEI: ${bio.router_imei}</span></div>
      </div>
      ${bio.internet_plan ? `
      <div class="hw-item" style="margin-top: 4px; border-top: 1px solid var(--border-light); padding-top: 4px;">
        <span class="hw-icon">🌐</span>
        <div class="hw-desc" style="color: var(--accent); font-weight: 500;">Plan: ${bio.internet_plan}</div>
      </div>` : ''}
    </div>
    
    ${!isAvailable ? `
    <div class="holder-box">
      <span class="holder-label">En uso por:</span>
      <span class="holder-name">${bio.holder}</span>
      <span class="holder-time">Salida programada: ${bio.time}</span>
    </div>` : ''}

    <div class="card-actions">
      ${role === "user" ? 
        (isAvailable ? 
          (() => {
            const nextBio = getNextSequentialBiometric();
            if (nextBio == bio.biometrico) {
              return `<button class="btn btn-primary" onclick="openRequestModal(${bio.biometrico})">Solicitar Salida</button>`;
            } else {
              return `<button class="btn btn-secondary" style="opacity: 0.6; cursor: not-allowed;" onclick="showToast('Por favor solicita el Biométrico ${nextBio || 'disponible'}, asignado por desgaste para uso a la par.')">Solicitar Salida</button>`;
            }
          })() : 
          (bio.holder === state.currentUser?.name ? 
            `<button class="btn btn-secondary" disabled>En posesión (Ver Mis Equipos arriba)</button>` : 
            `<button class="btn btn-secondary" disabled>No Disponible</button>`
          )
        ) : 
        // Acciones del Administrador
        (isAvailable ? 
          `<button class="btn btn-primary" onclick="openRequestModal(${bio.biometrico})">Asignar Equipo</button>` : 
          (() => {
            if (bio.status === "Pendiente") {
              return `
              <button class="btn btn-blinking-red" style="margin-bottom: 6px;" onclick="confirmDelivery('${bio.logId}', '${bio.biometrico}')"><span class="running-icon">🏃🏽‍♂️</span> Pendiente de entregar a pasante</button>
              <button class="btn btn-orange" onclick="cancelDelivery('${bio.logId}', '${bio.biometrico}')">❌ Cancelar</button>
              `;
            } else {
              return `
              <button class="btn btn-primary" onclick="triggerPrintResponsive('${bio.logId}')">Visualizar e Imprimir</button>
              <button class="btn btn-secondary" onclick="triggerReturn('${bio.logId}', '${bio.biometrico}')">Marcar como Entregado (Devolución)</button>
              `;
            }
          })()
        )
      }
    </div>
  `;

  return card;
}

// Cargar datos en el Panel del Administrador (Métricas, Historial)
function renderAdminDashboard() {
  // Actualizar métricas
  const totalUses = state.logs.length;
  const occupiedCount = state.biometrics.filter(b => b.status === "Ocupado").length;
  const availableCount = 8 - occupiedCount;

  document.getElementById("stat-total-uses").innerText = totalUses;
  document.getElementById("stat-occupied").innerText = occupiedCount;
  document.getElementById("stat-available").innerText = availableCount;

  // Renderizar historial de uso completo
  const tbody = document.getElementById("history-tbody");
  tbody.innerHTML = "";

  if (state.logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No hay registros aún</td></tr>`;
  } else {
    // Clonar e invertir para ver primero lo más nuevo
    const sortedLogs = [...state.logs].reverse();
    sortedLogs.forEach(log => {
      const tr = document.createElement("tr");
      const isReturned = log.estado === "Entregado";
      
      tr.innerHTML = `
        <td><strong>Bio ${log.biometrico}</strong></td>
        <td>${log.usuario}</td>
        <td>${log.fecha_salida}</td>
        <td>${log.hora_salida_solicitada}</td>
        <td>${log.hora_salida_real}</td>
        <td>${log.fecha_entrada || '—'}</td>
        <td>${log.hora_entrada || '—'}</td>
        <td>
          <span class="state-pill ${isReturned ? 'available' : 'occupied'}">
            ${log.estado}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="triggerPrintResponsive('${log.id}')">Carta</button>
            ${!isReturned ? `<button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem; background-color:#86868B;" onclick="triggerReturn('${log.id}', '${log.biometrico}')">Retorno</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Renderizar historial de tintas
  const inkTbody = document.getElementById("ink-history-tbody");
  inkTbody.innerHTML = "";
  if (state.inkLogs.length === 0) {
    inkTbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay registros de cambios</td></tr>`;
  } else {
    [...state.inkLogs].reverse().forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.fecha}</td>
        <td><strong>Bio ${log.biometrico}</strong></td>
        <td>${log.usuario}</td>
        <td>${log.observaciones || 'Sin notas'}</td>
      `;
      inkTbody.appendChild(tr);
    });
  }

  // Renderizar historial de Internet
  const netTbody = document.getElementById("net-history-tbody");
  netTbody.innerHTML = "";
  if (state.internetLogs.length === 0) {
    netTbody.innerHTML = `<tr><td colspan="5" class="text-center">No hay renovaciones de datos</td></tr>`;
  } else {
    [...state.internetLogs].reverse().forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.fecha}</td>
        <td><strong>Bio ${log.biometrico}</strong></td>
        <td style="color:var(--accent); font-weight:600;">${log.plan}</td>
        <td>${log.usuario}</td>
        <td>${log.observaciones || '—'}</td>
      `;
      netTbody.appendChild(tr);
    });
  }
}

// Rellenar horas de salida de 7:00 AM a 4:00 PM
function populateExitTimeDropdown() {
  const select = document.getElementById("select-exit-time");
  select.innerHTML = "";
  
  // Agregar hora de salida "Al momento"
  const optNow = document.createElement("option");
  optNow.value = "";
  optNow.innerText = "Al momento (Hora actual)";
  select.appendChild(optNow);

  const startHour = 7;
  const endHour = 16; // 4:00 PM

  for (let h = startHour; h <= endHour; h++) {
    const formattedHour = h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    
    // Hora en punto
    const opt1 = document.createElement("option");
    opt1.value = `${h}:00`;
    opt1.innerText = `${formattedHour}:00 ${ampm}`;
    select.appendChild(opt1);

    // Medias horas (excepto a las 4:00 PM)
    if (h < endHour) {
      const opt2 = document.createElement("option");
      opt2.value = `${h}:30`;
      opt2.innerText = `${formattedHour}:30 ${ampm}`;
      select.appendChild(opt2);
    }
  }
}

/* ==========================================================================
   INTERACTIONS & OPERATIONS
   ========================================================================== */

let selectedBiometricNum = null;

// Abrir modal de reserva
function openRequestModal(bioNum) {
  if (state.currentUser && state.currentUser.role === "user") {
    const nextBio = getNextSequentialBiometric();
    if (nextBio && nextBio != bioNum) {
      showToast(`Acceso denegado: Debes solicitar el Biométrico ${nextBio}.`);
      return;
    }
  }

  selectedBiometricNum = bioNum;
  const bio = state.biometrics.find(b => b.biometrico == bioNum);
  
  document.getElementById("txt-modal-bio-name").innerText = `Biométrico ${bioNum}`;
  document.getElementById("txt-modal-bio-hw").innerHTML = `
    <ul>
      <li>💻 <strong>Laptop:</strong> ${bio.laptop_marca} ${bio.laptop_modelo} (S/N: ${bio.laptop_serie})</li>
      <li>🖨️ <strong>Impresora:</strong> ${bio.impresora_marca} ${bio.impresora_modelo} (S/N: ${bio.impresora_serie})</li>
      <li>📶 <strong>BAM:</strong> ${bio.router_modelo} (Chip: ${bio.bam_telefono})</li>
    </ul>
  `;

  // Controlar visibilidad del selector de usuario para Admin
  const adminUserGroup = document.getElementById("admin-user-selector-group");
  const adminUserInput = document.getElementById("admin-select-user");
  const adminUserResults = document.getElementById("admin-user-results");
  
  adminUserInput.value = "";
  adminUserResults.innerHTML = "";
  adminUserResults.classList.add("hidden");

  if (state.currentUser && state.currentUser.role === "admin") {
    adminUserGroup.classList.remove("hidden");
  } else {
    adminUserGroup.classList.add("hidden");
  }

  openModal("modal-reserve");
}

// Confirmar y realizar la solicitud
async function confirmReservation() {
  const exitTime = document.getElementById("select-exit-time").value;
  let userToAssign = "";

  if (state.currentUser && state.currentUser.role === "admin") {
    const chosenUser = document.getElementById("admin-select-user").value.trim();
    if (chosenUser === "") {
      showToast("Por favor selecciona o escribe el nombre del usuario.");
      return;
    }
    if (!state.users.includes(chosenUser)) {
      showToast("Por favor selecciona un usuario válido del listado oficial.");
      return;
    }
    userToAssign = chosenUser;
  } else {
    userToAssign = state.currentUser.name;
  }
  
  closeModal();

  if (selectedBiometricNum) {
    const res = await sendAction("request", {
      biometrico: selectedBiometricNum,
      usuario: userToAssign,
      hora_salida: exitTime
    });
  }
}

// Devolver un biométrico
async function triggerReturn(logId, biometrico) {
  if (confirm("¿Confirmas la entrega/retorno de este equipo biométrico a su lugar?")) {
    const role = (state.currentUser && state.currentUser.role) ? state.currentUser.role : "admin";
    const name = (state.currentUser && state.currentUser.name) ? state.currentUser.name : "Administrador";
    const userRetorno = role === "admin" ? "Administrador" : name;
    const res = await sendAction("return", {
      id: logId || "",
      biometrico: biometrico,
      usuario_retorno: userRetorno
    });
  }
}

// Confirmar entrega de un biométrico (backend)
window.confirmDelivery = async function(logId, bioNum) {
  const res = await sendAction("confirm", { id: logId, biometrico: bioNum });
  if (res && res.success) {
    showToast("Entrega confirmada con éxito");
    fetchDatabase();
  } else {
    showToast("Error al confirmar la entrega", true);
  }
};

// Cancelar solicitud de un biométrico (borra registro)
window.cancelDelivery = async function(logId, bioNum) {
  if (confirm(`¿Estás seguro de cancelar la solicitud del Biométrico ${bioNum}?`)) {
    const res = await sendAction("cancel", { id: logId, biometrico: bioNum });
    if (res && res.success) {
      showToast("Solicitud cancelada");
      fetchDatabase();
    }
  }
}

// Registrar cambio de tintas
async function submitInkLog(e) {
  e.preventDefault();
  const bio = document.getElementById("ink-biometric").value;
  const user = document.getElementById("ink-user").value;
  const notes = document.getElementById("ink-notes").value;

  const res = await sendAction("logInk", {
    biometrico: bio,
    usuario: user,
    observaciones: notes
  });

  if (res.success) {
    document.getElementById("ink-form").reset();
    document.getElementById("ink-user").value = "Administrador";
    showToast("Cambio de tinta registrado con éxito.");
  }
}

// Registrar recarga de BAM
async function submitInternetLog(e) {
  e.preventDefault();
  const bio = document.getElementById("net-biometric").value;
  const plan = document.getElementById("net-plan").value;
  const user = document.getElementById("net-user").value;
  const notes = document.getElementById("net-notes").value;

  const res = await sendAction("logInternet", {
    biometrico: bio,
    plan: plan,
    usuario: user,
    observaciones: notes
  });

  if (res.success) {
    document.getElementById("internet-form").reset();
    document.getElementById("net-user").value = "Administrador";
    showToast("Plan BAM registrado y actualizado.");
  }
}

// Filtrar historial
function filterHistoryTable(e) {
  const query = e.target.value.toLowerCase().trim();
  const rows = document.querySelectorAll("#history-tbody tr");
  
  rows.forEach(row => {
    if (row.cells.length < 2) return; // Saltarse fila de "No hay registros"
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

/* ==========================================================================
   CARTA RESPONSIVA GENERATOR & PRINTING
   ========================================================================== */

function triggerPrintResponsive(logId) {
  const log = state.logs.find(l => l.id === logId);
  if (!log) return;

  const bio = state.biometrics.find(b => b.biometrico == log.biometrico);
  if (!bio) return;

  // Generar HTML del documento
  const paperHtml = generateResponsivaHtml(log, bio, false);
  const printAreaHtml = generateResponsivaHtml(log, bio, true);

  // Inyectar en el modal de previsualización
  document.getElementById("responsiva-paper-container").innerHTML = paperHtml;
  
  // Inyectar en la sección de impresión dedicada de la página
  document.getElementById("print-area").innerHTML = printAreaHtml;

  openModal("modal-print");
}

function generateResponsivaHtml(log, bio, forPrint) {
  const containerId = forPrint ? "responsiva-paper-container-print" : "";
  const dateObj = parseDateString(log.fecha_salida || getTodayDateString());
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dateFormatted = `${dateObj.day} de ${monthNames[dateObj.month - 1]} de ${dateObj.year}`;
  const timeFormatted = log.hora_salida_solicitada || log.hora_salida_real || getNowTimeString();

  // Logo de la Notaría 134 en SVG idéntico al original
  const logoSvg = `
    <svg width="125" height="60" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg" style="border: 1px solid #000; padding: 2px;">
      <rect x="80" y="2" width="55" height="35" fill="#1C1C1E" rx="2" ry="2"/>
      <text x="107" y="26" font-family="'Outfit', 'Arial', sans-serif" font-weight="800" font-size="24" fill="#FFFFFF" text-anchor="middle">134</text>
      <text x="5" y="45" font-family="'Brush Script MT', 'Georgia', cursive" font-style="italic" font-weight="bold" font-size="34" fill="#000000">Notaría</text>
      <path d="M 5 50 Q 50 55 90 50" fill="none" stroke="#000000" stroke-width="1.5"/>
      <circle cx="95" cy="53" r="12" fill="none" stroke="#555555" stroke-width="1" stroke-dasharray="2,1"/>
      <circle cx="95" cy="53" r="10" fill="none" stroke="#555555" stroke-width="0.8"/>
      <text x="95" y="56" font-family="Arial" font-size="4" fill="#555555" text-anchor="middle" font-weight="bold">NOTARIA 134</text>
    </svg>
  `;

  return `
    <div id="${containerId}" class="excel-responsiva-sheet">
      <table class="excel-grid-table">
        <!-- Row 1: Logo and Main Title -->
        <tr class="excel-row">
          <td rowspan="2" colspan="2" class="excel-cell logo-cell" style="width: 30%;">${logoSvg}</td>
          <td colspan="4" class="excel-cell main-title">RESPONSIVA DE EQUIPO DE COMPUTO</td>
        </tr>
        <!-- Row 2: Biometric Subtitle -->
        <tr class="excel-row">
          <td colspan="4" class="excel-cell sub-title">BIOMETRICO ${log.biometrico}</td>
        </tr>
        <!-- Row 3: Spacer -->
        <tr class="excel-row spacer-row"><td colspan="6"></td></tr>
        <!-- Row 4: User Info -->
        <tr class="excel-row">
          <td class="excel-cell label-cell" style="width: 22%;">NOMBRE DEL USUARIO:</td>
          <td colspan="2" class="excel-cell value-cell highlight-cell" style="width: 38%;">${log.usuario}</td>
          <td class="excel-cell value-cell centered-cell font-bold" style="width: 15%;">${bio.bam_telefono || '—'}</td>
          <td colspan="2" class="excel-cell value-cell centered-cell font-bold" style="width: 25%;">${bio.internet_plan || '—'}</td>
        </tr>
        <!-- Row 5: Spacer -->
        <tr class="excel-row spacer-row"><td colspan="6"></td></tr>
        <!-- Row 6: Department -->
        <tr class="excel-row">
          <td class="excel-cell label-cell">DEPARTAMENTO:</td>
          <td colspan="5" class="excel-cell value-cell highlight-cell">PASANTES</td>
        </tr>
        <!-- Row 7: Spacer -->
        <tr class="excel-row spacer-row"><td colspan="6"></td></tr>
        <!-- Row 8: Date -->
        <tr class="excel-row">
          <td colspan="3" class="excel-cell border-none" style="border:none;"></td>
          <td class="excel-cell label-cell italic-cell">FECHA DE ENTREGA DEL EQUIPO:</td>
          <td colspan="2" class="excel-cell value-cell centered-cell font-bold">${dateFormatted} ${timeFormatted}</td>
        </tr>
        <!-- Row 9: Spacer -->
        <tr class="excel-row spacer-row"><td colspan="6"></td></tr>
        <!-- Row 10: Section Header -->
        <tr class="excel-row">
          <td colspan="6" class="excel-cell section-header">DESCRIPCION DEL EQUIPO</td>
        </tr>
        <!-- Row 11: Column Headers -->
        <tr class="excel-row header-row">
          <td style="width: 20%;">TIPO</td>
          <td style="width: 15%;">MARCA</td>
          <td style="width: 15%;">MODELO</td>
          <td style="width: 15%;">No. SERIE</td>
          <td style="width: 10%;">CARGADA</td>
          <td style="width: 25%;">OBSERVACIONES</td>
        </tr>
        <!-- Row 12: Laptop -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">LAP TOP</td>
          <td class="excel-cell">${bio.laptop_marca}</td>
          <td class="excel-cell">${bio.laptop_modelo}</td>
          <td class="excel-cell">${bio.laptop_serie}</td>
          <td class="excel-cell centered-cell">100%</td>
          <td rowspan="6" class="excel-cell obs-cell">
            El equipo se entrega con cargador para Lap Top, Cargador para Impresora, cable usb de conexión para la impresora desde la Lap Top, Equipo Biometrico
          </td>
        </tr>
        <!-- Row 13: Printer -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">IMPRESORA PORTATIL</td>
          <td class="excel-cell">${bio.impresora_marca}</td>
          <td class="excel-cell">${bio.impresora_modelo}</td>
          <td class="excel-cell">${bio.impresora_serie}</td>
          <td class="excel-cell centered-cell">100%</td>
        </tr>
        <!-- Row 14: Biometric -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">BIOMETRICO</td>
          <td class="excel-cell">U.are.U / HID</td>
          <td class="excel-cell">${bio.biometrico_lector}</td>
          <td class="excel-cell">${bio.biometrico_serie}</td>
          <td class="excel-cell"></td>
        </tr>
        <!-- Row 15: Router -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">ROUTER MOBILE</td>
          <td class="excel-cell">${bio.router_modelo}</td>
          <td class="excel-cell"></td>
          <td class="excel-cell">${bio.router_imei}</td>
          <td class="excel-cell"></td>
        </tr>
        <!-- Row 16: Maletin -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">MALETIN PORTA LAP</td>
          <td class="excel-cell">Genérico</td>
          <td class="excel-cell">Porta Laptop</td>
          <td class="excel-cell">—</td>
          <td class="excel-cell"></td>
        </tr>
        <!-- Row 17: Otro -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">OTRO</td>
          <td class="excel-cell"></td>
          <td class="excel-cell"></td>
          <td class="excel-cell"></td>
          <td class="excel-cell"></td>
        </tr>
        <!-- Row 18: Section Header Peripherals -->
        <tr class="excel-row">
          <td colspan="6" class="excel-cell section-header">DISPOSITIVOS PERIFERICO</td>
        </tr>
        <!-- Row 19: Peripherals Headers -->
        <tr class="excel-row header-row">
          <td>TIPO</td>
          <td>CAPACIDAD</td>
          <td>VELOCIDAD</td>
          <td colspan="3">OBSERVACIONES</td>
        </tr>
        <!-- Row 20-27: Peripherals List -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">PROCESADOR</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">DISCO DURO</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">MEMORIA RAM</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">UNIDAD 3.5</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">CD-ROM</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">DVD-ROM</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">OTRO</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <tr class="excel-row">
          <td class="excel-cell font-bold">OTRO</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <!-- Row 28: Section Header Software -->
        <tr class="excel-row">
          <td colspan="6" class="excel-cell section-header">DESCRIPCION DE SOFTWARE</td>
        </tr>
        <!-- Row 29: Software Headers -->
        <tr class="excel-row header-row">
          <td>NOMBRE DEL PRODUCTO</td>
          <td></td><td></td>
          <td colspan="3"></td>
        </tr>
        <!-- Row 30: Windows -->
        <tr class="excel-row">
          <td class="excel-cell font-bold">WINDOWS</td>
          <td class="excel-cell"></td><td class="excel-cell"></td>
          <td colspan="3" class="excel-cell"></td>
        </tr>
        <!-- Row 31-33: Spacer/Grid Filler -->
        <tr class="excel-row"><td class="excel-cell"></td><td class="excel-cell"></td><td class="excel-cell"></td><td colspan="3" class="excel-cell"></td></tr>
        <tr class="excel-row"><td class="excel-cell"></td><td class="excel-cell"></td><td class="excel-cell"></td><td colspan="3" class="excel-cell"></td></tr>
        <tr class="excel-row"><td class="excel-cell"></td><td class="excel-cell"></td><td class="excel-cell"></td><td colspan="3" class="excel-cell"></td></tr>
      </table>

      <!-- Legal Clauses -->
      <div class="responsiva-legal-text" style="font-family: 'Times New Roman', serif; text-align: justify; margin-top: 15px; font-size: 8.5pt; line-height: 1.25; color: #000000;">
        Recibí el equipo de cómputo y software instalado descritos en esta responsiva como herramienta de trabajo, 
        obligándome en términos dispuestos por la fracción VI del artículo 134 y por la fracción II y IX del artículo 135 
        de la Ley Federal del Trabajo. Manifestando que lo usaré y destinaré única y exclusivamente para el desempeño de 
        mis funciones y actividades encomendadas por mi único patrón <strong>OMAR LOZANO TORRES</strong>.<br><br>
        Así mismo con la firma de la presente me comprometo a no instalar en el equipo otro software diferente al 
        descrito en la presente responsiva y notificar inmediatamente al área de sistemas cualquier siniestro y/o 
        requerimiento de servicio o reparación que llegase a necesitar tanto el equipo como el software.<br><br>
        En el momento en que me sea requerido por la sociedad me comprometo a entregar a ésta el equipo y software 
        mencionado, en las mismas condiciones en que los he recibido sin más deterioro que el ocasionado por el uso 
        normal y el transcurso del tiempo.<br><br>
        Para el caso de la terminación de la relación laboral por cualquier causa o bien que me sea requerido el equipo 
        en cualquier momento, me obligo a entregar inmediatamente el equipo asignado. Y en el evento de que dicho equipo 
        no lo entregue en el momento que me sea requerido por mi Patrón, o entregándolo presente algún daño, ya sea 
        intencional o negligencia inexcusable me obligo a cubrir el pago de los daños o perjuicios ocasionados, autorizando 
        que me sea descontado de mi pago de salarios o bien me sea descontado de mi finiquito en caso de terminación de 
        la relación laboral.<br><br>
        En virtud de lo anterior, desde ahora me hago sabedor del contenido de los artículos 213 en su fracción XVII, 
        artículo 223 fracción I y del artículo 224 de la Ley Federal de la Propiedad Industrial y demás relativos aplicables 
        por lo que me responsabilizo de las consecuencias por el mal uso, daño provocado o indebida disposición del hardware 
        o del software descritos o instalados por mi cuenta, comprometiéndome a pagar cualquier sanción, multa, daño o 
        perjuicio ocasionado por mi negligencia o mala fe, obligándome a responder de ello ante la propia sociedad o ante 
        cualquier tercero que en su caso resulte afectado.
      </div>
      
      <!-- Footer Signature Block -->
      <div class="responsiva-footer" style="margin-top: 25px; text-align: center; font-family: 'Times New Roman', serif; color: #000000;">
        <div class="responsiva-signature-box" style="width: 50%; margin: 0 auto; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 9pt;">
          ${log.usuario}<br>
          <span style="font-size: 8pt; font-weight: normal; color: #333;">NOMBRE COMPLETO Y FIRMA DE CONFORMIDAD</span>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   EXCEL IMPORT & EXPORT (SheetJS)
   ========================================================================== */

function processExcelFile(file) {
  const statusDiv = document.getElementById("import-status");
  statusDiv.className = "import-status";
  statusDiv.innerHTML = "Procesando archivo...";
  statusDiv.classList.remove("hidden");

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { 
        type: "array", 
        cellStyles: true, 
        cellFormulas: true, 
        cellDates: true, 
        cellNF: true 
      });
      state.originalWorkbook = workbook;
      state.originalWorkbookBuffer = e.target.result;
      
      // Parsear Usuarios si existe la hoja
      let importedUsers = [];
      if (workbook.Sheets["USUARIOS"]) {
        const uSheet = workbook.Sheets["USUARIOS"];
        const rows = XLSX.utils.sheet_to_json(uSheet);
        rows.forEach(r => {
          // Leer la columna del nombre
          const keys = Object.keys(r);
          if (keys.length > 0) {
            const name = r[keys[0]] || r["nombre"] || r["NOMBRE"];
            if (name && typeof name === "string") {
              importedUsers.push(name.trim());
            }
          }
        });
      }

      // Parsear Equipos
      let importedBiometrics = [];
      // Intentar leer hoja de EQUIPOS consolidada
      if (workbook.Sheets["EQUIPOS"]) {
        importedBiometrics = XLSX.utils.sheet_to_json(workbook.Sheets["EQUIPOS"]);
      } else {
        // Fallback: Intentar extraer datos recorriendo hojas BIO 1 a BIO 8
        for (let i = 1; i <= 8; i++) {
          const sheetName = `BIO ${i}`;
          if (workbook.Sheets[sheetName]) {
            const sheet = workbook.Sheets[sheetName];
            // Extraer celdas clave
            // E4 = bam_telefono
            const cellE4 = sheet["E4"] ? sheet["E4"].v : "";
            // F4 = internet_plan
            const cellF4 = sheet["F4"] ? sheet["F4"].v : "";
            
            // Fila 12: Laptop
            const laptop_marca = sheet["B12"] ? sheet["B12"].v : "";
            const laptop_modelo = sheet["C12"] ? sheet["C12"].v : "";
            const laptop_serie = sheet["D12"] ? sheet["D12"].v : "";

            // Fila 13: Impresora
            const impresora_marca = sheet["B13"] ? sheet["B13"].v : "";
            const impresora_modelo = sheet["C13"] ? sheet["C13"].v : "";
            const impresora_serie = sheet["D13"] ? sheet["D13"].v : "";

            // Fila 14: Biometrico
            const biometrico_lector = sheet["B14"] ? sheet["B14"].v : "";
            const biometrico_serie = sheet["D14"] ? sheet["D14"].v : "";

            // Fila 15: Router
            const router_modelo = sheet["B15"] ? sheet["B15"].v : "";
            const router_imei = sheet["D15"] ? sheet["D15"].v : "";

            importedBiometrics.push({
              biometrico: i,
              bam_telefono: cellE4,
              internet_plan: cellF4,
              laptop_marca: laptop_marca,
              laptop_modelo: laptop_modelo,
              laptop_serie: laptop_serie,
              impresora_marca: impresora_marca,
              impresora_modelo: impresora_modelo,
              impresora_serie: impresora_serie,
              biometrico_lector: biometrico_lector,
              biometrico_serie: biometrico_serie,
              router_modelo: router_modelo,
              router_imei: router_imei
            });
          }
        }
      }

      // Si no importó usuarios ni biométricos, arrojar error
      if (importedUsers.length === 0 && importedBiometrics.length === 0) {
        throw new Error("No se encontró una estructura compatible en el archivo Excel.");
      }

      // Sincronizar localmente y enviar a Google Sheets si aplica
      if (importedUsers.length > 0) state.users = importedUsers;
      if (importedBiometrics.length > 0) {
        state.biometrics = importedBiometrics;
        recalculateBiometricStates();
      }

      // Enviar a la nube en caso de modo online
      if (state.connectionMode === "online") {
        const usersArray = state.users.map(u => ({ nombre: u, rol: "Pasante" }));
        await sendAction("syncAll", {
          users: usersArray,
          biometrics: state.biometrics
        });
      } else {
        saveLocalBackup();
        renderBiometrics();
        renderAdminDashboard();
      }

      statusDiv.className = "import-status success";
      statusDiv.innerHTML = `<strong>Éxito:</strong> Archivo procesado correctamente. Cargados ${state.users.length} usuarios y ${state.biometrics.length} equipos biométricos.`;
      
      setTimeout(() => {
        closeModal();
        statusDiv.classList.add("hidden");
      }, 2500);

    } catch (err) {
      statusDiv.className = "import-status error";
      statusDiv.innerHTML = `<strong>Error de importación:</strong> ${err.message}`;
    }
  };
  reader.readAsArrayBuffer(file);
}

// Handle manual file selection
function handleExcelFileSelect(e) {
  if (e.target.files.length > 0) {
    processExcelFile(e.target.files[0]);
  }
}

// Exportar Base de Datos Completa a Excel (.xlsx) conservando formato del jefe
async function exportToExcel() {
  const dateStr = getTodayDateString().replace(/-/g, "");

  // Si no tenemos la plantilla precargada en buffer, la pedimos del archivo subido originalmente
  if (!state.originalWorkbookBuffer) {
    try {
      showLoadingToast("Buscando plantilla de Excel original...");
      const response = await fetch('RESPONSIVA DE EQUIPO DE COMPUTO Firmas 1 JULIO 2022.xlsx');
      if (response.ok) {
        state.originalWorkbookBuffer = await response.arrayBuffer();
        hideToast();
      } else {
        throw new Error("No se pudo autodescargar la plantilla original. Asegúrate de haber importado el Excel primero en el administrador.");
      }
    } catch (err) {
      console.warn("Fallo al intentar descargar plantilla automáticamente:", err);
      hideToast();
      alert("Error: Para poder exportar con el formato del jefe, primero debes importar/arrastrar el archivo original 'RESPONSIVA DE EQUIPO DE COMPUTO Firmas 1 JULIO 2022.xlsx' en la zona de importación.");
      return;
    }
  }

  try {
    showLoadingToast("Generando Excel con formatos originales...");
    const workbook = await XlsxPopulate.fromDataAsync(state.originalWorkbookBuffer);

    // 1. Actualizar las responsivas en las pestañas BIO 1 a BIO 8
    for (let i = 1; i <= 8; i++) {
      const sheetName = `BIO ${i}`;
      const sheet = workbook.sheet(sheetName);
      if (sheet) {
        const bio = state.biometrics.find(b => b.biometrico == i);
        if (bio) {
          const isOccupied = bio.status === "Ocupado";
          
          // Escribir en B4 (Usuario)
          sheet.cell("B4").value(isOccupied ? bio.holder : null);
          
          // Escribir en A54 (Firma)
          sheet.cell("A54").value(isOccupied ? bio.holder : null);

          // Escribir en F8 (Fecha de préstamo)
          if (isOccupied) {
            const activeLog = state.logs.find(l => l.biometrico == i && l.estado === "Activo");
            if (activeLog) {
              const fullDateStr = activeLog.fecha_salida + " " + activeLog.hora_salida_real;
              sheet.cell("F8").value(new Date(fullDateStr.replace(/-/g, "/")));
            }
          } else {
            sheet.cell("F8").value(null);
          }

          // Escribir en F4 (Plan BAM)
          sheet.cell("F4").value(bio.internet_plan || null);
        }
      }
    }

    // 2. Actualizar la pestaña ESTADISTICAS usando las funciones del ayudante
    const estSheet = workbook.sheet("ESTADISTICAS");
    if (estSheet) {
      writeEstadisticasData(estSheet, state);
    }

    // 3. Actualizar la pestaña USUARIOS
    const usrSheet = workbook.sheet("USUARIOS");
    if (usrSheet) {
      // Limpiar registros antiguos desde la fila 4 a la 500 para la columna B (2)
      for (let r = 4; r <= 500; r++) {
        usrSheet.row(r).cell(2).value(null);
      }
      
      // Escribir los nombres de los usuarios
      state.users.forEach((user, idx) => {
        const r = 4 + idx;
        const cellB = usrSheet.row(r).cell(2);
        cellB.value(user);
        if (r > 4) {
          try { cellB.style(usrSheet.row(4).cell(2).style()); } catch(e){}
        }
      });
    }

    // 4. Escribir las pestañas auxiliares con formato profesional usando las funciones del ayudante
    writeAuxiliarySheets(workbook, state);

    // 5. Descargar archivo
    const blob = await workbook.outputAsync();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESPONSIVA DE EQUIPO DE COMPUTO Firmas_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    hideToast();
    showToast("Excel exportado conservando formatos originales, estilos y fórmulas.");
  } catch (err) {
    console.error("Fallo durante la exportación con xlsx-populate:", err);
    hideToast();
    alert("Error de Formato Excel: " + err.message + "\n\nPor favor asegúrate de haber importado el Excel de tu jefe en el gestor antes de descargar.");
  }
}

// Fallback de exportación usando SheetJS (formato plano, para emergencias)
function exportToExcelFallback() {
  const dateStr = getTodayDateString().replace(/-/g, "");
  const wb = XLSX.utils.book_new();
  
  const wsEquipos = XLSX.utils.json_to_sheet(state.biometrics);
  XLSX.utils.book_append_sheet(wb, wsEquipos, "EQUIPOS");
  
  const wsLogUso = XLSX.utils.json_to_sheet(state.logs);
  XLSX.utils.book_append_sheet(wb, wsLogUso, "LOG_USO");
  
  const wsInk = XLSX.utils.json_to_sheet(state.inkLogs);
  XLSX.utils.book_append_sheet(wb, wsInk, "LOG_TINTAS");
  
  const wsNet = XLSX.utils.json_to_sheet(state.internetLogs);
  XLSX.utils.book_append_sheet(wb, wsNet, "LOG_INTERNET");
  
  const formattedUsers = state.users.map(name => ({ nombre: name, rol: "Pasante" }));
  const wsUsuarios = XLSX.utils.json_to_sheet(formattedUsers);
  XLSX.utils.book_append_sheet(wb, wsUsuarios, "USUARIOS");
  
  XLSX.writeFile(wb, `BIOMETRICOS_N134_RESPALDO_${dateStr}.xlsx`);
  showToast("Excel básico generado (Respaldo).");
}

// Convertir índice numérico a letras de columna de Excel (1 = A, 2 = B, etc.)
function getColumnLetter(colIndex) {
  let temp, letter = "";
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}

/* ==========================================================================
   MODAL UTILITIES & TOASTS
   ========================================================================== */

function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal() {
  document.querySelectorAll(".modal").forEach(modal => modal.classList.remove("active"));
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.remove("hidden");
  // Reflow trigger to allow animation restart
  void toast.offsetWidth;
  toast.classList.add("show");
  
  if (duration > 0) {
    setTimeout(hideToast, duration);
  }
}

function showLoadingToast(message) {
  showToast(message, 0);
}

function hideToast() {
  const toast = document.getElementById("toast");
  toast.classList.remove("show");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 400);
}

/* ==========================================================================
   DATE/TIME HELPERS
   ========================================================================== */

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowTimeString() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function parseDateString(dateStr) {
  // Acepta yyyy-mm-dd
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parseInt(parts[2])
    };
  }
  return { year: 2026, month: 6, day: 23 };
}

// Habilitar o deshabilitar todos los botones principales de la aplicación durante procesos de carga/sincronización
function setButtonsState(enabled) {
  const selectors = [
    "#btn-login-user",
    "#btn-login-admin",
    "#btn-request-sequential",
    "#btn-confirm-reservation",
    "#btn-export-excel",
    ".card-actions button",
    ".logout-btn",
    "input",
    "select",
    "button"
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (enabled) {
        el.removeAttribute("disabled");
        if (el.tagName === "BUTTON") el.style.opacity = "1";
      } else {
        el.setAttribute("disabled", "true");
        if (el.tagName === "BUTTON") el.style.opacity = "0.5";
      }
    });
  });
}


/* ==========================================================================
   LOCAL NOTIFICATIONS (POLLING)
   ========================================================================== */

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones de escritorio");
    return;
  }
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        console.log("Permiso de notificaciones concedido.");
      }
    });
  }
}

function startNotificationPolling() {
  if (notificationPollingTimer) clearInterval(notificationPollingTimer);
  if (!CONFIG.GOOGLE_SHEET_API_URL) return;
  
  // Clone current logs to avoid firing notifications on startup
  lastKnownLogs = JSON.parse(JSON.stringify(state.logs));
  
  notificationPollingTimer = setInterval(pollForUpdates, 15000); // 15 seconds
}

function stopNotificationPolling() {
  if (notificationPollingTimer) {
    clearInterval(notificationPollingTimer);
    notificationPollingTimer = null;
  }
}

async function pollForUpdates() {
  if (!navigator.onLine) return;
  try {
    const res = await fetch(CONFIG.GOOGLE_SHEET_API_URL + "?action=getDatabase&_t=" + Date.now());
    if (!res.ok) return;
    const db = await res.json();
    if (db.success) {
      const newLogs = db.logs;
      checkNotificationChanges(lastKnownLogs, newLogs);
      lastKnownLogs = JSON.parse(JSON.stringify(newLogs));
      
      // Optionally update local state seamlessly if there are changes
      if (JSON.stringify(state.logs) !== JSON.stringify(newLogs)) {
        state.logs = newLogs;
        state.biometrics = db.biometrics;
        recalculateBiometricStates();
        renderBiometrics();
        if (state.currentUser && state.currentUser.role === "admin") {
          renderAdminDashboard();
        }
      }
    }
  } catch (err) {
    console.error("Error polling notifications:", err);
  }
}

function checkNotificationChanges(oldLogs, newLogs) {
  if (Notification.permission !== "granted") return;
  // If oldLogs is empty, this is the very first successful load of data. 
  // We should NOT bombard the user with notifications for existing historical data.
  if (!oldLogs || oldLogs.length === 0) return;
  
  newLogs.forEach(newLog => {
    const oldLog = oldLogs.find(l => l.id === newLog.id);
    if (!oldLog) {
      // New log!
      fireNotification("Nueva Solicitud", `${newLog.usuario} solicitó el Biométrico ${newLog.biometrico}`);
    } else if (oldLog.estado !== newLog.estado && newLog.estado === "Entregado") {
      // Returned!
      fireNotification("Devolución", `El Biométrico ${newLog.biometrico} ha sido devuelto por ${newLog.usuario_retorno || newLog.usuario}`);
    }
  });

  // Detect cancellations (log existed in oldLogs as Pendiente, but is missing in newLogs)
  oldLogs.forEach(oldLog => {
    const stillExists = newLogs.find(l => l.id === oldLog.id);
    if (!stillExists && oldLog.estado === "Pendiente") {
      fireNotification("Solicitud Cancelada", `El pasante ${oldLog.usuario} canceló su solicitud del Biométrico ${oldLog.biometrico}`);
    }
  });
}

function fireNotification(title, body) {
  try {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "app_icon.png"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, {
            body: body,
            icon: "app_icon.png"
          });
        }
      });
    }
  } catch(e) {
    console.warn("No se pudo lanzar notificación", e);
  }
}
