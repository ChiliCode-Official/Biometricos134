/* ==========================================================================
   APPLICATION LOGIC - CONTROL DE BIOMÃ‰TRICOS (NOTARÃA 134)
   ========================================================================== */

// --- Global State ---
let state = {
  connectionMode: "demo", // "online" | "demo"
  currentUser: null,      // { name: "", role: "user" | "admin" }
  biometrics: [],         // Inventario de 8 equipos y su estado actual
  logs: [],               // Historial de prÃ©stamos (LOG_USO)
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
    userBadge.innerText = `â˜ï¸ ${cnt} pte.`;
  }
  if (adminBadge) {
    adminBadge.style.display = cnt > 0 ? 'inline-block' : 'none';
    adminBadge.innerText = `â˜ï¸ ${cnt} pte.`;
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
  // 1. Detectar si hay sesiÃ³n guardada en localStorage
  const savedSession = localStorage.getItem("n134_session");
  if (savedSession) {
    state.currentUser = JSON.parse(savedSession);
    if (state.currentUser && state.currentUser.role === "admin") {
      requestNotificationPermission();
      startNotificationPolling();
    }
  }

  // 2. Determinar modo de conexiÃ³n
  if (CONFIG.GOOGLE_SHEET_API_URL && CONFIG.GOOGLE_SHEET_API_URL.trim() !== "") {
    state.connectionMode = "online";
    updateConnectionBar("loading", "Revisando biomÃ©tricos disponibles...");
  } else {
    state.connectionMode = "demo";
    updateConnectionBar("demo", "Modo DemostraciÃ³n (Local) - Edita config.js para conectar Google Sheets");
  }

  // Cargar base local de inmediato para respuesta instantÃ¡nea antes de red
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
      console.log("Plantilla Excel precargada con Ã©xito");
    }
  } catch (err) {
    console.warn("No se pudo precargar la plantilla Excel automÃ¡ticamente:", err);
  }

  // 3. Cargar Base de Datos (Nube) de forma asÃ­ncrona sin bloquear la UI
  setButtonsState(false); // Deshabilitar botones durante la carga
  loadDatabase().then(() => {
    setButtonsState(true); // Habilitar botones al terminar de cargar
    renderBiometrics();
    updateSequentialSuggestion();
    if (state.currentUser && state.currentUser.role === "admin") {
      renderAdminDashboard();
    }
  });

  // 4. Mostrar vista segÃºn sesiÃ³n
  if (state.currentUser) {
    showView(state.currentUser.role === "admin" ? "admin-view" : "user-view");
    
    if (state.currentUser.role === "admin") {
       document.getElementById("display-user-name").style.display = "none";
       const adminBadge = document.getElementById("admin-badge-top");
       if (adminBadge) adminBadge.classList.remove("hidden");
    } else {
       document.getElementById("display-user-name").innerText = state.currentUser.name;
       document.getElementById("display-user-name").style.display = "inline";
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
            alert("âš ï¸ Â¡ATENCIÃ“N SISTEMAS!\n\nTu Google Apps Script estÃ¡ desactualizado y la aplicaciÃ³n no responderÃ¡ al marcar como entregado o solicitar equipos.\n\nPor favor, actualiza tu script en Google Sheets con la Ãºltima versiÃ³n de google_apps_script.js y asegÃºrate de crear una NUEVA IMPLEMENTACIÃ“N (AplicaciÃ³n Web) en el menÃº.");
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
        
        // Calcular estado de biometria dinÃ¡micamente con base en LOG_USO activo
        recalculateBiometricStates();

        updateConnectionBar("online", "Conectado con disponibilidad de biomÃ©tricos");
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
  updateConnectionBar("demo", "Modo Local (Respaldo/Sin conexiÃ³n) - Cambios guardados en navegador");
  loadLocalDatabase();
}

// Recalcular estado de los biomÃ©tricos con base en LOG_USO
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
    // Inicializar base de datos local vacÃ­a con el config.js
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

// LÃ³gica de desglose rotativo secuencial ("Gasto a la par")
function getNextSequentialBiometric() {
  // 1. Encontrar el nÃºmero del Ãºltimo biomÃ©trico asignado en el historial logs, ignorando los Cancelados
  let lastAssignedNum = 0;
  // Recorremos los logs de atrÃ¡s hacia adelante para ver el Ãºltimo biomÃ©trico solicitado
  for (let i = state.logs.length - 1; i >= 0; i--) {
    // Ignorar logs cancelados para no tomarlos en cuenta en la secuencia
    if (state.logs[i].estado === "Cancelado" || state.logs[i].estado === "Cancelada") continue;
    
    const num = parseInt(state.logs[i].biometrico);
    if (!isNaN(num) && num >= 1 && num <= 8) {
      lastAssignedNum = num;
      break;
    }
  }

  // 2. Determinar la secuencia a partir del Ãºltimo biomÃ©trico
  // Si no hay asignaciÃ³n previa, empezamos en 1
  let currentNum = lastAssignedNum === 0 ? 1 : (lastAssignedNum % 8) + 1;

  // 3. Probar disponibilidad en secuencia circular
  for (let step = 0; step < 8; step++) {
    const bio = state.biometrics.find(b => b.biometrico == currentNum);
    if (bio && bio.status === "Disponible") {
      return currentNum;
    }
    currentNum = (currentNum % 8) + 1;
  }

  // Si ninguno estÃ¡ disponible, retornar null
  return null;
}

// Actualiza el texto en la UI con el biomÃ©trico sugerido
function updateSequentialSuggestion() {
  const suggestSpan = document.getElementById("suggested-bio-name");
  const container = document.getElementById("sequential-suggested-container");
  const btn = document.getElementById("btn-request-sequential");
  const btnText = document.getElementById("btn-request-sequential-text");
  
  if (!suggestSpan) return;

  const nextBio = getNextSequentialBiometric();
  if (nextBio) {
    suggestSpan.innerText = `BiomÃ©trico ${nextBio}`;
    container.style.backgroundColor = "var(--accent-light)";
    container.style.color = "var(--accent)";
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.innerText = `âš¡ MantÃ©n para Solicitar BiomÃ©trico ${nextBio}`;
      btn.setAttribute("data-bio", nextBio);
    }
  } else {
    suggestSpan.innerText = "Ninguno disponible (Todos ocupados)";
    container.style.backgroundColor = "var(--color-error-bg)";
    container.style.color = "var(--color-error)";
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.innerText = "âŒ Todos los Equipos Ocupados";
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
  // LÃ³gica local INMEDIATA para que la app se sienta instantÃ¡nea
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
            alert("âš ï¸ Â¡ATENCIÃ“N SISTEMAS!\n\nTu Google Apps Script estÃ¡ desactualizado y la acciÃ³n no se aplicÃ³ en Google Sheets.\n\nPor favor, actualiza tu script.");
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
          updateConnectionBar("online", "Conectado con disponibilidad de biomÃ©tricos");
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
          showToast("Red muy lenta. AcciÃ³n guardada en la nube pendiente (Offline).");
        } else {
          showToast("Sin internet. AcciÃ³n guardada en cola local (Offline).");
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

// NormalizaciÃ³n de texto para bÃºsqueda (ignora acentos)
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// BÃºsqueda autocompletado de usuarios
function handleUserSearch(e) {
  const query = normalizeText(e.target.value);
  const list = document.getElementById("user-results");
  const loginBtn = document.getElementById("btn-login-user");
  list.innerHTML = "";
  
  // Si estÃ¡ vacÃ­o, mostrar los primeros 5 usuarios por defecto para que puedan seleccionar
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

// BÃºsqueda autocompletado para el administrador en el modal
function handleAdminUserSearch(e) {
  const query = normalizeText(e.target.value);
  const list = document.getElementById("admin-user-results");
  list.innerHTML = "";
  
  if (query === "") {
    list.classList.add("hidden");
    return;
  }

  // Filtrar nombres por coincidencia parcial en cualquier posiciÃ³n
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

// Iniciar sesiÃ³n como Usuario
function loginAsUser() {
  const name = document.getElementById("user-search").value.trim();
  if (name === "" || !state.users.includes(name)) {
    showToast("Por favor selecciona un usuario vÃ¡lido.");
    return;
  }

  state.currentUser = { name: name, role: "user" };
  localStorage.setItem("n134_session", JSON.stringify(state.currentUser));
  
  document.getElementById("display-user-name").innerText = name;
  document.getElementById("display-user-name").style.display = "inline";
  const adminBadge = document.getElementById("admin-badge-top");
  if (adminBadge) adminBadge.classList.add("hidden");
  
  showView("user-view");
  renderBiometrics();
  updateSequentialSuggestion();
  showToast(`SesiÃ³n iniciada como ${name}`);
}

// Iniciar sesiÃ³n como Administrador
function loginAsAdmin() {
  const pin = document.getElementById("admin-pin").value;
  if (pin === CONFIG.ADMIN_PIN) {
    state.currentUser = { name: "Administrador", role: "admin" };
    localStorage.setItem("n134_session", JSON.stringify(state.currentUser));
    
    document.getElementById("display-user-name").style.display = "none";
    const adminBadge = document.getElementById("admin-badge-top");
    if (adminBadge) adminBadge.classList.remove("hidden");
    
    showView("admin-view");
    renderBiometrics();
    renderAdminDashboard();
    updateSequentialSuggestion();
    showToast("SesiÃ³n de administrador iniciada.");
    document.getElementById("admin-pin").value = "";
    
    // Notifications init
    requestNotificationPermission();
    startNotificationPolling();
  } else {
    showToast("PIN incorrecto. Intenta de nuevo.");
  }
}

// Cerrar SesiÃ³n
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
  showToast("SesiÃ³n cerrada.");
}

/* ==========================================================================
   UI RENDERING
   ========================================================================== */

function _showViewInternal(viewId) {
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
    
    // Ocultar sidebar en mÃ³vil al cambiar vista
    document.querySelector('.dashboard-sidebar').classList.remove('open');
      
    // Actualizar estado activo de los botones del menÃº lateral
    const navDashboard = document.getElementById("nav-dashboard");
    const navProfile = document.getElementById("nav-profile");
    const navAnalytics = document.getElementById("nav-analytics");
    if (navDashboard && navProfile && navAnalytics) {
      navDashboard.classList.remove("active");
      navProfile.classList.remove("active");
      navAnalytics.classList.remove("active");
      
      if (viewId === "profile-view") {
        navProfile.classList.add("active");
      } else if (viewId === "analytics-view") {
        navAnalytics.classList.add("active");
      } else if (viewId === "admin-view" || viewId === "user-view") {
        navDashboard.classList.add("active");
      }
    }
    
    if (viewId === "analytics-view") {
      renderAnalytics();
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
        <h4 style="color: var(--accent); font-size: 1.1rem; font-weight: 700;">BiomÃ©trico ${bio.biometrico} Asignado</h4>
      </div>
    </div>
    
    ${bio.status === 'Pendiente' ? `
      <div style="padding: 0 20px 20px; text-align: center; color: var(--text-light);">
        Tu solicitud estÃ¡ en espera de que pases por el equipo a la oficina.
      </div>
      <div class="card-actions" style="display: flex; gap: 10px;">
        <button class="btn btn-primary" onclick="confirmDelivery('${bio.logId}', '${bio.biometrico}')" style="flex: 1; padding: 12px 5px; font-size: 0.9rem;">âœ… Ya lo recibÃ­</button>
        <button class="btn btn-orange" onclick="cancelDelivery('${bio.logId}', '${bio.biometrico}')" style="flex: 1; padding: 12px 5px; font-size: 0.9rem;">âŒ Cancelar</button>
      </div>
    ` : `
      <div class="checklist-container" id="${checklistId}" style="margin-bottom: 20px; font-size: 0.95rem;">
        <label class="checklist-item" style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" onchange="checkReturnChecklist(${bio.biometrico})" style="margin-right: 12px; width: 20px; height: 20px; accent-color: var(--accent);">
          <span>ðŸ’» Laptop ${bio.laptop_marca} ${bio.laptop_modelo}</span>
        </label>
  function showView(viewId) {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        _showViewInternal(viewId);
      });
    } else {
      _showViewInternal(viewId);
    }
  }
  
  async function handleWebAuthn() {
    if (!window.PublicKeyCredential) {
      showToast("Tu dispositivo no soporta biometrÃ­a nativa.", "error");
      return;
    }
    try {
      const isRegistered = localStorage.getItem('webauthn_registered');
      if (!isRegistered) {
        showToast("Configurando biometrÃ­a... Usa FaceID o TouchID.", "info");
        const publicKey = {
          challenge: new Uint8Array([1,2,3,4,5,6]),
          rp: { name: "BiomÃ©tricos 134" },
          user: { id: new Uint8Array(16), name: "admin@biometricos", displayName: "Admin" },
          pubKeyCredParams: [{type: "public-key", alg: -7}],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000,
          attestation: "none"
        };
        await navigator.credentials.create({ publicKey });
        localStorage.setItem('webauthn_registered', 'true');
        showToast("BiometrÃ­a configurada correctamente.", "success");
        state.currentUser = { name: "Admin (BiometrÃ­a)", role: "admin" };
        document.getElementById('admin-name').textContent = state.currentUser.name;
        document.getElementById('profile-name').textContent = state.currentUser.name;
        document.getElementById('profile-role').textContent = "Administrador";
        renderBiometrics();
        showView('admin-view');
      } else {
        const publicKey = { challenge: new Uint8Array([1,2,3,4,5,6]), timeout: 60000 };
        await navigator.credentials.get({ publicKey });
        showToast("Autenticado con biometrÃ­a", "success");
        state.currentUser = { name: "Admin (BiometrÃ­a)", role: "admin" };
        document.getElementById('admin-name').textContent = state.currentUser.name;
        document.getElementById('profile-name').textContent = state.currentUser.name;
        document.getElementById('profile-role').textContent = "Administrador";
        renderBiometrics();
        showView('admin-view');
      }
    } catch (err) {
      console.error(err);
      showToast("Cancelado o fallo en la biometrÃ­a", "error");
    }
  }