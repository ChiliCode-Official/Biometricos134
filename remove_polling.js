const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(/function startNotificationPolling\(\) \{[\s\S]*?notificationPollingTimer = setInterval\(pollForUpdates, 15000\); \/\/ 15 seconds\s*\}/, `function startNotificationPolling() {\n  // Disabled: Firebase onSnapshot now handles real-time updates natively.\n}`);

appJs = appJs.replace(/async function pollForUpdates\(\) \{[\s\S]*?console\.error\("Error polling notifications:", err\);\s*\}\s*\}/, `async function pollForUpdates() {\n  // Disabled\n}`);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log("Polling removed.");
