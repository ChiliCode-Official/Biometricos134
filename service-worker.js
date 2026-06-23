const CACHE_NAME = 'n134-biometricos-v1';
const ASSETS = [
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Instalar el Service Worker y almacenar activos en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Almacenando en caché los activos estáticos');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activar el Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de red: Cache con caída a Red (Network Fallback)
// Si no hay red, sirve el recurso desde caché
self.addEventListener('fetch', (e) => {
  // Evitar interceptar solicitudes HTTP del Google Script API
  if (e.request.url.includes('script.google.com') || e.request.url.includes('googleusercontent.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolver respuesta cacheada e intentar actualizar la caché en segundo plano si está conectado
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Ignorar errores al actualizar caché sin conexión */});
        
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
