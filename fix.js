const fs = require("fs");
let c = fs.readFileSync("app.js", "latin1");

c = c.replace(/hora_salida_real:\s*timeStr,\s*fecha_entrada:\s*"",\s*hora_entrada:\s*"",\s*estado:\s*"Activo",/g, 
"hora_salida_real: \"\",\n        fecha_entrada: \"\",\n        hora_entrada: \"\",\n        estado: \"Pendiente\",");

c = c.replace(/\} else if \(action === "cancel"\) \{[\s\S]*?\} else if \(action === "confirm"\) \{[\s\S]*?estado: "Activo"[\s\S]*?\}/, 
`} else if (action === "cancel") {\n      await db.collection("logs").doc(payload.id).delete();\n    } else if (action === "confirm") {\n      await db.collection("logs").doc(payload.id).update({\n        estado: "Activo",\n        hora_salida_real: timeStr\n      });\n    }`);

fs.writeFileSync("app.js", c, "latin1");
console.log("done");
