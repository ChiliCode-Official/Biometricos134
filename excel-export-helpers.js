/* ==========================================================================
   EXCEL EXPORT HELPERS - Funciones auxiliares para exportar con formato
   Compatible con GitHub Pages (todo client-side via xlsx-populate CDN)
   ========================================================================== */

/**
 * Escribe una hoja formateada con cabecera estilizada y datos con bordes.
 * Funciona con xlsx-populate (workbook object).
 */
function writeFormattedSheet(workbook, sheetName, columns, data, headerColor) {
  let sheet = workbook.sheet(sheetName);
  if (!sheet) {
    sheet = workbook.addSheet(sheetName);
  }

  // Cabeceras con formato profesional
  columns.forEach((col, cIdx) => {
    const cell = sheet.row(1).cell(cIdx + 1);
    cell.value(col.header);
    try {
      cell.style({
        bold: true,
        fill: headerColor || "002060",
        fontColor: "FFFFFF",
        fontSize: 10,
        fontFamily: "Calibri",
        horizontalAlignment: "center",
        verticalAlignment: "center",
        wrapText: true,
        borderStyle: "thin"
      });
    } catch(e){ console.warn("Error estilo cabecera:", e); }
    try { sheet.column(cIdx + 1).width(col.width); } catch(e){}
  });

  // Limpiar datos anteriores (filas 2 a maxClear)
  const maxClear = Math.max(data.length + 10, 1000);
  for (let r = 2; r <= maxClear; r++) {
    for (let c = 1; c <= columns.length; c++) {
      sheet.row(r).cell(c).value(null);
    }
  }

  // Escribir datos con bordes y formato
  data.forEach((item, idx) => {
    const r = 2 + idx;
    columns.forEach((col, cIdx) => {
      const cell = sheet.row(r).cell(cIdx + 1);
      const val = item[col.key];
      cell.value(val !== undefined && val !== null ? val : "");
      try {
        cell.style({
          fontSize: 9,
          fontFamily: "Calibri",
          verticalAlignment: "center",
          borderStyle: "thin"
        });
      } catch(e){}
    });
  });

  return sheet;
}

/**
 * Escribe los datos en la hoja ESTADISTICAS con el MISMO formato del Excel del jefe:
 * - Logs de uso en orden cronológico con fechas en las columnas de cada biométrico
 * - Recargas BAM como filas amarillas completas (abarcando todas las columnas)
 * - Cambios de tinta como celdas amarillas individuales en la columna ENTRADA
 */
function writeEstadisticasData(estSheet, state) {
  // 1. Limpiar registros antiguos (fila 6 a 1500, columnas A a S)
  for (let r = 6; r <= 1500; r++) {
    for (let c = 1; c <= 19; c++) {
      estSheet.row(r).cell(c).value(null);
    }
  }

  // 2. Construir línea de tiempo combinada: logs de uso + recargas BAM
  //    (como las pone el jefe: todo mezclado cronológicamente)
  const timeline = [];

  // Agregar logs de uso
  state.logs.forEach(log => {
    const dateKey = (log.fecha_salida || "").replace(/-/g, "/");
    const timeKey = log.hora_salida_real || "00:00:00";
    timeline.push({
      type: "log",
      sortDate: new Date(dateKey + " " + timeKey),
      data: log
    });
  });

  // Agregar recargas BAM como filas separadas (filas amarillas del jefe)
  state.internetLogs.forEach(net => {
    const fechaParts = (net.fecha || "").split(" ");
    const dateKey = (fechaParts[0] || "").replace(/-/g, "/");
    const timeKey = fechaParts[1] || "00:00:00";
    timeline.push({
      type: "bam",
      sortDate: new Date(dateKey + " " + timeKey),
      data: net
    });
  });

  // Ordenar cronológicamente
  timeline.sort((a, b) => a.sortDate - b.sortDate);

  // 3. Escribir cada evento en la hoja ESTADISTICAS
  let currentRow = 6;
  timeline.forEach(event => {
    const r = currentRow;

    if (event.type === "log") {
      const log = event.data;

      // Col A: Pasante (nombre del usuario)
      const cellA = estSheet.row(r).cell(1);
      cellA.value(log.usuario);
      if (r > 6) {
        try { cellA.style(estSheet.row(6).cell(1).style()); } catch(e){}
      }

      let x = parseInt(log.biometrico);
      if (isNaN(x)) x = 9;

      // Columna Salida: 2 * x (Bio 1 → Col B=2, Bio 2 → Col D=4, etc.)
      const colSalida = 2 * x;
      const cellSalida = estSheet.row(r).cell(colSalida);
      const cleanExitDateStr = (log.fecha_salida + " " + log.hora_salida_real).replace(/-/g, "/");
      cellSalida.value(cleanExitDateStr);
      if (r > 6) {
        try { cellSalida.style(estSheet.row(6).cell(colSalida).style()); } catch(e){}
      }

      // Columna Entrada: 2 * x + 1 (Bio 1 → Col C=3, Bio 2 → Col E=5, etc.)
      if (log.estado === "Entregado") {
        const colEntrada = 2 * x + 1;
        const cellEntrada = estSheet.row(r).cell(colEntrada);
        const cleanReturnDateStr = (log.fecha_entrada + " " + log.hora_entrada).replace(/-/g, "/");
        cellEntrada.value(cleanReturnDateStr);
        if (r > 6) {
          try { cellEntrada.style(estSheet.row(6).cell(colEntrada).style()); } catch(e){}
        }
      }

      // Inyectar cambios de tinta (celda amarilla en ENTRADA, como el jefe)
      const matchingInk = state.inkLogs.find(ink => {
        return ink.biometrico == log.biometrico && ink.fecha && ink.fecha.startsWith(log.fecha_salida);
      });
      if (matchingInk) {
        const colEntrada = 2 * x + 1;
        const cellEntrada = estSheet.row(r).cell(colEntrada);
        cellEntrada.value(matchingInk.observaciones || "CAMBIO DE CARTUCHO");
        try {
          cellEntrada.style({
            fill: "FFFF00",
            bold: true
          });
        } catch(e){}
      }

    } else if (event.type === "bam") {
      const net = event.data;

      // Texto de recarga BAM como fila amarilla completa (como en el Excel del jefe)
      const bamText = net.observaciones ||
        "SE HIZO RECARGA DE TODAS LAS BAM    " + (net.fecha || "") + "   VIGENCIA: " + (net.plan || "");

      // Escribir el texto en columna B para que abarque visualmente las columnas de biométricos
      estSheet.row(r).cell(2).value(bamText);

      // Aplicar fondo amarillo y negrita a TODA la fila (columnas A a S = 1 a 19)
      for (let c = 1; c <= 19; c++) {
        try {
          estSheet.row(r).cell(c).style({
            fill: "FFFF00",
            bold: true,
            fontSize: 10
          });
        } catch(e){}
      }
    }

    currentRow++;
  });

  // 4. Limpiar columnas W y X de registros de resumen (filas 6 a 1000)
  for (let r = 6; r <= 1000; r++) {
    estSheet.row(r).cell(23).value(null);
    estSheet.row(r).cell(24).value(null);
  }

  // 5. Actualizar listado de usuarios en columnas W (23) y X (24) (Resumen)
  state.users.forEach((user, idx) => {
    const r = 6 + idx;
    const cellW = estSheet.row(r).cell(23);
    cellW.value(user);
    if (r > 6) {
      try { cellW.style(estSheet.row(6).cell(23).style()); } catch(e){}
    }

    const cellX = estSheet.row(r).cell(24);
    cellX.formula("COUNTIF($A$6:$A$1000, W" + r + ")");
    if (r > 6) {
      try { cellX.style(estSheet.row(6).cell(24).style()); } catch(e){}
    }
  });
}

/**
 * Escribe todas las hojas auxiliares de datos (EQUIPOS, LOG_USO, LOG_TINTAS, LOG_INTERNET)
 * con formato profesional usando writeFormattedSheet.
 */
function writeAuxiliarySheets(workbook, state) {
  // EQUIPOS - Inventario de los 8 paquetes biométricos (cabecera verde como el original)
  writeFormattedSheet(workbook, "EQUIPOS", [
    { key: "biometrico", header: "biometrico", width: 12 },
    { key: "status", header: "status", width: 12 },
    { key: "holder", header: "holder", width: 28 },
    { key: "time", header: "time", width: 24 },
    { key: "bam_telefono", header: "bam_telefono", width: 16 },
    { key: "internet_plan", header: "internet_plan", width: 16 },
    { key: "laptop_marca", header: "laptop_marca", width: 14 },
    { key: "laptop_modelo", header: "laptop_modelo", width: 14 },
    { key: "laptop_serie", header: "laptop_serie", width: 18 },
    { key: "impresora_marca", header: "impresora_marca", width: 16 },
    { key: "impresora_modelo", header: "impresora_modelo", width: 18 },
    { key: "impresora_serie", header: "impresora_serie", width: 18 },
    { key: "biometrico_lector", header: "biometrico_lector", width: 18 },
    { key: "biometrico_serie", header: "biometrico_serie", width: 18 },
    { key: "router_modelo", header: "router_modelo", width: 16 },
    { key: "router_imei", header: "router_imei", width: 20 }
  ], state.biometrics, "006100");

  // LOG_USO - Historial completo de préstamos (cabecera azul marino)
  writeFormattedSheet(workbook, "LOG_USO", [
    { key: "id", header: "id", width: 8 },
    { key: "biometrico", header: "biometrico", width: 12 },
    { key: "usuario", header: "usuario", width: 30 },
    { key: "fecha_salida", header: "fecha_salida", width: 14 },
    { key: "hora_salida_real", header: "hora_salida_real", width: 18 },
    { key: "fecha_entrada", header: "fecha_entrada", width: 14 },
    { key: "hora_entrada", header: "hora_entrada", width: 14 },
    { key: "estado", header: "estado", width: 12 }
  ], state.logs, "002060");

  // LOG_TINTAS - Cambios de cartucho/tinta (cabecera púrpura)
  writeFormattedSheet(workbook, "LOG_TINTAS", [
    { key: "id", header: "id", width: 8 },
    { key: "biometrico", header: "biometrico", width: 12 },
    { key: "fecha", header: "fecha", width: 14 },
    { key: "usuario", header: "usuario", width: 30 },
    { key: "observaciones", header: "observaciones", width: 35 }
  ], state.inkLogs, "4A148C");

  // LOG_INTERNET - Recargas BAM (cabecera teal)
  writeFormattedSheet(workbook, "LOG_INTERNET", [
    { key: "id", header: "id", width: 8 },
    { key: "biometrico", header: "biometrico", width: 12 },
    { key: "fecha", header: "fecha", width: 14 },
    { key: "usuario", header: "usuario", width: 30 },
    { key: "plan", header: "plan", width: 20 },
    { key: "observaciones", header: "observaciones", width: 35 }
  ], state.internetLogs, "00695C");
}
