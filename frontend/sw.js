/* АгроАналитика Service Worker — PWA offline support */
const CACHE_NAME = 'agroanalytica-v2'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API calls — network only (no caching of live data)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/analytics/') || url.pathname.startsWith('/weather/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', message: 'Нет подключения к сети. Работаете в офлайн-режиме.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    )
    return
  }

  // Static assets — cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          // Cache successful GET responses for static assets
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Fallback to index.html for navigation requests (SPA)
          if (request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          return new Response('', { status: 404 })
        })
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-recommendations') {
    event.waitUntil(syncPendingActions())
  }
})

async function syncPendingActions() {
  // Sync any queued offline actions when connectivity is restored
  console.log('[SW] Syncing pending actions...')
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'АгроАналитика', {
      body: data.body || '',
      icon: '/manifest.json',
      badge: '/manifest.json',
      tag: data.tag || 'agro-alert',
      data: { url: data.url || '/' },
      actions: [
        { action: 'view', title: 'Открыть' },
        { action: 'dismiss', title: 'Закрыть' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'view' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'))
  }
})
