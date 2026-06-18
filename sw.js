const CACHE_VERSION = 'todoapp-shell-v2';

const SHELL_ASSETS = [
  'index.html',
  'manifest.json',
  'static/login.html',
  'static/signup.html',
  'static/css/style.css',
  'static/js/app.js',
  'static/js/auth.js',
  'static/js/config.js',
  'static/js/supabaseClient.js',
  'static/js/todoLogic.js',
  'static/js/validators.js',
  'static/icons/icon-192.png',
  'static/icons/icon-512.png',
  'static/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 인증/데이터 요청과 ESM CDN은 항상 네트워크로 통과시키고 캐싱하지 않는다.
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'esm.sh') {
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
