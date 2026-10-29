// Keeps Klayman playable offline. When you change any file, bump VERSION so
// phones fetch the new build the next time the game is opened.
const VERSION = 'klayman-v22';

const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './main.js',
  './config.js',
  './world.js',
  './game.js',
  './klayman.js',
  './bacteria.js',
  './dirtball.js',
  './dirtshot.js',
  './items.js',
  './boss.js',
  './gadgets.js',
  './sprites.js',
  './render.js',
  './input.js',
  './sound.js',
  './ui.js',
  './gear.js',
  './setup.js',
  './art.js',
  './titleballs.js',
  './orientation.js',
  './weather.js',
  './bg.png',
  './klay.png',
  './bacteiras.png',
  './tree.png',
  './boss.png',
  './throw.mp3',
  './hit.mp3',
  './break.mp3',
  './music.mp3',
  './pixelify-sans.woff2',
  './klay-digits.woff2',
  './klay-digits-bold.woff2',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-48.png',
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
