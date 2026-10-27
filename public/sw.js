// Service worker: makes the app installable and readable offline.
// - Hashed build assets (/assets/*): cache first (they never change).
// - Everything else (the page, server-function reads, icons): network first,
//   falling back to the last cached copy. The page is server-rendered with
//   all notes in it, so offline you get the notes as they were last loaded
//   (read-only: saving needs the server).
const CACHE = 'app-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add('/'))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        if (request.mode === 'navigate') {
          const page = await caches.match('/')
          if (page) return page
        }
        return Response.error()
      }),
  )
})
