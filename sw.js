/* TaskFlow · service worker: funciona sin conexión y permite notificaciones en móvil */
const CACHE = "taskflow-v10";
const SHELL = ["./", "index.html", "theme-init.js", "styles.css", "app.js", "integrations.js", "ai.js", "wallpapers.js", "groups.js", "cloud-config.js", "cloud.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon.svg", "logo-light.png", "logo-dark.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para recibir actualizaciones) y caché como respaldo sin conexión.
// Solo se gestionan recursos propios; las APIs externas (Google, Spotify, IA…) nunca se cachean.
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.searchParams.has("code")) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => (l[0] ? l[0].focus() : clients.openWindow("./"))));
});
