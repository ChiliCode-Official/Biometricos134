/**
 * GOOGLE APPS SCRIPT - BACKEND CONSERVANDO FORMATOS DE EXCEL (NOTARÍA 134)
 * 
 * Este script lee y escribe DIRECTAMENTE en las celdas del formato original de tu jefe,
 * conservando todos los colores, fórmulas, bordes y celdas combinadas del Excel.
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Sube tu archivo "RESPONSIVA DE EQUIPO DE COMPUTO Firmas 1 JULIO 2022.xlsx" a Google Drive.
 * 2. Ábrelo como Google Sheets (Hoja de cálculo de Google).
 * 3. En el menú superior ve a: Extensiones > Apps Script.
 * 4. Pega este código completo reemplazando todo lo que haya.
 * 5. Guarda con el icono del disquete.
 * 6. Haz clic en "Implementar" (botón azul) > "Nueva implementación".
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Tú (tu correo)
 *    - Quién tiene acceso: Cualquiera (Indispensable para enlazar la PWA)
 * 7. Haz clic en Implementar, otorga los permisos necesarios y copia la "URL de la aplicación web" para el config.js.
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    try {
      var action = e.parameter.action;
      var result = {};
      
      ensureAuxiliarySheets();
      
      if (action === "request") {
        result = requestBiometric(e.parameter.biometrico, e.parameter.usuario, e.parameter.hora_salida);
      } else if (action === "return") {
        result = returnBiometric(e.parameter.id, e.parameter.usuario_retorno, e.parameter.biometrico);
      } else if (action === "logInk") {
        result = logInkChange(e.parameter.biometrico, e.parameter.usuario, e.parameter.observaciones);
      } else if (action === "logInternet") {
        result = logInternetPlan(e.parameter.biometrico, e.parameter.usuario, e.parameter.plan, e.parameter.observaciones);
      } else if (action === "cancel") {
        result = cancelBiometric(e.parameter.id, e.parameter.biometrico);
      } else if (action === "confirm") {
        result = confirmBiometric(e.parameter.id, e.parameter.biometrico);
      } else if (action === "addUser") {
        result = addUser(e.parameter.nombre);
      } else if (action === "editUser") {
        result = editUser(e.parameter.oldName, e.parameter.newName);
      } else if (action === "deleteUser") {
        result = deleteUser(e.parameter.nombre);
      } else if (action === "getDatabase") {
        return handleResponse(getData());
      } else {
        result = { success: false, error: "Acción no reconocida" };
      }
      
      if (result && result.success) {
        return handleResponse({ success: true, version: "v2" });
      } else {
        return handleResponse(result);
      }
    } catch (err) {
      return handleResponse({ success: false, error: err.toString() });
    }
  }
  return handleResponse(getData());
}

function doPost(e) {
  if (e === undefined) {
    return handleResponse({ success: false, error: "No post data received" });
  }
  
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var result = {};
    
    // Asegurar que las hojas de log auxiliares (tintas/internet) existan
    ensureAuxiliarySheets();
    
    if (action === "request") {
      result = requestBiometric(params.biometrico, params.usuario, params.hora_salida);
    } else if (action === "return") {
      result = returnBiometric(params.id, params.usuario_retorno, params.biometrico);
    } else if (action === "logInk") {
      result = logInkChange(params.biometrico, params.usuario, params.observaciones);
    } else if (action === "logInternet") {
      result = logInternetPlan(params.biometrico, params.usuario, params.plan, params.observaciones);
    } else if (action === "cancel") {
      result = cancelBiometric(params.id, params.biometrico);
    } else if (action === "confirm") {
      result = confirmBiometric(params.id, params.biometrico);
    } else if (action === "addUser") {
      result = addUser(params.nombre);
    } else if (action === "editUser") {
      result = editUser(params.oldName, params.newName);
    } else if (action === "deleteUser") {
      result = deleteUser(params.nombre);
    } else if (action === "getDatabase") {
      return handleResponse(getData());
    } else {
      result = { success: false, error: "Acción no reconocida" };
    }
    
    if (result && result.success) {
      result.version = "v2";
    }
    return handleResponse(result);
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() });
  }
}

function handleResponse(data) {
  var output = JSON.stringify(data);
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

// Obtener base de datos completa conservando tu formato
function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureAuxiliarySheets();
  
  var logs = getLogsFromEstadisticas(ss);
  var inkLogs = getSheetDataAsJson(ss.getSheetByName("LOG_TINTAS"));
  var internetLogs = getSheetDataAsJson(ss.getSheetByName("LOG_INTERNET"));
  var users = getUsersFromSheet(ss);
  var biometrics = getBiometricsState(ss, logs, internetLogs);

  return {
    success: true,
    version: "v2",
    biometrics: biometrics,
    logs: logs,
    inkLogs: inkLogs,
    internetLogs: internetLogs,
    users: users
  };
}

function safeString(val) {
  if (val === null || val === undefined) return "";
  return val.toString().trim();
}

// 1. Obtener el estado actual de los 8 biométricos de manera ultra rápida usando datos base y logs en memoria
function getBiometricsState(ss, logs, internetLogs) {
  var baseBiometrics = [
    {
      biometrico: 1,
      bam_telefono: "55 13 92 13 97",
      internet_plan: "928 mg hasta el 26/10/2024",
      laptop_marca: "HP",
      laptop_modelo: "EliteBook 840 CORE I5",
      laptop_serie: "5CG5502662",
      impresora_marca: "HP",
      impresora_modelo: "OfficeJet 200",
      impresora_serie: "TH118950DH",
      biometrico_lector: "U.are.U 5300",
      biometrico_serie: "N902C300771",
      router_modelo: "4G LTE",
      router_imei: "IMEI:865298031325378"
    },
    {
      biometrico: 2,
      bam_telefono: "55 37 16 67 30",
      internet_plan: "",
      laptop_marca: "LENOVO",
      laptop_modelo: "IdeaPad S145",
      laptop_serie: "PF2Y20EN",
      impresora_marca: "HP",
      impresora_modelo: "OFFICE JET 200",
      impresora_serie: "TH118950JF",
      biometrico_lector: "U.are.U",
      biometrico_serie: "N902C300772",
      router_modelo: "4G ELITE",
      router_imei: "865298031325593"
    },
    {
      biometrico: 3,
      bam_telefono: "55 21 12 29 45",
      internet_plan: "742 mb",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG1436JCV",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007540",
      biometrico_lector: "HID Digital Personal 4500",
      biometrico_serie: "P52E10517",
      router_modelo: "4G LTE",
      router_imei: "866645058868022"
    },
    {
      biometrico: 4,
      bam_telefono: "55 74 82 60 26",
      internet_plan: "",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG1436JCC",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007600",
      biometrico_lector: "HID",
      biometrico_serie: "olt_6_10518",
      router_modelo: "4G ELITE",
      router_imei: "866645058868410"
    },
    {
      biometrico: 5,
      bam_telefono: "55 22 99 60 18",
      internet_plan: "",
      laptop_marca: "HP 240 G8",
      laptop_modelo: "CORE I5",
      laptop_serie: "5CG1320D09",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007063",
      biometrico_lector: "HID (P52E10600)",
      biometrico_serie: "olt_10_10600",
      router_modelo: "4G LTE",
      router_imei: "IMEI:866645058867610"
    },
    {
      biometrico: 6,
      bam_telefono: "55 61 55 38 52",
      internet_plan: "1.99 Gb",
      laptop_marca: "HP",
      laptop_modelo: "240 G8",
      laptop_serie: "5CG61320BN2",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007514",
      biometrico_lector: "HID (P520E10597)",
      biometrico_serie: "olt_7_10597",
      router_modelo: "4G LT",
      router_imei: "866645058867289"
    },
    {
      biometrico: 7,
      bam_telefono: "55 47 85 81 57",
      internet_plan: "331 mb",
      laptop_marca: "HP",
      laptop_modelo: "ProBook 440 G8",
      laptop_serie: "5CD21752QG",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK007948",
      biometrico_lector: "HID",
      biometrico_serie: "P520E10598",
      router_modelo: "4G LTE",
      router_imei: "866645058867354"
    },
    {
      biometrico: 8,
      bam_telefono: "55 49 16 78 44",
      internet_plan: "",
      laptop_marca: "HP",
      laptop_modelo: "ProBook 640 G2",
      laptop_serie: "5GC7192GQM",
      impresora_marca: "EPSON",
      impresora_modelo: "WF-100",
      impresora_serie: "WKHK005642",
      biometrico_lector: "HID",
      biometrico_serie: "P520E10599",
      router_modelo: "4G LTE (Genérico)",
      router_imei: "866645058867321"
    }
  ];

  return baseBiometrics.map(function(bio) {
    // 1. Obtener plan más reciente de internetLogs
    if (internetLogs && internetLogs.length > 0) {
      var latestPlan = "";
      for (var j = internetLogs.length - 1; j >= 0; j--) {
        if (parseInt(internetLogs[j].biometrico) === bio.biometrico) {
          latestPlan = internetLogs[j].plan;
          break;
        }
      }
      if (latestPlan) {
        bio.internet_plan = latestPlan;
      }
    }

    // 2. Determinar estado y holder según los logs en memoria
    var status = "Disponible";
    var holder = "";
    var timeFormatted = "";

    if (logs && logs.length > 0) {
      for (var k = logs.length - 1; k >= 0; k--) {
        var log = logs[k];
        if (parseInt(log.biometrico) === bio.biometrico && (log.estado === "Activo" || log.estado === "Pendiente")) {
          status = log.estado === "Pendiente" ? "Pendiente" : "Ocupado";
          holder = log.usuario;
          timeFormatted = log.hora_salida_solicitada;
          break;
        }
      }
    }

    bio.status = status;
    bio.holder = holder;
    bio.time = timeFormatted;

    return bio;
  });
}

// 2. Reconstruir el historial dinámicamente escaneando la pestaña original "ESTADISTICAS"
function getLogsFromEstadisticas(ss) {
  var sheet = ss.getSheetByName("ESTADISTICAS");
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return [];
  
  // Leer únicamente el rango de columnas A hasta S (19 columnas) para evitar leer celdas vacías a la derecha
  var data = sheet.getRange(1, 1, lastRow, 19).getValues();
  var logs = [];
  
  // Fila 1 a 5 son cabeceras en el excel original.
  // El índice 0-based para la fila 6 es 5.
  for (var i = 5; i < data.length; i++) {
    var row = data[i];
    var usuario = row[0]; // Columna A: Pasante
    if (!usuario || usuario.toString().trim() === "") continue;
    
    // Revisar columnas B (Bio 1), D (Bio 2), F (Bio 3), etc.
    // Bio X Salida está en Columna index 2 * X - 1
    // Bio X Entrada está en Columna index 2 * X
    for (var x = 1; x <= 9; x++) {
      var colSalidaIdx = 2 * x - 1; // 1 (B), 3 (D), 5 (F), 7 (H), 9 (J), 11 (L), 13 (N), 15 (P), 17 (R: General)
      var colEntradaIdx = colSalidaIdx + 1; // 2 (C), 4 (E), 6 (G), 8 (I), 10 (K), 12 (M), 14 (O), 16 (Q), 18 (S: General Entrada)
      
      var salidaVal = row[colSalidaIdx];
      var entradaVal = row[colEntradaIdx];
      
      if (salidaVal && salidaVal.toString().trim() !== "") {
        var bioNum = x === 9 ? "General" : x;
        var logId = "ROW-" + (i + 1) + "-" + x; // ID único basado en fila y columna
        
        var isPending = entradaVal && entradaVal.toString().trim() === "PENDIENTE";
        var isReturned = entradaVal && entradaVal.toString().trim() !== "" && !isPending;
        
        logs.push({
          id: logId,
          biometrico: bioNum,
          usuario: usuario.toString().trim(),
          fecha_salida: formatDate(salidaVal, "yyyy-MM-dd"),
          hora_salida_solicitada: formatDate(salidaVal, "HH:mm"),
          hora_salida_real: formatDate(salidaVal, "HH:mm:ss"),
          fecha_entrada: isReturned ? formatDate(entradaVal, "yyyy-MM-dd") : "",
          hora_entrada: isReturned ? formatDate(entradaVal, "HH:mm:ss") : "",
          estado: isPending ? "Pendiente" : (isReturned ? "Entregado" : "Activo"),
          devuelto_por: isReturned ? "Admin" : ""
        });
      }
    }
  }
  return logs;
}

// ============================================================================
// FUNCIONES DE GESTIÓN DE USUARIOS
// ============================================================================

function addUser(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) return { success: false, error: "No existe la hoja USUARIOS" };
  
  var lastRow = sheet.getLastRow();
  var startRow = 4;
  
  if (lastRow >= startRow) {
    var values = sheet.getRange(startRow, 2, lastRow - startRow + 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === "" || values[i][0].toString().trim() === "") {
        sheet.getRange(startRow + i, 2).setValue(nombre);
        return { success: true };
      }
    }
  }
  
  // Si no hay celdas vacías, agregar al final
  sheet.getRange(Math.max(lastRow + 1, startRow), 2).setValue(nombre);
  return { success: true };
}

function editUser(oldName, newName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) return { success: false, error: "No existe la hoja USUARIOS" };
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return { success: false, error: "No hay usuarios" };
  
  var values = sheet.getRange(4, 2, lastRow - 3, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] && values[i][0].toString().trim() === oldName.trim()) {
      sheet.getRange(4 + i, 2).setValue(newName);
      return { success: true };
    }
  }
  return { success: false, error: "Usuario no encontrado" };
}

function deleteUser(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) return { success: false, error: "No existe la hoja USUARIOS" };
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return { success: false, error: "No hay usuarios" };
  
  var values = sheet.getRange(4, 2, lastRow - 3, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] && values[i][0].toString().trim() === nombre.trim()) {
      sheet.getRange(4 + i, 2).clearContent();
      return { success: true };
    }
  }
  return { success: false, error: "Usuario no encontrado" };
}

// 3. Obtener el listado de usuarios de la pestaña original "USUARIOS"
function getUsersFromSheet(ss) {
  var sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) return CONFIG.USUARIOS; // Fallback
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return CONFIG.USUARIOS;
  
  // Leer únicamente la columna B (usuarios) desde la fila 4 (índice 4, columna 2) para maximizar velocidad
  var values = sheet.getRange(4, 2, lastRow - 3, 1).getValues();
  var usersList = [];
  for (var i = 0; i < values.length; i++) {
    var name = values[i][0];
    if (name && name.toString().trim() !== "") {
      usersList.push(name.toString().trim());
    }
  }
  
  // Si por alguna razón la hoja está en blanco, devolver precargados
  return usersList.length > 0 ? usersList : CONFIG.USUARIOS;
}

// Formatear fechas/números seriales de Excel (Optimizado en JS puro para evitar lentitud de Utilities.formatDate)
function formatDate(val, format) {
  var d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number") {
    var baseDate = new Date(1899, 11, 30);
    var dateMs = baseDate.getTime() + val * 24 * 60 * 60 * 1000;
    d = new Date(dateMs);
  } else {
    return val ? val.toString() : "";
  }
  
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  var ss = String(d.getSeconds()).padStart(2, '0');
  
  if (format === "yyyy-MM-dd") {
    return yyyy + "-" + mm + "-" + dd;
  }
  if (format === "HH:mm") {
    return hh + ":" + min;
  }
  if (format === "HH:mm:ss") {
    return hh + ":" + min + ":" + ss;
  }
  if (format === "yyyy-MM-dd HH:mm:ss") {
    return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + min + ":" + ss;
  }
  return d.toString();
}

// 4. Registrar salida (Escribe directamente en ESTADISTICAS y en BIO X)
function requestBiometric(biometrico, usuario, horaSalida) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var x = parseInt(biometrico);
  if (isNaN(x)) {
    x = 9; // Préstamo General (Columna R/S)
  }
  
  // Columna Salida (1-based para getRange): Col B (2) para Bio 1, Col D (4) para Bio 2, etc.
  var colSalidaNum = 2 * x; 
  
  // A. Escribir en la hoja ESTADISTICAS
  var estSheet = ss.getSheetByName("ESTADISTICAS");
  if (!estSheet) return { success: false, error: "No se encontró la hoja ESTADISTICAS" };
  
  var lastRow = estSheet.getLastRow();
  var newRowIdx = lastRow + 1;
  
  // Escribir usuario en columna A y la fecha/hora en la columna del biométrico
  var now = new Date();
  if (horaSalida) {
    var parts = horaSalida.split(":");
    if (parts.length >= 2) {
      now.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
    }
  }
  
  estSheet.getRange(newRowIdx, 1).setValue(usuario);
  estSheet.getRange(newRowIdx, colSalidaNum).setValue(now);
  estSheet.getRange(newRowIdx, colSalidaNum + 1).setValue("PENDIENTE");
  
  // B. Escribir en la hoja BIO X para la responsiva (si es del 1 al 8)
  if (x >= 1 && x <= 8) {
    var bioSheet = ss.getSheetByName("BIO " + x);
    if (bioSheet) {
      bioSheet.getRange("B4").setValue(usuario);     // Nombre del usuario en responsiva
      bioSheet.getRange("F8").setValue(now);         // Fecha/Hora de préstamo en responsiva
      bioSheet.getRange("A54").setValue(usuario);    // Nombre en línea de firma
    }
  }
  
  // --- Envío de Correo al Administrador en tiempo real ---
  try {
    var subject = "🚨 Solicitud de Biométrico " + biometrico + " - " + usuario;
    var body = "Hola Admin,\n\nSe ha registrado una nueva solicitud de equipo:\n\n" +
               "• Equipo: Biométrico " + biometrico + "\n" +
               "• Usuario: " + usuario + "\n" +
               "• Fecha y hora: " + Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + "\n" +
               "• Hora de salida programada: " + (horaSalida ? horaSalida : "Al momento") + "\n\n" +
               "Este correo se envió automáticamente desde el Control de Biométricos N134.";
               
    MailApp.sendEmail("sistemas@notaria134.com.mx", subject, body);
  } catch (mailErr) {
    Logger.log("Error al enviar correo de solicitud: " + mailErr.toString());
  }
  
  SpreadsheetApp.flush();
  return { success: true };
}

// 5. Cancelar solicitud (Limpia los datos de la fila sin borrarla para no afectar los IDs)
function cancelBiometric(id, biometrico) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var rowIdx = -1;
  var x = -1;
  
  var parts = id ? id.toString().split("-") : [];
  if (parts.length === 3 && parts[0] === "ROW") {
    rowIdx = parseInt(parts[1]);
    x = parseInt(parts[2]);
  } else {
    x = parseInt(biometrico);
    if (isNaN(x) && biometrico === "General") {
      x = 9;
    }
  }
  
  if (isNaN(x) || x < 1 || x > 9 || rowIdx === -1) {
    return { success: false, error: "ID o número de biométrico inválido para cancelación." };
  }
  
  var estSheet = ss.getSheetByName("ESTADISTICAS");
  if (!estSheet) return { success: false, error: "No se encontró la hoja ESTADISTICAS" };
  
  var colSalidaNum = 2 * x;
  
  // Limpiar Usuario (Col 1), Fecha Salida (Col 2x) y Fecha Retorno (Col 2x+1)
  estSheet.getRange(rowIdx, 1).clearContent();
  estSheet.getRange(rowIdx, colSalidaNum).clearContent();
  estSheet.getRange(rowIdx, colSalidaNum + 1).clearContent();
  
  SpreadsheetApp.flush();
  return { success: true };
}

// 6. Confirmar entrega (Borra la palabra PENDIENTE de la Fecha de Retorno)
function confirmBiometric(id, biometrico) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var rowIdx = -1;
  var x = -1;
  
  var parts = id ? id.toString().split("-") : [];
  if (parts.length === 3 && parts[0] === "ROW") {
    rowIdx = parseInt(parts[1]);
    x = parseInt(parts[2]);
  } else {
    x = parseInt(biometrico);
    if (isNaN(x) && biometrico === "General") {
      x = 9;
    }
  }
  
  if (isNaN(x) || x < 1 || x > 9 || rowIdx === -1) {
    return { success: false, error: "ID o número de biométrico inválido para confirmación." };
  }
  
  var estSheet = ss.getSheetByName("ESTADISTICAS");
  if (!estSheet) return { success: false, error: "No se encontró la hoja ESTADISTICAS" };
  
  var colSalidaNum = 2 * x;
  
  // Limpiar "PENDIENTE" (Col 2x+1)
  estSheet.getRange(rowIdx, colSalidaNum + 1).clearContent();
  
  SpreadsheetApp.flush();
  return { success: true };
}

// 7. Registrar devolución (Escribe directamente en ESTADISTICAS y limpia BIO X)
function returnBiometric(id, usuarioRetorno, biometrico) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var rowIdx = -1;
  var x = -1;
  
  // 1. Intentar parsear el ID oficial (ROW-{rowIndex}-{biometricIndex})
  var parts = id ? id.toString().split("-") : [];
  if (parts.length === 3 && parts[0] === "ROW") {
    rowIdx = parseInt(parts[1]);
    x = parseInt(parts[2]);
  } else {
    // 2. Si no es un ID oficial, usamos el biometrico
    x = parseInt(biometrico);
    if (isNaN(x) && biometrico === "General") {
      x = 9;
    }
  }
  
  if (isNaN(x) || x < 1 || x > 9) {
    return { success: false, error: "ID o número de biométrico inválido para devolución." };
  }
  
  // A. Registrar en la hoja ESTADISTICAS
  var estSheet = ss.getSheetByName("ESTADISTICAS");
  if (!estSheet) return { success: false, error: "No se encontró la hoja ESTADISTICAS" };
  
  var colSalidaNum = 2 * x;
  var colEntradaNum = 2 * x + 1;
  
  // 3. Si no tenemos una fila válida, buscarla dinámicamente de abajo hacia arriba en ESTADISTICAS
  if (rowIdx === -1) {
    var lastRow = estSheet.getLastRow();
    if (lastRow >= 6) {
      var data = estSheet.getRange(1, 1, lastRow, colEntradaNum).getValues();
      for (var i = data.length - 1; i >= 5; i--) {
        var row = data[i];
        var usuario = row[0];
        var salidaVal = row[colSalidaNum - 1]; // 0-based index
        var entradaVal = row[colEntradaNum - 1]; // 0-based index
        
        if (usuario && usuario.toString().trim() !== "" && salidaVal && (!entradaVal || entradaVal.toString().trim() === "")) {
          rowIdx = i + 1; // 1-based row number
          break;
        }
      }
    }
  }
  
  var now = new Date();
  var usuarioOriginal = "Usuario";
  
  if (rowIdx !== -1) {
    estSheet.getRange(rowIdx, colEntradaNum).setValue(now);
    if (typeof data !== "undefined" && data[rowIdx - 1]) {
      usuarioOriginal = data[rowIdx - 1][0].toString();
    } else {
      usuarioOriginal = estSheet.getRange(rowIdx, 1).getValue().toString();
    }
  }
  
  // B. Limpiar la responsiva en la hoja BIO X correspondiente (si es del 1 al 8)
  if (x >= 1 && x <= 8) {
    var bioSheet = ss.getSheetByName("BIO " + x);
    if (bioSheet) {
      bioSheet.getRange("B4").setValue("");   // Limpiar usuario
      bioSheet.getRange("F8").setValue("");   // Limpiar fecha
      bioSheet.getRange("A54").setValue("");  // Limpiar firma
    }
  }
  
  // --- Envío de Correo al Administrador de Devolución ---
  try {
    var subject = "✅ Biométrico " + x + " Entregado - " + usuarioOriginal;
    var body = "Hola Admin,\n\nEl equipo ha sido marcado como devuelto:\n\n" +
               "• Equipo: Biométrico " + x + "\n" +
               "• Usuario que lo tenía: " + usuarioOriginal + "\n" +
               "• Marcado como devuelto por: " + (usuarioRetorno ? usuarioRetorno : "Usuario") + "\n" +
               "• Fecha y hora de retorno: " + Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + "\n\n" +
               "El equipo ya se encuentra disponible de nuevo en el rack.";
               
    MailApp.sendEmail("sistemas@notaria134.com.mx", subject, body);
  } catch (mailErr) {
    Logger.log("Error al enviar correo de retorno: " + mailErr.toString());
  }
  
  SpreadsheetApp.flush();
  return { success: true };
}

// 6. Registrar tintas en una pestaña dedicada LOG_TINTAS
function logInkChange(biometrico, usuario, observaciones) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("LOG_TINTAS");
  var id = "INK-" + new Date().getTime();
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  sheet.appendRow([id, biometrico, dateStr, usuario, observaciones]);
  SpreadsheetApp.flush();
  return { success: true };
}

// 7. Registrar renovaciones BAM
function logInternetPlan(biometrico, usuario, plan, observaciones) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("LOG_INTERNET");
  var id = "NET-" + new Date().getTime();
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  sheet.appendRow([id, biometrico, dateStr, usuario, plan, observaciones]);
  
  // Actualizar también la celda F4 en la hoja "BIO X" correspondiente
  var x = parseInt(biometrico);
  if (x >= 1 && x <= 8) {
    var bioSheet = ss.getSheetByName("BIO " + x);
    if (bioSheet) {
      bioSheet.getRange("F4").setValue(plan); // Actualizar plan de internet en responsiva
    }
  }
  
  SpreadsheetApp.flush();
  return { success: true };
}

// Asegurar que existan pestañas LOG_TINTAS y LOG_INTERNET para no dañar el Excel original
function ensureAuxiliarySheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auxSheets = [
    { name: "LOG_TINTAS", headers: ["id", "biometrico", "fecha", "usuario", "observaciones"] },
    { name: "LOG_INTERNET", headers: ["id", "biometrico", "fecha", "usuario", "plan", "observaciones"] }
  ];
  
  auxSheets.forEach(function(sInfo) {
    var sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) {
      sheet = ss.insertSheet(sInfo.name);
      sheet.appendRow(sInfo.headers);
      sheet.getRange(1, 1, 1, sInfo.headers.length)
        .setBackground("#1C1C1E")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");
    }
  });
}

// Helper genérico para leer datos en JSON ordenado
function getSheetDataAsJson(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var jsonArray = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        obj[headers[j]] = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      } else {
        obj[headers[j]] = val;
      }
    }
    jsonArray.push(obj);
  }
  return jsonArray;
}
