/* АгроАналитика Service Worker — PWA offline support
 * Важно: не кэшировать index.html при install и не отдавать HTML cache-first —
 * иначе после деплоя остаётся старый index со старыми /assets/*.js → белый экран.
 * Precache не используем: в Vite у manifest и бандлов хэши в пути, addAll('/manifest.json') в prod даёт 404. */
const CACHE_NAME = 'agroanalytica-v4'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME))
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

  // HTML / навигация — всегда сначала сеть (актуальный index после деплоя)
  const isDocument =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    (url.pathname.endsWith('.html') && !url.pathname.startsWith('/api/'))

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Vite-бандлы — network-first, затем кэш (новые хэши после релиза)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Прочие статика — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
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
  console.log('[SW] Syncing pending actions...')
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'АгроАналитика', {
      body: data.body || '',
      icon: '/vite.svg',
      badge: '/vite.svg',
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
