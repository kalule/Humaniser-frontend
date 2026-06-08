/**
 * HumaniseAI Service Worker
 * Strategy: Cache-first for static assets, network-first for API calls.
 * SA-optimised: caches the app shell so it loads on slow/intermittent connections.
 */

const CACHE_NAME = 'humanise-v1'

// App-shell assets to pre-cache on install
const PRECACHE_URLS = ['/', '/index.html']

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: route strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept API or auth calls — always go to network
  if (
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/health') ||
    request.method !== 'GET'
  ) {
    return
  }

  // Navigation requests: network-first with app-shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          }
          return res
        })
    )
  )
})
