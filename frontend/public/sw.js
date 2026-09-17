/* HelpDesk-GMP Service Worker
 * Estrategia:
 *   - HTML (navegacion): network-first, fallback a cache.
 *   - _next/static/*: cache-first (assets versionados por Next.js).
 *   - /api/*: network-only (nunca cachear datos del backend).
 *   - /ws, /wss: bypass total (no interceptar WebSocket).
 *   - Iconos y manifest: cache-first con revalidacion.
 */

const CACHE_VERSION = "v5";
const STATIC_CACHE = `helpdesk-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `helpdesk-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/login",
  "/tickets",
  "/manifest.json",
  "/icon-192.png?v5",
  "/icon-512.png?v5",
  "/icon-maskable-512.png?v5",
  "/apple-touch-icon.png?v5",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isWebSocket(request) {
  return (
    request.url.includes("/ws") ||
    request.url.includes("/wss") ||
    request.headers.get("upgrade") === "websocket"
  );
}

function isApi(request) {
  return new URL(request.url).pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.json" ||
    /\.(png|svg|ico|webp|woff2?|ttf|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (isWebSocket(request)) return;

  const url = new URL(request.url);

  if (isApi(request)) {
    event.respondWith(fetch(request).catch(() => new Response("", { status: 503 })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached =
            (await caches.match(request)) ||
            (await caches.match("/")) ||
            new Response("Offline", { status: 503 });
          return cached;
        }
      })()
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })()
    );
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function _isUrgent(payload) {
  const p = payload && payload.prioridad;
  if (!p) return false;
  const v = String(p).toLowerCase();
  return v === "urgente";
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "HelpDesk-GMP",
    body: "Tenes una nueva notificacion",
    url: "/",
    prioridad: "",
    data: {},
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      try {
        payload.body = event.data.text() || payload.body;
      } catch {}
    }
  }
  const urgent = _isUrgent(payload);
  const options = {
    body: payload.body,
    icon: "/icon-192.png?v5",
    data: { url: payload.url, ...(payload.data || {}) },
    requireInteraction: urgent,
    silent: false,
    vibrate: urgent ? [300, 100, 300, 100, 300] : [200],
    timestamp: Date.now(),
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(payload.title, options).catch((err) => {
      console.error("SW showNotification fallo:", err);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const fullTarget = new URL(targetUrl, self.location.origin).href;
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin) {
              await client.focus();
              if ("navigate" in client) {
                try {
                  await client.navigate(fullTarget);
                } catch {
                }
              }
              return;
            }
          } catch {
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(fullTarget);
      }
    })()
  );
});

self.addEventListener("notificationclose", (event) => {
  if (event.notification && event.notification.data && event.notification.data.url) {
    // placeholder para tracking futuro de dismissales
  }
});
