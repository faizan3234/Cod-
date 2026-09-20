const CACHE = 'solo-league-shell-1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('/offline.html')),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith('solo-league-shell-') && key !== CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  ),
);
self.addEventListener('fetch', (event) => {
  // Never cache shared state, API responses or uploads. Offline is never a save.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate')
    return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/offline.html')),
  );
});
