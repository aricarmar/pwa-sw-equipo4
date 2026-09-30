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

self.addEventListener('install', event => {
  console.log('[SW] install', VERSION);

  event.waitUntil(
    caches.open(CACHE_ESTATICO)
      .then(c => c.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] activate', VERSION);

  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_ESTATICO && k !== CACHE_DATOS)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {

    event.respondWith(networkFirst(req));

  } else if (url.pathname.endsWith('/data/tareas.json')) {

    event.respondWith(staleWhileRevalidate(req));

  } else {

    event.respondWith(cacheFirst(req));

  }
});


// Estrategia 1: cache-first
// Recursos estáticos

async function cacheFirst(req) {

  const cached = await caches.match(req);

  if (cached) return cached;

  const resp = await fetch(req);

  if (resp.ok) {
    const cache = await caches.open(CACHE_ESTATICO);
    cache.put(req, resp.clone());
  }

  return resp;
}


// Estrategia 2: network-first
// Navegación con respaldo offline

async function networkFirst(req) {

  try {

    const resp = await fetch(req, {
      cache: 'no-cache'
    });

    const cache = await caches.open(CACHE_ESTATICO);

    cache.put(req, resp.clone());

    return resp;

  } catch (e) {

    return (
      await caches.match(req)
    ) || (
      await caches.match('./offline.html')
    );

  }
}


// Estrategia 3: stale-while-revalidate
// Datos

async function staleWhileRevalidate(req) {

  const cache = await caches.open(CACHE_DATOS);

  const cached = await cache.match(req);

  const red = fetch(req, {
    cache: 'no-cache'
  })
    .then(resp => {
      cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => cached);

  return cached || red;
}