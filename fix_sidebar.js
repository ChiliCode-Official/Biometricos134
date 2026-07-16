const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const closeLogic = `  const sidebar = document.querySelector('.dashboard-sidebar');
  if(sidebar) sidebar.classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if(overlay) overlay.classList.add('hidden');
  renderUserList();`;

appJs = appJs.replace(/renderUserList\(\);/g, (match, offset, string) => {
  // Only replace the one inside openUserManagementModal
  if(string.substring(Math.max(0, offset - 100), offset).includes('openUserManagementModal')) {
    return closeLogic;
  }
  return match;
});

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('done');
