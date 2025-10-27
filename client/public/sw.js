const CACHE_NAME = 'wotc-platform-v1';
const OFFLINE_URL = '/offline.html';

const CACHE_ASSETS = [
  '/',
  '/offline.html',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
  } else {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'font')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let notificationData;
  
  try {
    notificationData = event.data ? event.data.json() : {};
  } catch (e) {
    notificationData = {
      title: 'WOTC Platform',
      body: event.data ? event.data.text() : 'New notification',
    };
  }

  const options = {
    body: notificationData.body || 'New notification',
    icon: notificationData.icon || '/favicon.png',
    badge: notificationData.badge || '/favicon.png',
    vibrate: [200, 100, 200],
    data: notificationData.data || {
      dateOfArrival: Date.now(),
      url: '/',
    },
    actions: notificationData.actions || [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'close',
        title: 'Dismiss',
      }
    ],
    tag: notificationData.tag || 'wotc-notification',
    requireInteraction: notificationData.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'WOTC Platform', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
