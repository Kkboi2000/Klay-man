// Keeps Klayman playable offline. When you change any file, bump VERSION so
// phones fetch the new build the next time the game is opened.
const VERSION = 'klayman-v6';

const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/config.js',
  './js/world.js',
  './js/game.js',
  './js/klayman.js',
  './js/bacteria.js',
  './js/dirtball.js',
  './js/dirtshot.js',
  './js/items.js',
  './js/sprites.js',
  './js/render.js',
  './js/input.js',
  './js/sound.js',
  './js/ui.js',
  './assets/bg.png',
  './assets/klay.png',
  './assets/bacteiras.png',
  './assets/tree.png',
  './assets/klayman.png',
  './assets/throw.mp3',
  './assets/hit.mp3',
  './assets/break.mp3',
  './assets/fonts/pixelify-sans.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-48.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    }),
  );
});
