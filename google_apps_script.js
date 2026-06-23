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
      } else {
        result = { success: false, error: "Acción no reconocida" };
      }
      
      if (result && result.success) {
        return handleResponse(getData());
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
    } else {
      result = { success: false, error: "Acción no reconocida" };
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
  
  var biometrics = getBiometricsState(ss);
  var logs = getLogsFromEstadisticas(ss);
  var inkLogs = getSheetDataAsJson(ss.getSheetByName("LOG_TINTAS"));
  var internetLogs = getSheetDataAsJson(ss.getSheetByName("LOG_INTERNET"));
  var users = getUsersFromSheet(ss);

  return {
    success: true,
    biometrics: biometrics,
    logs: logs,
    inkLogs: inkLogs,
    internetLogs: internetLogs,
    users: users
  };
}

// 1. Obtener el estado actual de los 8 biométricos leyendo sus pestañas "BIO 1" a "BIO 8"
function getBiometricsState(ss) {
  var biometrics = [];
  for (var i = 1; i <= 8; i++) {
    var sheet = ss.getSheetByName("BIO " + i);
    if (sheet) {
      // Leer el rango completo de una sola vez para maximizar velocidad (de 11 llamadas a 1)
      var grid = sheet.getRange("B4:F15").getValues();
      
      var holder = grid[0][0].toString().trim();       // B4 (Fila 4, Col B)
      var bam_telefono = grid[0][3].toString().trim(); // E4 (Fila 4, Col E)
      var internet_plan = grid[0][4].toString().trim();// F4 (Fila 4, Col F)
      var exitDate = grid[4][4];                        // F8 (Fila 8, Col F)
      
      // Especificaciones de hardware (Filas 12, 13, 14, 15)
      var laptop_marca = grid[8][0].toString().trim();  // B12 (Fila 12, Col B)
      var laptop_modelo = grid[8][1].toString().trim(); // C12 (Fila 12, Col C)
      var laptop_serie = grid[8][2].toString().trim();  // D12 (Fila 12, Col D)
      
      var impresora_marca = grid[9][0].toString().trim();  // B13 (Fila 13, Col B)
      var impresora_modelo = grid[9][1].toString().trim(); // C13 (Fila 13, Col C)
      var impresora_serie = grid[9][2].toString().trim();  // D13 (Fila 13, Col D)
      
      var biometrico_lector = grid[10][0].toString().trim(); // B14 (Fila 14, Col B)
      var biometrico_serie = grid[10][2].toString().trim();  // D14 (Fila 14, Col D)
      
      var router_modelo = grid[11][0].toString().trim(); // B15 (Fila 15, Col B)
      var router_imei = grid[11][2].toString().trim();   // D15 (Fila 15, Col D)
      
      var status = (holder === "") ? "Disponible" : "Ocupado";
      var timeFormatted = "";
      if (exitDate instanceof Date) {
        timeFormatted = Utilities.formatDate(exitDate, Session.getScriptTimeZone(), "HH:mm");
      } else if (exitDate) {
        timeFormatted = exitDate.toString();
      }
      
      biometrics.push({
        biometrico: i,
        status: status,
        holder: holder,
        time: timeFormatted,
        bam_telefono: bam_telefono,
        internet_plan: internet_plan,
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
  return biometrics;
}

// 2. Reconstruir el historial dinámicamente escaneando la pestaña original "ESTADISTICAS"
function getLogsFromEstadisticas(ss) {
  var sheet = ss.getSheetByName("ESTADISTICAS");
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
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
        
        logs.push({
          id: logId,
          biometrico: bioNum,
          usuario: usuario.toString().trim(),
          fecha_salida: formatDate(salidaVal, "yyyy-MM-dd"),
          hora_salida_solicitada: formatDate(salidaVal, "HH:mm"),
          hora_salida_real: formatDate(salidaVal, "HH:mm:ss"),
          fecha_entrada: entradaVal ? formatDate(entradaVal, "yyyy-MM-dd") : "",
          hora_entrada: entradaVal ? formatDate(entradaVal, "HH:mm:ss") : "",
          estado: (entradaVal && entradaVal.toString().trim() !== "") ? "Entregado" : "Activo",
          devuelto_por: (entradaVal && entradaVal.toString().trim() !== "") ? "Admin" : ""
        });
      }
    }
  }
  return logs;
}

// 3. Obtener el listado de usuarios de la pestaña original "USUARIOS"
function getUsersFromSheet(ss) {
  var sheet = ss.getSheetByName("USUARIOS");
  if (!sheet) return CONFIG.USUARIOS; // Fallback
  
  var data = sheet.getDataRange().getValues();
  var usersList = [];
  // Fila 4 en adelante contiene los nombres en Columna B (índice 1)
  for (var i = 3; i < data.length; i++) {
    var name = data[i][1]; // Columna B
    if (name && name.toString().trim() !== "") {
      usersList.push(name.toString().trim());
    }
  }
  
  // Si por alguna razón la hoja está en blanco, devolver precargados
  return usersList.length > 0 ? usersList : CONFIG.USUARIOS;
}

// Formatear fechas/números seriales de Excel
function formatDate(val, format) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), format);
  }
  if (typeof val === "number") {
    var baseDate = new Date(1899, 11, 30);
    var dateMs = baseDate.getTime() + val * 24 * 60 * 60 * 1000;
    var d = new Date(dateMs);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), format);
  }
  return val ? val.toString() : "";
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
  
  return { success: true };
}

// 5. Registrar devolución (Escribe directamente en ESTADISTICAS y limpia BIO X)
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
    var data = estSheet.getDataRange().getValues();
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
  
  var now = new Date();
  var usuarioOriginal = "Usuario";
  
  if (rowIdx !== -1) {
    estSheet.getRange(rowIdx, colEntradaNum).setValue(now);
    usuarioOriginal = estSheet.getRange(rowIdx, 1).getValue().toString();
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
  
  return { success: true };
}

// 6. Registrar tintas en una pestaña dedicada LOG_TINTAS
function logInkChange(biometrico, usuario, observaciones) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("LOG_TINTAS");
  var id = "INK-" + new Date().getTime();
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  sheet.appendRow([id, biometrico, dateStr, usuario, observaciones]);
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
