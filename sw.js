const CACHE_NAME = 'drinkme-cache-v53';

// Assets to cache immediately for offline usability
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  
  // Audio Assets
  './sounds/chime.mp3',
  './sounds/goal.mp3',
  './sounds/reminder.mp3',

  // UI & Tutorial Images
  './img/brand.png',
  './img/ProgressPT1.PNG',
  './img/SettingsPT1.PNG',
  './img/RemPT1.PNG',
  './img/HistoryPT1.PNG',


  // External Resources
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght=700&family=Comfortaa:wght=400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght=200;300;400&display=swap'
];

// Install Event: Caches all critical app shells and libraries
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((asset) => 
          cache.add(asset).catch(err => console.warn(`Failed to cache ${asset}:`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleans up older caches if updates are published
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Serves resources from Cache first, falling back to Network
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' || event.request.url.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});

// Message listener to trigger background alerts natively on Android
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'TRIGGER_REMINDER' || data.type === 'TRIGGER_NOTIFICATION') {
    const amount = data.amt || 250;
    const options = {
      body: data.msg || data.body || 'Time to drink some water!',
      icon: './img/brand.png',
      badge: './img/brand.png',
      vibrate: [100, 50, 100],
      tag: 'hydration-reminder',
      renotify: true,
      requireInteraction: true,
      data: {
        url: './index.html',
        amt: amount
      },
      actions: [
        { action: 'log_water', title: '💧 Log Water' },
        { action: 'skip_reminder', title: '⏭️ Skip' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Hydration Time! 💧', options)
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Hydration Time! 💧', body: 'Time to drink some water!', amt: 250 };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './img/brand.png',
    badge: './img/brand.png',
    vibrate: [100, 50, 100],
    data: {
      url: './index.html',
      amt: data.amt || 250
    },
    actions: [
      { action: 'log_water', title: '💧 Log Water' },
      { action: 'skip_reminder', title: '⏭️ Skip' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle when the user clicks the notification to open your app & log water
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const amtToLog = notifData.amt || 250;
  const action = event.action;

  if (action === 'skip_reminder') {
    // User explicitly chose to skip the reminder; do nothing further
    return;
  }

  if (action === 'log_water') {
    // Quietly log the water via open clients or update state silently
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        let sentToOpenTab = false;
        for (const client of clientList) {
          // Send message to log water without focusing/bringing the window to front
          client.postMessage({
            type: 'LOG_WATER_FROM_NOTIF',
            amount: amtToLog
          });
          sentToOpenTab = true;
        }

        // Show a brief confirmation notification letting the user know it was logged successfully
        return self.registration.showNotification('Hydration Logged! 🎉', {
          body: `Successfully logged ${amtToLog}ml of water! Keep up the great work!`,
          icon: './img/brand.png',
          badge: './img/brand.png',
          tag: 'log-success',
          renotify: false
        });
      })
    );
    return;
  }

  // Default notification click (clicking the notification body itself) opens or focuses the tab
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'LOG_WATER_FROM_NOTIF',
            amount: amtToLog
          });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(`./index.html?addMl=${amtToLog}`);
      }
    })
  );
});
