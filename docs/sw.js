/* Service worker del catálogo.
   - Páginas y datos (products.json, meta.json): siempre se pide la versión nueva a
     internet y se guarda una copia; sin conexión se usa esa copia. Así cada cambio se
     ve al instante en la app instalada, sin esperar los 10 minutos de caché de GitHub.
   - Fotos: se muestra la copia guardada al tiro y se actualiza por detrás.
   Todo lo demás (fuentes, WhatsApp, etc.) pasa directo, sin tocarlo. */
const CACHE = "eg-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function primeroInternet(req) {
  const cache = await caches.open(CACHE);
  // Las páginas se guardan sin lo que va después del "?" (filtros, producto abierto): una copia por página.
  const url = new URL(req.url), clave = req.mode === "navigate" ? url.origin + url.pathname : req.url;
  try {
    // "no-cache" pregunta al servidor si hay versión nueva en vez de usar la guardada por 10 minutos.
    let res = await fetch(req.url, {cache: "no-cache", credentials: "same-origin"});
    // Chrome no acepta una respuesta "redirigida" para abrir una página: se entrega limpia.
    if (res.redirected) res = new Response(await res.blob(), {status: res.status, statusText: res.statusText, headers: res.headers});
    if (res.ok) cache.put(clave, res.clone());
    return res;
  } catch (err) {
    const copia = await cache.match(clave);
    if (copia) return copia;
    throw err;
  }
}

async function copiaYActualiza(e) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(e.request);
  const nueva = fetch(e.request).then(res => {
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  });
  if (copia) { e.waitUntil(nueva.catch(() => {})); return copia; }
  return nueva;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate" || url.pathname.endsWith(".json")) { e.respondWith(primeroInternet(req)); return; }
  if (url.pathname.includes("/fotos/")) e.respondWith(copiaYActualiza(e));
});
