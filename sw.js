const VERSION = 'v3';

const CACHE_ESTATICO = `estatico-${VERSION}`;
const CACHE_DATOS = `datos-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './offline.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];


// ============================================
// INSTALL
// ============================================

self.addEventListener('install', event => {
  console.log('[SW] install', VERSION);

  event.waitUntil(
    caches.open(CACHE_ESTATICO)
      .then(cache => cache.addAll(PRECACHE))
  );
});


// ============================================
// ACTIVATE
// ============================================

self.addEventListener('activate', event => {
  console.log('[SW] activate', VERSION);

  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(
            key =>
              key !== CACHE_ESTATICO &&
              key !== CACHE_DATOS
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});


// ============================================
// MENSAJE SKIP_WAITING
// ============================================

self.addEventListener('message', event => {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
  }
});


// ============================================
// FETCH
// ============================================

self.addEventListener('fetch', event => {

  const req = event.request;

  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    return;
  }

  // Navegación
  if (req.mode === 'navigate') {

    event.respondWith(
      networkFirst(req)
    );

  }

  // Datos JSON
  else if (
    url.pathname.endsWith('/data/tareas.json')
  ) {

    event.respondWith(
      staleWhileRevalidate(req)
    );

  }

  // Recursos estáticos
  else {

    event.respondWith(
      cacheFirst(req)
    );

  }

});


// ============================================
// ESTRATEGIA 1
// CACHE FIRST
// Recursos estáticos
// ============================================

async function cacheFirst(req) {

  const cached = await caches.match(req);

  if (cached) {
    return cached;
  }

  const resp = await fetch(req);

  if (resp.ok) {

    const cache = await caches.open(
      CACHE_ESTATICO
    );

    await cache.put(
      req,
      resp.clone()
    );

    // Reto A:
    // limitar caché estática a máximo 10 entradas
    await limitarCache(
      CACHE_ESTATICO,
      10
    );

  }

  return resp;
}


// ============================================
// ESTRATEGIA 2
// NETWORK FIRST
// Navegación con respaldo offline
// ============================================

async function networkFirst(req) {

  try {

    const resp = await fetch(
      req,
      {
        cache: 'no-cache'
      }
    );

    const cache = await caches.open(
      CACHE_ESTATICO
    );

    await cache.put(
      req,
      resp.clone()
    );

    // Reto A:
    // limitar caché estática
    await limitarCache(
      CACHE_ESTATICO,
      10
    );

    return resp;

  }

  catch (e) {

    return (
      await caches.match(req)
    ) || (
      await caches.match('./offline.html')
    );

  }

}


// ============================================
// ESTRATEGIA 3
// STALE-WHILE-REVALIDATE
// Datos
// ============================================

async function staleWhileRevalidate(req) {

  const cache = await caches.open(
    CACHE_DATOS
  );

  const cached = await cache.match(req);

  const red = fetch(
    req,
    {
      cache: 'no-cache'
    }
  )
    .then(async resp => {

      if (resp.ok) {

        await cache.put(
          req,
          resp.clone()
        );

        // Reto A:
        // limitar caché de datos
        await limitarCache(
          CACHE_DATOS,
          10
        );

      }

      return resp;

    })
    .catch(() => cached);

  return cached || red;
}


// ============================================
// RETO A
// LÍMITE DE CACHÉ
// Máximo N entradas
// ============================================

async function limitarCache(nombre, max) {

  const cache = await caches.open(nombre);

  const claves = await cache.keys();

  if (claves.length > max) {

    await cache.delete(
      claves[0]
    );

    await limitarCache(
      nombre,
      max
    );

  }

}