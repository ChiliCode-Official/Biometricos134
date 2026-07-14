// firebase-integration.js
console.log("Firebase Integration Active");

// 1. Initialize Firebase
firebase.initializeApp(CONFIG.FIREBASE);
const db = firebase.firestore();

// 2. Real-time Listeners
let isFirstLoad = true;

function setupRealtime() {
  const collections = ["biometrics", "logs", "inkLogs", "internetLogs", "users"];
  
  collections.forEach(coll => {
    db.collection(coll === "biometrics" || coll === "users" ? "app_data" : coll)
      .onSnapshot(snapshot => {
        if (coll === "biometrics" || coll === "users") {
           // These are single documents
           const doc = snapshot.docs.find(d => d.id === coll);
           if (doc) state[coll] = doc.data().items || [];
        } else {
           // These are collections
           state[coll] = snapshot.docs.map(d => {
               const data = d.data();
               // Ensure the id is attached if not present, useful for logs
               if (!data.id) data.id = d.id;
               return data;
           });
           
           // Sort logs chronologically (descending)
           if (coll === "logs") {
              state.logs.sort((a,b) => {
                 let dA = new Date(a.fecha_salida + " " + (a.hora_salida_real || a.hora_salida || "00:00"));
                 let dB = new Date(b.fecha_salida + " " + (b.hora_salida_real || b.hora_salida || "00:00"));
                 return dB - dA;
              });
           }
        }
        
        // Trigger UI Re-render always to keep things perfectly in sync
        if (typeof recalculateBiometricStates === "function") recalculateBiometricStates();
        if (typeof renderBiometrics === "function") renderBiometrics();
        if (typeof renderAdminDashboard === "function") renderAdminDashboard();
        if (typeof updateSequentialSuggestion === "function") updateSequentialSuggestion();
      });
  });
}

// 3. Override window.fetch to hijack GAS calls
const originalFetch = window.fetch;
window.fetch = async function() {
  const url = arguments[0];
  
  if (typeof url === 'string' && url.includes(CONFIG.GOOGLE_SHEET_API_URL)) {
    // Parse query params to determine action
    let params;
    if (url.includes('?')) {
        params = new URLSearchParams(url.split('?')[1]);
    } else if (arguments[1] && arguments[1].body) {
        // Handle POST requests just in case app.js uses them
        params = new URLSearchParams(arguments[1].body);
    } else {
        return new Response(JSON.stringify({status: 'error'}), { status: 400 });
    }
    
    const action = params.get('action');
    
    // Fake a fast network delay
    await new Promise(r => setTimeout(r, 200));

    try {
      if (!action || action === 'getDatabase' || action === 'getAllData') {
         // Return current state synced from Firebase formatted for app.js
         return new Response(JSON.stringify({
            success: true,
            version: "v2",
            users: state.users,
            biometrics: state.biometrics,
            logs: state.logs,
            inkLogs: state.inkLogs,
            internetLogs: state.internetLogs
         }), { status: 200 });
      }
      
      if (action === 'saveBiometrics') {
         const itemsStr = params.get('items');
         if (itemsStr) {
             const items = JSON.parse(decodeURIComponent(itemsStr));
             await db.collection('app_data').doc('biometrics').set({ items: items });
         }
         return new Response(JSON.stringify({status: 'success'}), { status: 200 });
      }

      if (action === 'logUso') {
         const logObj = {};
         for (let [key, val] of params.entries()) {
             if (!['action', '_t'].includes(key)) logObj[key] = val;
         }
         logObj.id = Date.now().toString() + Math.floor(Math.random()*1000); // Generate ID
         await db.collection('logs').doc(logObj.id).set(logObj);
         return new Response(JSON.stringify({status: 'success', id: logObj.id}), { status: 200 });
      }

      if (action === 'returnUso') {
         const id = params.get('id');
         const logToUpdate = state.logs.find(l => l.id === id);
         if (logToUpdate) {
            logToUpdate.status = params.get('status');
            logToUpdate.comment = params.get('comment');
            logToUpdate.location = params.get('location');
            logToUpdate.signature = params.get('signature');
            // Re-save entire log (since we mock finding the original doc)
            await db.collection('logs').doc(id).set(logToUpdate);
         }
         return new Response(JSON.stringify({status: 'success'}), { status: 200 });
      }

      if (action === 'registrarTinta') {
         const logObj = {};
         for (let [key, val] of params.entries()) {
             if (!['action', '_t'].includes(key)) logObj[key] = val;
         }
         logObj.fecha = new Date().toLocaleDateString('en-CA') + " " + new Date().toLocaleTimeString('en-GB');
         await db.collection('inkLogs').add(logObj);
         return new Response(JSON.stringify({status: 'success'}), { status: 200 });
      }

      if (action === 'registrarInternet') {
         const logObj = {};
         for (let [key, val] of params.entries()) {
             if (!['action', '_t'].includes(key)) logObj[key] = val;
         }
         logObj.fecha = new Date().toLocaleDateString('en-CA') + " " + new Date().toLocaleTimeString('en-GB');
         await db.collection('internetLogs').add(logObj);
         return new Response(JSON.stringify({status: 'success'}), { status: 200 });
      }

      return new Response(JSON.stringify({status: 'success'}), { status: 200 });

    } catch (err) {
      console.error("Firebase Hijack Error:", err);
      return new Response(JSON.stringify({status: 'error', message: err.message}), { status: 500 });
    }
  }

  // Not a GAS call, pass through
  return originalFetch.apply(this, arguments);
};

// Initialize
setupRealtime();
