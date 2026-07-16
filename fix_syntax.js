const fs = require("fs");
let c = fs.readFileSync("app.js", "latin1");

c = c.replace(/    \} else if \(action === "confirm"\) \{\n      await db\.collection\("logs"\)\.doc\(payload\.id\)\.update\(\{\n        estado: "Activo",\n        hora_salida_real: timeStr\n      \}\);\n    \}\);\n    \}/, 
`    } else if (action === "confirm") {\n      await db.collection("logs").doc(payload.id).update({\n        estado: "Activo",\n        hora_salida_real: timeStr\n      });\n    }`);

fs.writeFileSync("app.js", c, "latin1");
console.log("done");
