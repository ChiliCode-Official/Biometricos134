const fs = require("fs");
let c = fs.readFileSync("app.js", "latin1");

c = c.replace(/emailjs\.send\(CONFIG\.EMAILJS\.SERVICE_ID,\s*CONFIG\.EMAILJS\.TEMPLATE_ID,\s*templateParams,\s*\{\s*publicKey:\s*CONFIG\.EMAILJS\.PUBLIC_KEY\s*\}\)/g, 
"emailjs.send(CONFIG.EMAILJS.SERVICE_ID, CONFIG.EMAILJS.TEMPLATE_ID, templateParams, CONFIG.EMAILJS.PUBLIC_KEY)");

fs.writeFileSync("app.js", c, "latin1");
console.log("done");
