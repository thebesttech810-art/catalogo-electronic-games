/* Código de la tienda (antes iba dentro de index.html). Se carga con "defer": no frena el primer dibujo de la página. */
// Navegadores sin <dialog> (ver el <head>): cada ventana pasa a usar dialog-polyfill antes que nada.
if (window.dialogPolyfill) document.querySelectorAll("dialog").forEach(d => dialogPolyfill.registerDialog(d));

/* ============================================================
   CONFIGURACIÓN: número, locales y textos.
   ============================================================ */
const CONFIG = {
  whatsapp: "593969678365",   // con código de país, SIN "+"
  // Id del sitio en Umami (medición de visitas gratis y sin cookies). Vacío = no se mide nada.
  // Va también en ANALITICA_ID de paginas_producto.py.
  analitica: "1f84c623-7a7b-4d1f-90cd-ef1e1a646852",
  // URL de Google Apps Script que guarda cada pedido en una hoja de cálculo propia
  // (control de comisión). Vacío = no registra nada. No es una clave secreta: solo
  // permite AGREGAR filas, no leerlas.
  registroPedidosUrl: "",
  // URL del Worker de Cloudflare que conecta el chat del muñequito con la IA
  // (Gemini). Vacío = el chat no aparece, solo el botón de WhatsApp de siempre.
  chatMascotaUrl: "https://solitary-term-de3d.thebesttech810.workers.dev/",
  storeName: "Electronic Games",
  lowStockAt: 2,               // desde cuántas unidades se avisa "últimas unidades"
  porPagina: 40,
  tz: "America/Guayaquil",
  horario: { semana: [600, 1260], domingo: [630, 1110] },   // minutos desde medianoche
  locales: {
    // resenas: enlace a la ficha de Google Maps del local (Compartir > Copiar vínculo). Vacío = se busca por nombre.
    // fotos: las de la isla (docs/locales/<local>/1.jpg, 2.jpg…, con sus copias mini/ y zoom/). Sin fotos, va un póster.
    condado: { nombre: "Condado Shopping", zona: "Quito",     detalle: "Isla 21",   fotos: ["locales/condado/1.jpg", "locales/condado/2.jpg", "locales/condado/3.jpg", "locales/condado/4.jpg"], maps: "https://www.google.com/maps/search/?api=1&query=Condado%20Shopping%20Quito", resenas: "" },
    scala:   { nombre: "Scala Shopping",   zona: "Cumbayá",   detalle: "Isla 5",    fotos: ["locales/scala/1.jpg", "locales/scala/2.jpg", "locales/scala/3.jpg", "locales/scala/4.jpg", "locales/scala/5.jpg"], maps: "https://www.google.com/maps/search/?api=1&query=Scala%20Shopping%20Cumbaya", resenas: "" },
    valle:   { nombre: "Plaza del Valle",  zona: "Sangolquí", detalle: "Local B17", maps: "https://www.google.com/maps/search/?api=1&query=Centro%20Comercial%20Plaza%20del%20Valle%20Sangolqui", resenas: "" }
  },
  // Consola a la que pertenece cada producto, deducida del nombre. Un producto puede estar en
  // varias (una palanca PS5 está en "PS5" y en "PlayStation").
  plataformas: [
    ["PlayStation", /\bPS[1-5]\b|PLAY ?STATION|\bPSP\b|\bVITA\b|DUALSENSE|DUALSHOCK|PS ?PORTAL/],
    ["PS5", /\bPS5\b|PLAYSTATION 5/],
    ["PS4", /\bPS4\b|PLAYSTATION 4/],
    ["Nintendo", /SWITCH|SWICTH|NINTENDO|\bWII\b|GAME ?BOY|\bNES\b|\bSNES\b|\b3DS\b|JOY-?CON|AMIIBO/],
    ["Xbox", /XBOX/],
    ["PC", /\bPC\b|STEAM/],
    ["Retro", /\bPS[123]\b|\bWII\b|ATARI|RETRO|\bSNES\b|\bNES\b|GAME ?BOY|\bPSP\b|ARCADE|\bR36|MINI GAME|GAME ?STICK|CONSOLA SUP\b|CONSOLA X9\b/]
  ],
  // Mundos: cada plataforma grande con el color de su marca (solo dentro de su espacio).
  mundos: {
    // icono: emblema propio en 3D. logo: ruta a un logo oficial SOLO si la marca o el distribuidor lo autorizan
    // (p. ej. "logos/playstation.svg"); reemplaza al emblema. Xbox y Nintendo no permiten usar sus logos libremente.
    // logo: símbolo del logo de la marca en el sprite SVG; logo3d: su forma en logos3d.json ("eg" = el de la tienda).
    PlayStation: {c: "#0070D1", c2: "#00225A", frase: "Consolas, juegos y DualSense para PS5 y PS4.", subs: ["PS5", "PS4"], logo: "l-ps", logo3d: "playstation"},
    Nintendo:    {c: "#E60012", c2: "#5C0007", frase: "Switch 2, Switch, juegos y controles.", subs: [], logo: "l-nintendo", logo3d: "nintendo"},
    Xbox:        {c: "#107C10", c2: "#052E05", frase: "Consolas Xbox, juegos y controles.", subs: [], logo: "l-xbox", logo3d: "xbox"},
    Retro:       {c: "#FF7A00", c2: "#5A2300", frase: "Consolas portátiles, clásicos y palancas retro.", subs: [], logo: "i-logo", logo3d: "eg"}
  },
  atajos: ["PS5", "Nintendo Switch", "Pokémon", "Palanca", "Mario"],
  iconos: { consolas: "i-console", palancas: "i-pad", juegos: "i-disc", accesorios: "i-head" }
};

let PRODUCTS = [];
const VITRINA_URL = (u => u.has("vitrina") ? (u.get("vitrina") || "todo").toLowerCase() : null)(new URLSearchParams(location.search));
const S = {cat:"all", q:"", plat:"all", local:"all", estado:"all", precio:"all", sort:"dest", only:false, visibles:0};

// ===== Utilidades =====
const $ = id => document.getElementById(id);
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const money = (n, big) => { const [e,d] = n.toFixed(2).split("."); return `<span class="price${big?" big":""}"><span class="cur">$</span>${e}<small>.${d}</small></span>`; };
const fmt = n => "$" + n.toFixed(2);
const waLink = msg => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
// Código corto para identificar que un pedido salió de este catálogo (control de comisión).
const nuevoCodigo = () => "EG-" + (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2,4)).toUpperCase();
// Guarda cada pedido en una hoja propia (independiente del negocio), para poder
// comprobar por tu cuenta qué salió del catálogo. No bloquea ni depende de la
// respuesta: si falla, el pedido por WhatsApp igual funciona.
function registrarPedido(tipo, detalle){
  if (!CONFIG.registroPedidosUrl) return;
  const datos = new URLSearchParams({tipo, ...detalle});
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.registroPedidosUrl, datos);
    else fetch(CONFIG.registroPedidosUrl, {method: "POST", mode: "no-cors", body: datos});
  } catch(e) {}
}
// Página propia de cada producto (docs/p/…): la usan compartir y Google. Misma regla que archivo_de() en paginas_producto.py.
const BASE = new URL("./", location.href).href;
const paginaDe = p => `${BASE}p/${encodeURIComponent(p.code.replace(/[^A-Za-z0-9._-]/g, "-"))}.html`;

// Medición de visitas con Umami: sin cookies, sin datos personales. La visita se cuenta una
// sola vez al abrir; los filtros y la búsqueda (que cambian la dirección) no suman visitas.
if (CONFIG.analitica) {
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.dataset.websiteId = CONFIG.analitica;
  s.dataset.autoTrack = "false";
  s.dataset.domains = "electronicgamesec.com,www.electronicgamesec.com,thebesttech810-art.github.io";   // las pruebas locales no suman visitas
  s.onload = () => { try { window.umami.track(); } catch(e) {} };
  document.head.appendChild(s);
}
function medir(evento, datos){ try { window.umami?.track(evento, datos); } catch(e) {} try { logroPorEvento(evento, datos); } catch(e) {} }
let esperaSinResultados = 0;
function medirSinResultados(q){
  clearTimeout(esperaSinResultados);
  esperaSinResultados = setTimeout(()=>medir("busqueda-sin-resultados", {q: q.slice(0, 60)}), 1500);
}
// "¿No lo encuentras?": convierte una búsqueda vacía en una consulta por WhatsApp.
const pideloHTML = q => `<a class="wa-btn pidelo" data-tipo="pidelo" target="_blank" rel="noopener" href="${esc(waLink(`Hola ${CONFIG.storeName}, ¿tienen ${q}? Lo busqué en el catálogo web y no lo encontré.`))}"><svg aria-hidden="true"><use href="#i-wa"/></svg>Pregúntanos si lo tenemos</a>`;
const avisameHTML = q => `<button type="button" class="avisame" data-avisame="${esc(q)}">🔔 Avísame aquí cuando llegue</button>`;
const nLocales = Object.keys(CONFIG.locales).length;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// Lo pesado en 3D (three.js: el muñequito, el portal y la vitrina 360°) se arma recién cuando la persona
// toca, mueve el mouse, baja o usa el teclado. Así la página aparece y responde al instante (sobre todo
// en celulares) y el 3D llega un momento después, cuando ya se está mirando.
const alInteractuar = (()=>{
  const pendientes = [], eventos = ["pointerdown", "pointermove", "touchstart", "wheel", "scroll", "keydown"];
  let ya = false;
  const soltar = () => {
    if (ya) return; ya = true;
    eventos.forEach(ev=>removeEventListener(ev, soltar, true));
    for (const fn of pendientes.splice(0)) setTimeout(fn, 0);
  };
  eventos.forEach(ev=>addEventListener(ev, soltar, {capture: true, passive: true}));
  return fn => ya ? setTimeout(fn, 0) : pendientes.push(fn);
})();
// ===== Entradas: cada sección, título, paso y producto aparece una sola vez al llegar a él =====
// (con .visto; la animación es de CSS, en la GPU). Lo que ya se ve al volver a pintar el catálogo
// (buscar, filtrar) queda quieto: no se repite la entrada en cada letra que se escribe.
const ENTRADA = (()=>{
  if (reduceMotion() || !("IntersectionObserver" in window)) return null;
  document.documentElement.classList.add("entrada");
  // Si se baja rápido (pasando de largo), los productos aparecen ya puestos: animar decenas de
  // tarjetas a la vez es lo que más frena el scroll en un celular, y a esa velocidad ni se ve.
  let yAntes = scrollY, tAntes = 0, vel = 0;
  addEventListener("scroll", ()=>{
    const t = performance.now(), dt = t - tAntes;
    vel = dt > 0 && dt < 200 ? Math.abs(scrollY - yAntes) / dt : 0;
    yAntes = scrollY; tAntes = t;
  }, {passive: true});
  const rapido = () => vel > 1.6 && performance.now() - tAntes < 150;   // más de 1600 px por segundo
  const io = new IntersectionObserver(es=>{
    let k = 0;
    const deLargo = rapido();
    for (const e of es){
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      if (deLargo && e.target.classList.contains("card")){ e.target.classList.add("visto", "quieto"); continue; }
      e.target.style.setProperty("--d", Math.min(k++, 5));
      e.target.classList.add("visto");
    }
  }, {rootMargin: "0px 0px -6% 0px"});
  for (const el of document.querySelectorAll(".reveal, .sec-h, .servicio h2, .pasos li, .foot-gigante, .foot-mascota")) io.observe(el);
  // Secciones con animaciones que no terminan nunca: se pausan mientras no se ven.
  const pausa = new IntersectionObserver(es=>{ for (const e of es) e.target.classList.toggle("fuera", !e.isIntersecting); });
  for (const el of document.querySelectorAll("#secMundos, #portal")) pausa.observe(el);
  // En celulares y tablets los productos aparecen ya puestos (la foto igual se funde al cargar): la entrada
  // de decenas de tarjetas es lo que más frenaba el scroll con el dedo. Con mouse sí suben en 3D.
  const conMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  return {
    observar(els, quietos){
      if (!conMouse){ for (const el of els) el.classList.add("visto", "quieto"); return; }
      // quietos: lo que ya está en pantalla (o arriba) se muestra sin animar. Se mide todo antes de escribir.
      const tope = quietos ? innerHeight : -Infinity;
      const arriba = els.map(el=>el.getBoundingClientRect().top < tope);
      els.forEach((el, i)=>{ if (arriba[i]) el.classList.add("visto", "quieto"); else io.observe(el); });
    }
  };
})();

const buscar = code => PRODUCTS.find(x=>x.code===code);

// Las fotos aparecen con un fundido cuando terminan de cargar (sin "saltos").
document.documentElement.classList.add("js");
document.addEventListener("load", e=>{ if (e.target.tagName === "IMG") e.target.classList.add("ok"); }, true);
// Las fotos que ya llegaron antes de que corriera este código también quedan a la vista.
document.querySelectorAll("img").forEach(i=>{ if (i.complete && i.naturalWidth) i.classList.add("ok"); });

$("waTop").href = $("waHero").href = $("waMenu").href = $("waFoot").href = $("waFloat").href = waLink(`Hola ${CONFIG.storeName}, quiero hacer una consulta.`);
$("waServicio").href = waLink(`Hola ${CONFIG.storeName}, necesito servicio técnico para mi `);
$("anio").textContent = new Date().getFullYear();
$("local").insertAdjacentHTML("beforeend", Object.entries(CONFIG.locales).map(([k,L])=>`<option value="${k}">${L.nombre}</option>`).join(""));

// ===== Horario: abierto o cerrado ahora =====
function horaLocal(){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone: CONFIG.tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
    .formatToParts(new Date()).map(x=>[x.type, x.value]));
  return {dia: p.weekday, min: Number(p.hour) * 60 + Number(p.minute)};
}
const hhmm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
function estadoTienda(){
  const {dia, min} = horaLocal();
  const [abre, cierra] = dia === "Sun" ? CONFIG.horario.domingo : CONFIG.horario.semana;
  if (min >= abre && min < cierra) return {cls: "ok", txt: `Abierto ahora, cierra a las ${hhmm(cierra)}`, resumen: `Los ${nLocales} locales abiertos ahora, hasta las ${hhmm(cierra)}`};
  if (min < abre) return {cls: "out", txt: `Cerrado, abre hoy a las ${hhmm(abre)}`, resumen: `Locales cerrados, abren hoy a las ${hhmm(abre)}`};
  const manana = dia === "Sat" ? CONFIG.horario.domingo[0] : CONFIG.horario.semana[0];
  return {cls: "out", txt: `Cerrado, abre mañana a las ${hhmm(manana)}`, resumen: `Locales cerrados, abren mañana a las ${hhmm(manana)}`};
}
// ===== Locales: cada isla con su pila de fotos (se barajan solas mientras se ven; al tocarlas se abren
// en el visor). El local sin fotos lleva un póster con el muñequito. =====
const fotosLocal = k => {
  const L = CONFIG.locales[k];
  return {code: "local-" + k, name: `Isla de ${CONFIG.storeName} en ${L.nombre}`, photos: L.fotos || []};
};
function pintarTiendas(){
  $("tiendas").innerHTML = Object.entries(CONFIG.locales).map(([k, L])=>{
    const fotos = L.fotos || [];
    const pila = fotos.length
      ? `<button class="tienda-pila" type="button" data-local="${esc(k)}" aria-label="Ver las ${fotos.length} fotos de la isla en ${esc(L.nombre)}">${
          fotos.map((src, i)=>`<img src="${esc(fotoMini(src))}" srcset="${esc(fotoMini(src))} 400w, ${esc(src)} 1400w" sizes="(max-width: 700px) 90vw, 400px" alt="" width="720" height="540" loading="lazy" decoding="async" data-pos="${Math.min(i, 3)}" onerror="this.removeAttribute('srcset')">`).join("")
        }</button>
        <span class="tienda-cuenta" aria-hidden="true"><svg class="ico" aria-hidden="true"><use href="#i-expand"/></svg>${fotos.length} fotos</span>`
      : `<div class="tienda-poster" aria-hidden="true"><svg class="tienda-poster-logo"><use href="#i-logo"/></svg>
          <img src="mascota/poses/retira.webp" alt="" width="387" height="560" loading="lazy" decoding="async"><b>¡Te esperamos!</b></div>`;
    return `
    <article class="tienda">
      <div class="tienda-fotos">
        ${pila}
        <span class="tienda-estado"><span class="dot"></span><span class="txt"></span></span>
        <span class="tienda-isla" aria-hidden="true">${esc(L.detalle)}</span>
      </div>
      <span class="zona">${L.zona}</span>
      <strong>${L.nombre}</strong>
      <span class="dir">${L.detalle}</span>
      <div class="tienda-acc">
        <a href="${L.maps}" target="_blank" rel="noopener"><svg class="ico" style="width:18px;height:18px" aria-hidden="true"><use href="#i-map"/></svg>Cómo llegar</a>
        ${fotos.length ? `<button type="button" class="tienda-ver" data-local="${esc(k)}"><svg class="ico" style="width:18px;height:18px" aria-hidden="true"><use href="#i-expand"/></svg>Ver la isla</button>` : ""}
      </div>
    </article>`;
  }).join("");
  estadoTiendas();
  iniciarPilas();
}
// El estado (abierto / cerrado) se actualiza cada minuto sin volver a pintar las tarjetas.
function estadoTiendas(){
  const e = estadoTienda();
  for (const el of document.querySelectorAll(".tienda-estado")){ el.className = `tienda-estado ${e.cls}`; el.querySelector(".txt").textContent = e.txt; }
  $("heroAbierto").className = "hero-abierto " + e.cls;
  $("heroAbierto").innerHTML = `<span class="dot"></span>${e.resumen}`;
}
function iniciarPilas(){
  const pilas = [...document.querySelectorAll(".tienda-pila")];
  for (const pila of pilas){
    const fotos = [...pila.querySelectorAll("img")];
    pila.orden = fotos.map((_, i)=>i);   // orden[0]: la de adelante
    pila.siguiente = () => {
      if (pila.moviendo) return;
      pila.moviendo = true;
      const frente = fotos[pila.orden[0]];
      frente.classList.add("sale");   // se levanta y se va…
      setTimeout(()=>{                // …y queda al fondo mientras las otras avanzan
        frente.classList.remove("sale");
        pila.orden.push(pila.orden.shift());
        pila.orden.forEach((f, pos)=>{ fotos[f].dataset.pos = Math.min(pos, 3); });
        pila.moviendo = false;
      }, 360);
    };
    pila.onclick = ()=>abrirVisor(fotosLocal(pila.dataset.local), pila.orden[0], {oscuro: true});
  }
  document.querySelectorAll(".tienda-ver").forEach(b=>{ b.onclick = ()=>abrirVisor(fotosLocal(b.dataset.local), 0, {oscuro: true}); });
  // Se barajan solas cada 4 s (una pila a la vez) solo mientras la sección se ve y sin el mouse encima.
  if (!pilas.length || reduceMotion() || !("IntersectionObserver" in window)) return;
  let reloj = 0, turno = 0;
  const pasar = () => {
    if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return;
    const pila = pilas[turno++ % pilas.length];
    if (!pila.matches(":hover")) pila.siguiente();
  };
  new IntersectionObserver(([e])=>{
    clearInterval(reloj);
    $("tiendas").classList.toggle("activa", e.isIntersecting);
    if (e.isIntersecting) reloj = setInterval(pasar, 2200);
  }).observe($("tiendas"));
}
pintarTiendas();
setInterval(estadoTiendas, 60000);

// Opiniones: enlaces a las reseñas reales de cada local en Google Maps y al Instagram (nunca reseñas escritas aquí).
$("listaOpiniones").innerHTML = Object.values(CONFIG.locales).map(L=>`
  <a class="opinion" href="${esc(L.resenas || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${CONFIG.storeName} ${L.nombre} ${L.zona}`))}" target="_blank" rel="noopener">
    <span class="op-ico" aria-hidden="true"><svg class="ico"><use href="#i-pin"/></svg></span>
    <span class="op-zona">${esc(L.zona)}</span><strong>${esc(L.nombre)}</strong>
    <span class="op-cta">Ver y dejar reseñas en Google Maps<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>
  </a>`).join("") + `
  <a class="opinion ig" href="https://www.instagram.com/electronicgamesec/" target="_blank" rel="noopener">
    <span class="op-ico" aria-hidden="true"><svg class="ico"><use href="#i-ig"/></svg></span>
    <span class="op-zona">Instagram</span><strong>@electronicgamesec</strong>
    <span class="op-cta">Novedades y comentarios de clientes<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>
  </a>`;

// ===== Productos =====
// Sin foto todavía: "portada tipográfica" con el nombre del producto en grande, su categoría,
// su consola y el logo. Cada producto se ve distinto y a propósito, no como un espacio vacío.
// Fondo transparente: se ve sobre el mismo escenario claro que las fotos.
const LOGO_SVG = `<g fill="#FE8903" transform="matrix(1 0 -.7 1 51.8 0)"><path d="M27.5 44.8H125V56H27.5z"/><path d="M27.5 60.7H125V72H56v16H27.5z"/><path d="M65 77.6h60v14.7a12 12 0 0 1-12 12H27.5V93H97v-5H65z"/></g>`;
function placeholder(p, i){
  if (p._portada && i === 0) return p._portada;
  const nombre = p.name.replace(/\s+/g, " ").trim().toUpperCase();
  const fs = nombre.length <= 24 ? 44 : nombre.length <= 44 ? 37 : 32;
  const porLinea = Math.floor(390 / (fs * 0.66));
  const lineas = [];
  for (const w of nombre.split(" ")) {
    const k = lineas.length - 1;
    if (k >= 0 && (lineas[k] + " " + w).length <= porLinea) lineas[k] += " " + w;
    else lineas.push(w.length > porLinea ? w.slice(0, porLinea - 1) + "…" : w);
  }
  const ver = lineas.slice(0, 4);
  if (lineas.length > 4) ver[3] = ver[3].replace(/\s*\S*$/, "") + "…";
  const {txt, m} = consolaDe(p);
  const anchoTag = txt.length * 12 + 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
    <text x="56" y="152" font-family="Arial,sans-serif" font-weight="700" font-size="20" letter-spacing="3" fill="#D45F00">${esc((p.cat_label || "").toUpperCase())}</text>
    <g font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-style="italic" font-size="${fs}" fill="#1F1B18">
      ${ver.map((l, k)=>`<text x="56" y="${Math.round(200 + fs * 0.4 + k * fs * 1.08)}">${esc(l)}</text>`).join("")}
    </g>
    ${txt ? `<rect x="56" y="392" width="${anchoTag}" height="38" rx="8" fill="${colorMundo(m)}"/><text x="${56 + anchoTag / 2}" y="418" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="19" fill="${m === "Retro" ? "#140900" : "#fff"}">${esc(txt)}</text>` : ""}
    <svg x="346" y="388" width="100" height="43" viewBox="6 44.5 140 60">${LOGO_SVG}</svg>
    <text x="56" y="466" font-family="monospace" font-size="14" letter-spacing="2" fill="#8A8178">FOTO PRÓXIMAMENTE</text>
  </svg>`;
  const url = "data:image/svg+xml," + encodeURIComponent(svg);
  if (i === 0) p._portada = url;
  return url;
}
// El código del producto viaja en data-code (dato), nunca dentro del JavaScript del atributo onerror.
function onPhotoError(img){
  // Si falló la copia grande (zoom/) o la liviana (mini/), se usa la foto normal; si falló la normal, la portada.
  if (img.srcset){ img.removeAttribute("srcset"); img.src = img.src; return; }
  if (/\/mini\/[^/]+\.webp$/.test(img.src)){ img.src = img.src.replace(/\.webp$/, ".jpg"); return; }
  if (img.src.includes("/mini/")){ img.src = img.src.replace("/mini/", "/"); return; }
  img.onerror = null;
  const p = buscar(img.dataset.code);
  if (p) img.src = placeholder(p, Number(img.dataset.i) || 0);
}
// fotos/<código>/1.jpg -> fotos/<código>/zoom/1.jpg (2000 px: la crean mejorar_fotos.py y subir_fotos.py)
function fotoZoom(src){ return src.replace(/\/([^/]+\.jpg)$/, "/zoom/$1"); }
// fotos/<código>/1.jpg -> fotos/<código>/mini/1.webp (600 px; el WebP lo crea preparar_publicacion.py al publicar, si falta se usa mini/1.jpg: la de tarjetas y listas; pesa y se dibuja mucho menos)
function fotoMini(src){ return src.replace(/\/([^/]+)\.jpg$/, "/mini/$1.webp"); }   // declarada como función: la usan también los locales, que se pintan antes
const plataformasDe = p => p._plat || (p._plat = CONFIG.plataformas.filter(([, re])=>re.test(p.name.toUpperCase())).map(([n])=>n));
// Etiqueta de color con la consola exacta ("PS5", "Switch 2", "Xbox"…); si sirve para varias marcas, "Multi".
const colorMundo = m => CONFIG.mundos[m]?.c || "#3a373d";
const CONSOLAS_NINTENDO = [[/\bWII ?U\b/, "Wii U"], [/\bWII\b/, "Wii"], [/\b3DS\b/, "3DS"], [/\bSNES\b/, "SNES"], [/\bNES\b/, "NES"], [/GAME ?BOY/, "Game Boy"]];
function consolaDe(p){
  if (p._consola) return p._consola;
  const n = p.name.toUpperCase(), pl = plataformasDe(p);
  const marcas = ["PlayStation", "Nintendo", "Xbox"].filter(m=>pl.includes(m));
  let txt = "", m = marcas[0] || (pl.includes("Retro") ? "Retro" : pl.includes("PC") ? "PC" : "");
  if (marcas.length > 1) { txt = "Multi"; m = ""; }
  else if (m === "PlayStation") txt = pl.includes("PS5") ? "PS5" : pl.includes("PS4") ? "PS4" : n.match(/\bPS[123]\b|\bPSP\b/)?.[0] || "PlayStation";
  else if (m === "Nintendo") txt = /SWITCH ?2/.test(n) ? "Switch 2" : /SWITCH|SWICTH/.test(n) ? "Switch"
    : (CONSOLAS_NINTENDO.find(([re])=>re.test(n)) || [, "Nintendo"])[1];
  else txt = m;
  return (p._consola = {txt, m});
}
function etiquetaPlat(p){
  const {txt, m} = consolaDe(p);
  return txt ? `<span class="plat-tag${m === "Retro" ? " retro" : ""}" style="--c:${colorMundo(m)}">${esc(txt)}</span>` : "";
}
// Mundo al que pertenece el filtro de consola actual (PS5 y PS4 viven dentro de PlayStation).
function mundoActual(){
  if (CONFIG.mundos[S.plat]) return S.plat;
  return Object.keys(CONFIG.mundos).find(m=>CONFIG.mundos[m].subs.includes(S.plat)) || null;
}

function status(p){
  if (p.digital) return ["ok","Código digital"];
  if (S.local === "all"){
    const n = Object.values(p.stock).filter(x=>x>0).length;
    const t = Object.values(p.stock).reduce((a,b)=>a+b,0);
    if (!n) return ["out","Agotado"];
    if (t <= CONFIG.lowStockAt) return ["low","Últimas unidades"];
    return ["ok", n === nLocales ? "En los 3 locales" : `En ${n} local${n>1?"es":""}`];
  }
  const q = p.stock[S.local];
  if (!q) return ["out","Agotado aquí"];
  if (q <= CONFIG.lowStockAt) return ["low",`Quedan ${q}`];
  return ["ok",`${q} disponibles`];
}
const disponibles = n => !n ? "Agotado" : `${n} disponible${n > 1 ? "s" : ""}`;
const hasStock = p => p.digital || (S.local === "all" ? Object.values(p.stock).some(x=>x>0) : p.stock[S.local] > 0);

function cardHTML(p, lazy = true){
  const [cls, txt] = status(p);
  const efectivo = p.price_efectivo ?? p.price, tarjeta = p.price_tarjeta ?? p.price;
  const stickers = (p.top ? `<span class="sticker">Top ventas</span>` : "") + (p.nuevo ? `<span class="sticker nuevo">Nuevo</span>` : "");
  return `<div class="card${p.top ? " rara" : ""}" data-code="${esc(p.code)}" role="listitem" style="--c:${CONFIG.mundos[consolaDe(p).m]?.c || "#FF7A00"}">
    ${stickers ? `<div class="stickers">${stickers}</div>` : ""}
    <button class="card-open" type="button" data-code="${esc(p.code)}">
      <div class="img"><img src="${esc(fotoDe(p))}" alt="" width="500" height="500" ${lazy ? 'loading="lazy"' : ""} decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></div>
      <div class="body">
        <div class="cat-row"><span class="cat">${esc(p.cat_label || "")}</span>${etiquetaPlat(p)}</div>
        <div class="name">${esc(p.name)}</div>
        <span class="stock ${cls}"><span class="dot"></span>${txt}</span>
        <div class="row">
          <div class="prices">${money(efectivo)}${tarjeta > efectivo ? `<span class="price-tag">Tarjeta <b>$${tarjeta.toFixed(2)}</b></span>` : ""}</div>
        </div>
      </div>
    </button>
    <button class="fav" type="button" data-fav="${esc(p.code)}" aria-pressed="${FAVS.has(p.code)}" aria-label="Guardar en favoritos: ${esc(p.name)}"><svg class="ico" aria-hidden="true"><use href="#i-heart"/></svg></button>
    <div class="card-add" data-q="${PEDIDO.items.get(p.code) || 0}">${controlTarjeta(p)}</div>
  </div>`;
}
const fotoDe = p => p.photos.length ? fotoMini(p.photos[0]) : placeholder(p, 0);
// Ahorro pagando en efectivo o transferencia (tarjeta menos efectivo): se muestra en la ficha.
const ahorroDe = p => Math.max(0, (p.price_tarjeta ?? p.price) - (p.price_efectivo ?? p.price));
const skeletons = n => Array.from({length: n}, ()=>`<div class="skel" aria-hidden="true"><div class="img"></div><i></i><i></i><i></i></div>`).join("");

// Destacados: primero lo que tiene foto; dentro de cada grupo se respeta lo más vendido.
const conFotoPrimero = l => [...l.filter(p=>p.photos.length), ...l.filter(p=>!p.photos.length)];

// Búsqueda por palabras: "palanca ps5 roja" encuentra el producto aunque las palabras estén en otro orden.
const SINONIMOS = {control: ["palanca"], palanca: ["control"], mando: ["palanca", "control"], joystick: ["palanca", "control"]};
const textoBusqueda = p => p._txt || (p._txt = " " + norm(`${p.name} ${p.code} ${p.cat_label || ""} ${plataformasDe(p).join(" ")}`));
function coincide(p, q){
  const texto = textoBusqueda(p);
  return norm(q).split(/\s+/).filter(Boolean).every(w => texto.includes(w) || (SINONIMOS[w] || []).some(s => texto.includes(s)));
}
// Primero lo que empieza como lo escrito ("palanca ps5" → las palancas, no los estuches); en empate, lo más vendido.
function porRelevancia(lista, q){
  const f = norm(q.trim()), w = f.split(/\s+/)[0] || "";
  const puntos = p => { const n = norm(p.name);
    return (n.startsWith(f) ? 4 : n.includes(f) ? 2 : 0) + (n.startsWith(w) ? 1 : 0) + (norm(p.cat_label || "").startsWith(w.slice(0, 5)) ? 1 : 0); };
  return lista.map((p, i)=>[p, puntos(p), i]).sort((a, b)=>b[1] - a[1] || a[2] - b[2]).map(x=>x[0]);
}

// Cuenta hacia arriba al cargar (patrón "Number Ticker").
function contar(el, hasta){
  el.textContent = hasta;
  if (reduceMotion() || document.visibilityState !== "visible") return;
  const t0 = performance.now(), dur = 1100;
  const paso = t => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(hasta * (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// Podio de lo más vendido por categoría. El orden es el de ventas de los últimos 30 días (products.json ya
// viene así) y solo entra lo que se vendió ("vendido", sin cifras; lo pone generar_catalogo.py) y hoy tiene stock.
const EMOJI_CAT = {consolas: "🎮", palancas: "🕹️", juegos: "💿", accesorios: "🎧"};
let podioCat = null;
function pintarPodio(){
  const vendidos = PRODUCTS.filter(p => p.vendido && maxQty(p) > 0);
  const orden = c => { const i = Object.keys(EMOJI_CAT).indexOf(c); return i < 0 ? 99 : i; };
  const cats = [...new Set(vendidos.map(p => p.cat))].filter(c => vendidos.filter(p => p.cat === c).length >= 3).sort((a, b) => orden(a) - orden(b));
  $("podioCaja").hidden = !cats.length;
  if (!cats.length) return;
  if (!cats.includes(podioCat)) podioCat = cats[0];
  $("podioTabs").hidden = cats.length < 2;
  $("podioTabs").innerHTML = cats.map(c => `<button type="button" role="tab" aria-selected="${c === podioCat}" data-podio-cat="${esc(c)}">${EMOJI_CAT[c] || "⭐"} ${esc(vendidos.find(p => p.cat === c).cat_label)}</button>`).join("");
  const [a, b, c] = vendidos.filter(p => p.cat === podioCat);
  $("podio").innerHTML = [[b, 2], [a, 1], [c, 3]].map(([p, n]) => `<button type="button" class="podio-lugar l${n}" data-podio="${esc(p.code)}">
      ${n === 1 ? `<span class="podio-corona" aria-hidden="true">👑</span>` : ""}
      <span class="podio-foto"><img src="${esc(fotoDe(p))}" alt="" width="220" height="220" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"><span class="podio-medalla" aria-hidden="true">${["🥇", "🥈", "🥉"][n - 1]}</span></span>
      <span class="podio-nombre">${esc(p.name)}</span>
      <span class="podio-precio">${fmt(precio(p, "efectivo"))}</span>
      <span class="podio-base"><span class="sr">Puesto </span>${n}</span>
    </button>`).join("");
}

// ===== Carga =====
async function loadProducts(){
  $("grid").innerHTML = `<div class="cargando-mascota" role="status"><img src="mascota/poses/baila.webp" alt="" width="447" height="560" decoding="async">Cargando productos…</div>` + skeletons(8);
  $("railTop").innerHTML = skeletons(6);
  // La vitrina guarda su lugar desde el inicio para que nada salte cuando llegan las fotos.
  $("stream").innerHTML = [0, 1, 2].map(()=>`<div class="stream-col"><div class="stream-track">${'<div class="stream-item" aria-hidden="true"></div>'.repeat(4)}</div></div>`).join("");
  $("grid").setAttribute("aria-busy", "true");
  try{
    const res = await fetch("products.json", {cache: "no-cache"});
    if (!res.ok) throw new Error("HTTP " + res.status);
    PRODUCTS = await res.json();
  }catch(err){
    $("grid").innerHTML = `<div class="empty" role="listitem"><img class="mascota-mini triste" src="mascota/poses/triste.webp" alt="" width="371" height="560" decoding="async"><strong>No pudimos cargar el catálogo.</strong>Revisa tu conexión y recarga la página.</div>`;
    $("railTop").innerHTML = "";
    $("vitrina").hidden = true;
    $("heroEstado").textContent = "Catálogo no disponible por ahora";
    return;
  } finally {
    $("grid").removeAttribute("aria-busy");
  }
  pintarEstado();
  pintarVitrina();

  const conteo = new Map(), etiqueta = new Map();
  for (const p of PRODUCTS){ conteo.set(p.cat, (conteo.get(p.cat) || 0) + 1); etiqueta.set(p.cat, p.cat_label || p.cat); }
  const cats = [...conteo.entries()].sort((a,b)=>b[1]-a[1]);
  $("chips").innerHTML = `<span class="chip-ind quieto" id="chipInd" aria-hidden="true"></span><button class="chip" type="button" data-cat="all" aria-pressed="true">Todo<small>${PRODUCTS.length}</small></button>` +
    cats.map(([k,n])=>`<button class="chip" type="button" data-cat="${esc(k)}" aria-pressed="false">${esc(etiqueta.get(k))}<small>${n}</small></button>`).join("");
  // Cada bloque muestra un abanico con 3 fotos reales de su categoría; si aún no hay fotos, su ícono.
  $("tiles").innerHTML = cats.map(([k,n])=>{
    const fotos = PRODUCTS.filter(p=>p.cat === k && p.photos.length).slice(0, 3);
    const visual = fotos.length === 3
      ? `<span class="fan" aria-hidden="true">${fotos.map(p=>`<span><img src="${esc(fotoMini(p.photos[0]))}" alt="" width="200" height="200" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></span>`).join("")}</span>`
      : `<svg class="ico tile-ico" aria-hidden="true"><use href="#${CONFIG.iconos[k] || "i-bag"}"/></svg>`;
    return `<button class="tile" type="button" data-ir-cat="${esc(k)}">
      <span class="tile-top"><span><strong>${esc(etiqueta.get(k))}</strong><span class="n">${n} productos con stock</span></span>
      <span class="ir" aria-hidden="true"><svg class="ico"><use href="#i-arrow"/></svg></span></span>
      ${visual}
    </button>`;
  }).join("");
  $("footCats").innerHTML = cats.map(([k])=>`<li><a href="?cat=${encodeURIComponent(k)}#catalogo" data-ir-cat="${esc(k)}">${esc(etiqueta.get(k))}</a></li>`).join("");

  const porPlat = new Map();
  for (const p of PRODUCTS) for (const n of plataformasDe(p)) porPlat.set(n, (porPlat.get(n) || 0) + 1);
  const conPlat = CONFIG.plataformas.filter(([n])=>porPlat.get(n));
  $("plat").insertAdjacentHTML("beforeend", conPlat.map(([n])=>`<option value="${esc(n)}">${esc(n)} (${porPlat.get(n)})</option>`).join(""));
  pintarMundos();
  prepararPortal();
  prepararAnillo();
  datosEstructurados();

  // Portada como vitrina: lo más vendido que ya tiene foto (si todavía hay pocas fotos, todo).
  const masVendidos = PRODUCTS.filter(p=>p.photos.length).length >= 6 ? PRODUCTS.filter(p=>p.photos.length) : PRODUCTS;
  $("railTop").innerHTML = masVendidos.slice(0, 12).map((p, i)=>cardHTML(p, i > 3)).join("");   // solo las primeras sin "lazy": el carrusel queda más abajo y el resto se baja al acercarse
  pintarPodio();
  const nuevos = conFotoPrimero(PRODUCTS.filter(p=>p.nuevo)).slice(0, 12);
  $("secNuevos").hidden = !nuevos.length;
  $("railNuevos").innerHTML = nuevos.map(p=>cardHTML(p)).join("");
  document.querySelectorAll(".rail-nav").forEach(actualizarFlechas);

  S.visibles = CONFIG.porPagina;
  const abrir = leerURL();
  cargarPedido();
  render();
  actualizarPedido();
  pintarVistos();
  pintarFavoritos();
  if (VITRINA_URL){ K.mundo = VITRINA_URL; abrirVitrina(true); }
  else if (abrir && buscar(abrir)) openProduct(abrir);
  else if (new URLSearchParams(location.search).has("cat") || location.hash === "#catalogo") $("catalogo").scrollIntoView();
  if (!VITRINA_URL) setTimeout(revisarAvisos, 3500);
}

function pintarEstado(){
  $("heroEstado").innerHTML = `<span><b><span id="nProd">0</span> productos</b> en stock<span id="actualizado"></span></span>`;
  contar($("nProd"), PRODUCTS.length);
  frasesMascota();
  fetch("meta.json", {cache: "no-cache"}).then(r=>r.ok ? r.json() : null).then(m=>{
    if (!m || !m.actualizado) return;
    const f = new Date(m.actualizado), hoy = new Date();
    const dia = new Intl.DateTimeFormat("es-EC", {timeZone: CONFIG.tz, dateStyle: "short"});
    const hora = new Intl.DateTimeFormat("es-EC", {timeZone: CONFIG.tz, hour: "2-digit", minute: "2-digit"}).format(f);
    const cuando = dia.format(f) === dia.format(hoy) ? `hoy a las ${hora}`
      : new Intl.DateTimeFormat("es-EC", {timeZone: CONFIG.tz, day: "numeric", month: "short"}).format(f) + ` a las ${hora}`;
    $("actualizado").textContent = `, actualizado ${cuando}`;
  }).catch(()=>{});
}

// ===== Mundos por consola =====
function pintarMundos(){
  const orden = {consolas: 0, palancas: 1, juegos: 2, accesorios: 3};
  const html = Object.entries(CONFIG.mundos).map(([m, cfg])=>{
    const de = PRODUCTS.filter(p=>plataformasDe(p).includes(m));
    if (!de.length) return "";
    const porCat = new Map();
    for (const p of de) porCat.set(p.cat_label || p.cat, (porCat.get(p.cat_label || p.cat) || 0) + 1);
    // Fotos: primero consolas y palancas (lo que más identifica a cada marca).
    const fotos = de.filter(p=>p.photos.length).sort((a, b)=>(orden[a.cat] ?? 9) - (orden[b.cat] ?? 9)).slice(0, 3);
    const cuenta = (n, c) => `${n} ${esc((n === 1 ? c.replace(/s$/i, "") : c).toLowerCase())}`;
    return `<button class="mundo" type="button" data-ir-plat="${esc(m)}" style="--c:${cfg.c};--c2:${cfg.c2}">
      <span class="mundo-cab"><strong>${esc(m)}</strong><span class="n">${de.length} productos</span></span>
      <span class="desglose">${[...porCat].sort((a, b)=>b[1] - a[1]).map(([c, n])=>`<span>${cuenta(n, c)}</span>`).join("")}</span>
      ${fotos.length === 3 ? `<span class="fan" aria-hidden="true">${fotos.map(p=>`<span><img src="${esc(fotoMini(p.photos[0]))}" alt="" width="200" height="200" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></span>`).join("")}</span>` : "<span></span>"}
      <span class="ir" aria-hidden="true"><svg class="ico"><use href="#i-arrow"/></svg></span>
      <span class="emblema${m === "Nintendo" ? " ancho" : ""}" aria-hidden="true"><span class="emblema-in"><span class="emblema-gira">${
        Array.from({length: 12}, (_, k)=>`<svg style="--z:${k}"><use href="#${cfg.logo}"/></svg>`).join("")}</span></span></span>
    </button>`;
  }).join("");
  $("mundos").innerHTML = html;
  $("secMundos").hidden = !html;
}
// Encabezado del mundo en el catálogo, conteos de categorías según la consola elegida y menú marcado.
function pintarMundoActual(){
  const m = mundoActual(), cfg = m && CONFIG.mundos[m];
  document.querySelectorAll(".nav a[data-ir-plat]").forEach(a=>a.setAttribute("aria-current", a.dataset.irPlat === m));
  if (!cfg){ $("mundoBanner").hidden = true; }
  else {
    const n = PRODUCTS.filter(p=>plataformasDe(p).includes(m)).length;
    const subs = cfg.subs.filter(s=>PRODUCTS.some(p=>plataformasDe(p).includes(s)));
    $("mundoBanner").style.setProperty("--c", cfg.c);
    $("mundoBanner").style.setProperty("--c2", cfg.c2);
    $("mundoBanner").innerHTML = `<svg class="banner-logo${m === "Nintendo" ? " ancho" : ""}" aria-hidden="true"><use href="#${cfg.logo}"/></svg><div><h3>Mundo ${esc(m)}</h3><p>${n} productos. ${esc(cfg.frase)}</p></div>
      <div class="mundo-subs" role="group" aria-label="Consola">
        ${subs.length ? `<button type="button" data-ir-plat="${esc(m)}" aria-pressed="${S.plat === m}">Todo ${esc(m)}</button>` +
          subs.map(s=>`<button type="button" data-ir-plat="${esc(s)}" aria-pressed="${S.plat === s}">${esc(s)}</button>`).join("") : ""}
        <button type="button" class="salir" data-ir-plat="all">Ver todas las consolas ×</button>
      </div>`;
    $("mundoBanner").hidden = false;
  }
  // Los números de cada categoría se ajustan a la consola elegida.
  const base = PRODUCTS.filter(p=>S.plat === "all" || plataformasDe(p).includes(S.plat));
  document.querySelectorAll(".chip").forEach(c=>{
    const n = c.dataset.cat === "all" ? base.length : base.filter(p=>p.cat === c.dataset.cat).length;
    const s = c.querySelector("small"); if (s) s.textContent = n;
  });
  moverIndicador();   // los números cambian el ancho de las categorías
}

// ===== Portada: vitrina de fotos que corren y líneas de fondo =====
function pintarVitrina(){
  // Primero lo que más se vende y tiene foto; si hay pocas fotos, se completa con el resto.
  let items = PRODUCTS.filter(p=>p.photos.length && maxQty(p) > 0).slice(0, 24);
  if (items.length < 12) items = items.concat(PRODUCTS.filter(p=>!p.photos.length && maxQty(p) > 0).slice(0, 12 - items.length));
  if (items.length < 6) { $("vitrina").hidden = true; return; }
  const cols = [[], [], []];
  items.forEach((p, i)=>cols[i % 3].push(p));
  const precioTxt = p => fmt(precio(p, "efectivo"));
  // La copia (para el giro sin fin) no se enfoca ni se lee: el teclado recorre solo la primera vuelta.
  const tile = (p, copia, i) => copia
    ? `<div class="stream-item" data-code="${esc(p.code)}" aria-hidden="true"><img src="${esc(fotoDe(p))}" alt="" width="300" height="375" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"><span class="pr">${precioTxt(p)}</span></div>`
    : `<button class="stream-item" type="button" data-code="${esc(p.code)}"><img src="${esc(fotoDe(p))}" alt="" width="300" height="375" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"><span class="sr">${esc(p.name)}, </span><span class="pr">${precioTxt(p)}</span></button>`;
  $("stream").innerHTML = cols.map(c=>`<div class="stream-col"><div class="stream-track">${c.map((p,i)=>tile(p, false, i)).join("")}${c.map(p=>tile(p, true)).join("")}</div></div>`).join("");
}
function dibujarLineas(){
  let h = "";
  for (let k = 0; k < 10; k++){
    const i = Math.round(k * 1.6), a = i * 5, b = i * 6;
    h += `<path pathLength="1" style="--i:${i}" stroke-width="${(0.5 + i * 0.03).toFixed(2)}" stroke-opacity="${(0.1 + i * 0.03).toFixed(2)}" d="M-${380 - a} -${189 + b}C-${380 - a} -${189 + b} -${312 - a} ${216 - b} ${152 - a} ${343 - b}C${616 - a} ${470 - b} ${684 - a} ${875 - b} ${684 - a} ${875 - b}"/>`;
  }
  $("paths").innerHTML = h;
}
dibujarLineas();
// Todo lo que se mueve en la portada se detiene cuando no se ve o si la persona lo pausa.
if ("IntersectionObserver" in window)
  new IntersectionObserver(([e])=>{
    $("hero").classList.toggle("quieto", !e.isIntersecting);
    document.body.classList.toggle("pasado-hero", !e.isIntersecting);   // muestra el WhatsApp flotante en celular
  }).observe($("hero"));
{
  let quieto = 0;
  addEventListener("scroll", ()=>{
    const hero = $("hero");
    if (hero.classList.contains("quieto")) return;
    if (!quieto) hero.classList.add("moviendo");
    clearTimeout(quieto);
    quieto = setTimeout(()=>{ quieto = 0; hero.classList.remove("moviendo"); }, 200);
  }, {passive: true});
}
$("streamPausa").onclick = ()=>{
  const pausa = $("hero").classList.toggle("pausa");
  $("streamPausa").setAttribute("aria-pressed", pausa);
  $("streamPausa").innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${pausa ? "i-play" : "i-pause"}"/></svg><span>${pausa ? "Reanudar" : "Pausar"}</span>`;
};

// Brillo que sigue al mouse en tarjetas y categorías.
if (matchMedia("(hover: hover) and (pointer: fine)").matches){
  let cuadro = 0;
  document.addEventListener("pointermove", e=>{
    const el = e.target.closest?.(".card, .tile, .mundo, .opinion"); if (!el) return;
    cancelAnimationFrame(cuadro);
    cuadro = requestAnimationFrame(()=>{
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      el.style.setProperty("--ty", `${((x / r.width) - 0.5) * 7}deg`);
      el.style.setProperty("--tx", `${(0.5 - y / r.height) * 7}deg`);
      el.style.setProperty("--nx", (x / r.width - 0.5).toFixed(3));
      el.style.setProperty("--ny", (y / r.height - 0.5).toFixed(3));
    });
  }, {passive: true});
  // Al salir de la tarjeta vuelve a quedar derecha.
  document.addEventListener("pointerout", e=>{
    const el = e.target.closest?.(".card, .tile, .mundo, .opinion");
    if (!el || el.contains(e.relatedTarget)) return;
    el.style.setProperty("--tx", "0deg");
    el.style.setProperty("--ty", "0deg");
    el.style.setProperty("--nx", "0");
    el.style.setProperty("--ny", "0");
  }, {passive: true});
}

// Datos para Google: lista de productos con foto, precio y disponibilidad.
function datosEstructurados(){
  const base = new URL("./", location.href).href;
  const items = PRODUCTS.filter(p=>p.photos.length).slice(0, 60).map((p, i)=>({
    "@type": "ListItem", position: i + 1,
    item: {"@type": "Product", name: p.name, sku: p.code, category: p.cat_label, image: new URL(p.photos[0], base).href,
      url: paginaDe(p),
      offers: {"@type": "Offer", price: precio(p, "efectivo").toFixed(2), priceCurrency: "USD",
        availability: maxQty(p) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"}}
  }));
  if (!items.length) return;
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify({"@context": "https://schema.org", "@type": "ItemList", name: `Catálogo ${CONFIG.storeName}`, itemListElement: items});
  document.head.appendChild(s);
}

// ===== Catálogo =====
function listaFiltrada(){
  const q = S.q.trim();
  let list = PRODUCTS.filter(p =>
    (S.cat === "all" || p.cat === S.cat) &&
    (S.plat === "all" || plataformasDe(p).includes(S.plat)) &&
    (!S.only || hasStock(p)) &&
    (S.estado === "all" || (S.estado === "medio-uso" ? p.estado === "medio-uso" : p.origen === S.estado)) &&
    (S.precio === "all" || (S.precio === "mas300" ? precio(p, "efectivo") > 300 : precio(p, "efectivo") <= Number(S.precio))) &&
    (!q || coincide(p, q))
  );
  if ((S.sort === "rel" || S.sort === "dest") && q) list = porRelevancia(list, q);
  else if (S.sort === "dest") list = conFotoPrimero(list);
  if (S.sort === "asc") list = [...list].sort((a,b)=>a.price-b.price);
  if (S.sort === "desc") list = [...list].sort((a,b)=>b.price-a.price);
  if (S.sort === "nuevo") list = [...list].sort((a,b)=>(b.nuevo === true) - (a.nuevo === true));
  return list;
}
function hayFiltros(){ return S.cat !== "all" || S.plat !== "all" || S.local !== "all" || S.estado !== "all" || S.precio !== "all" || S.only || S.q.trim() !== ""; }
function render(){
  const list = listaFiltrada();
  $("count").textContent = `${list.length} producto${list.length === 1 ? "" : "s"}`;
  $("limpiar").hidden = !hayFiltros();
  const vis = list.slice(0, S.visibles);
  $("grid").innerHTML = vis.length ? vis.map(p=>cardHTML(p)).join("") :
    `<div class="empty" role="listitem"><img class="mascota-mini" src="mascota/mascota-chica.webp" alt="" width="243" height="360" loading="lazy" decoding="async"><strong>No encontramos productos con esos filtros.</strong>Prueba con otra palabra o quita los filtros.
      <div class="atajos">${CONFIG.atajos.map(t=>`<button type="button" data-atajo="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      ${S.q.trim() ? `<span class="pidelo-txt">¿No lo encuentras? Te decimos si lo tenemos o si nos llega.</span>${pideloHTML(S.q.trim())}${avisameHTML(S.q.trim())}<br>` : ""}
      <button type="button" data-reset>Ver todo el catálogo</button></div>`;
  if (S.animar !== undefined && !reduceMotion())
    [...$("grid").children].forEach((c, i)=>{ if (i >= S.animar && c.classList.contains("card")) { c.classList.add("aparece"); c.style.setProperty("--i", Math.min(i - S.animar, 12)); } });
  delete S.animar;
  // La primera vez los productos entran en 3D al llegar a ellos; después, lo que ya se ve queda quieto.
  ENTRADA?.observar([...$("grid").querySelectorAll(".card")], render.pintado);
  render.pintado = true;
  if (!list.length && S.q.trim()) medirSinResultados(S.q.trim());
  pintarMundoActual();
  $("more").hidden = vis.length >= list.length;
  escribirURL();
}
function sincronizarControles(){
  $("q").value = S.q; $("plat").value = S.plat; $("local").value = S.local; $("sort").value = S.sort; $("onlyStock").checked = S.only;
  $("estado").value = S.estado; $("precio").value = S.precio;
  document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", c.dataset.cat === S.cat));
  moverIndicador();
  // Solo desliza la fila de categorías; scrollIntoView movía toda la página al abrirla.
  const fila = $("chips"), chip = fila.querySelector(`.chip[aria-pressed="true"]`);
  if (chip) {
    const a = chip.getBoundingClientRect(), b = fila.getBoundingClientRect();
    if (a.left < b.left) fila.scrollLeft += a.left - b.left - 8;
    else if (a.right > b.right) fila.scrollLeft += a.right - b.right + 8;
  }
}
function aplicarFiltro(cambios, ir = true){
  Object.assign(S, cambios, {visibles: CONFIG.porPagina, animar: 0});
  sincronizarControles();
  render();
  if ($("dlg").open) $("dlg").close();
  if ($("menu").open) $("menu").close();
  if (ir) $("catalogo").scrollIntoView({behavior: reduceMotion() ? "auto" : "smooth"});
}
function resetAll(){ aplicarFiltro({cat: "all", q: "", plat: "all", local: "all", estado: "all", precio: "all", sort: "dest", only: false}, false); }

// Solo cambia el botón de los productos cuyo número en el pedido cambió (no se redibuja nada más).
function refrescarControles(){
  document.querySelectorAll(".card[data-code], .chat-prod[data-code], .cmp-add[data-code]").forEach(card=>{
    const p = buscar(card.dataset.code); if (!p) return;
    const box = card.querySelector(".card-add"), q = String(PEDIDO.items.get(p.code) || 0);
    if (box.dataset.q === q) return;
    const teniaFoco = box.contains(document.activeElement);
    box.dataset.q = q;
    box.innerHTML = controlTarjeta(p);
    if (teniaFoco) box.querySelector("button").focus();
  });
}

// El filtro, la búsqueda y el producto abierto viven en la dirección: se pueden compartir.
function leerURL(){
  const u = new URLSearchParams(location.search);
  if (PRODUCTS.some(p=>p.cat === u.get("cat"))) S.cat = u.get("cat");
  if (u.get("q")) S.q = u.get("q");
  if (CONFIG.plataformas.some(([n])=>n === u.get("plat"))) S.plat = u.get("plat");
  if (CONFIG.locales[u.get("local")]) S.local = u.get("local");
  if (["original", "generico", "medio-uso"].includes(u.get("estado"))) S.estado = u.get("estado");
  if (["25", "50", "100", "300", "mas300"].includes(u.get("precio"))) S.precio = u.get("precio");
  sincronizarControles();
  return u.get("p");
}
function escribirURL(){
  const u = new URLSearchParams();
  if (S.cat !== "all") u.set("cat", S.cat);
  if (S.q.trim()) u.set("q", S.q.trim());
  if (S.plat !== "all") u.set("plat", S.plat);
  if (S.local !== "all") u.set("local", S.local);
  if (S.estado !== "all") u.set("estado", S.estado);
  if (S.precio !== "all") u.set("precio", S.precio);
  if ($("dlg").open && D) u.set("p", D.p.code);
  const s = u.toString();
  history.replaceState(null, "", s ? "?" + s : location.pathname);
}

// ===== Carruseles =====
function actualizarFlechas(nav){
  const rail = $(nav.dataset.rail); if (!rail) return;
  const [prev, next] = nav.querySelectorAll("button");
  prev.disabled = rail.scrollLeft <= 4;
  next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
}
document.querySelectorAll(".rail-nav").forEach(nav=>{
  const rail = $(nav.dataset.rail);
  nav.addEventListener("click", e=>{
    const b = e.target.closest("[data-dir]"); if (!b) return;
    const max = rail.scrollWidth - rail.clientWidth, antes = rail.scrollLeft;
    const destino = Math.max(0, Math.min(max, antes + Number(b.dataset.dir) * rail.clientWidth * 0.85));
    if (reduceMotion()) { rail.scrollLeft = destino; actualizarFlechas(nav); return; }
    rail.scrollTo({left: destino, behavior: "smooth"});
    // Si el navegador no anima (pestaña en segundo plano, ahorro de energía), salta directo.
    setTimeout(()=>{ if (Math.abs(rail.scrollLeft - antes) < 1) rail.scrollLeft = destino; actualizarFlechas(nav); }, 450);
  });
  rail.addEventListener("scroll", ()=>actualizarFlechas(nav), {passive: true});
});
addEventListener("resize", ()=>document.querySelectorAll(".rail-nav").forEach(actualizarFlechas), {passive: true});

// ===== Ficha =====
// Abre la ficha haciendo que la foto de la tarjeta "vuele" hasta su lugar en la ficha
// (View Transitions). Sin soporte o con "reducir movimiento", se abre como siempre.
function abrirProducto(code, origen){
  if (!document.startViewTransition || reduceMotion() || !origen || document.visibilityState !== "visible") { openProduct(code); return; }
  origen.style.viewTransitionName = "foto-producto";
  document.documentElement.classList.add("vt-ficha");
  const vt = document.startViewTransition(()=>{
    origen.style.viewTransitionName = "";
    openProduct(code);
    $("dMain").style.viewTransitionName = "foto-producto";
  });
  vt.ready.catch(()=>{});   // si el navegador salta la animación, la ficha igual queda abierta
  vt.finished.finally(()=>{
    $("dMain").style.viewTransitionName = "";
    origen.style.viewTransitionName = "";
    document.documentElement.classList.remove("vt-ficha");
  });
}

// Al tocar +, una miniatura del producto vuela en arco hasta el botón del pedido.
// Devuelve cuánto tarda, para que el contador rebote justo al llegar.
function volarAlPedido(origen){
  if (!origen || reduceMotion() || !origen.animate) return 0;
  const img = origen.querySelector("img"); if (!img) return 0;
  const r0 = origen.getBoundingClientRect(), r1 = $("cartBtn").getBoundingClientRect();
  if (!r0.width || !r1.width) return 0;
  const clon = document.createElement("div");
  clon.className = "vuelo";
  clon.style.cssText = `left:${r0.left}px;top:${r0.top}px;width:${r0.width}px;height:${r0.height}px`;
  clon.innerHTML = `<img src="${esc(img.currentSrc || img.src)}" alt="">`;
  document.body.appendChild(clon);
  const dx = r1.left + r1.width / 2 - (r0.left + r0.width / 2), dy = r1.top + r1.height / 2 - (r0.top + r0.height / 2);
  const s = 34 / r0.width, dur = 650;
  clon.animate([
    {transform: "translate(0,0) scale(1)", opacity: 1},
    {transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.5},
    {transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2}
  ], {duration: dur, easing: "cubic-bezier(.45,0,.25,1)"}).finished.then(()=>clon.remove(), ()=>clon.remove());
  setTimeout(()=>clon.remove(), dur + 400);   // por si la pestaña se va a segundo plano a mitad del vuelo
  return dur - 60;
}

function openProduct(code){
  const p = buscar(code);
  $("dMigaCat").textContent = p.cat_label || "";
  $("dMigaCat").dataset.cat = p.cat;
  $("dName").textContent = p.name;
  $("dCode").textContent = `Código ${p.code}`;
  const efectivo = p.price_efectivo ?? p.price, tarjeta = p.price_tarjeta ?? p.price;
  $("dPrice").innerHTML = `<div class="price-row">${money(efectivo, true)}<span class="price-tag">Efectivo o transferencia, IVA incluido</span>${tarjeta > efectivo ? `<span class="price-tag">Con tarjeta: <b>$${tarjeta.toFixed(2)}</b></span>` : ""}</div>`;
  const ahorro = ahorroDe(p), chips = etiquetaPlat(p);
  $("dDetalles").innerHTML =
    (ahorro >= 1 ? `<p class="ahorro-banner"><svg class="ico" aria-hidden="true"><use href="#i-card"/></svg><span>Pagando en <b>efectivo o transferencia</b> ahorras <b>${fmt(ahorro)}</b></span></p>` : "")
    + (chips ? `<div class="det-chips">${chips}</div>` : "")
    + (p.incluye?.length ? `<div class="incluye"><span class="lbl-sec">Incluye</span><ul>${p.incluye.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
  // La de Contífico si existe; si no, la de descripciones.py (sin el "Incluye…", que ya va en la lista).
  const desc = (p.desc || (p.incluye?.length ? (p.desc_auto || "").replace(/\s*Incluye [^.]*\./, "") : p.desc_auto) || "").trim();
  $("dDesc").textContent = desc;
  $("dDesc").hidden = !desc;

  const fotos = p.photos.length ? p.photos : [placeholder(p, 0)];
  const show = v => {
    // Celular de alta resolución: el navegador toma la copia de 2000 px (se ve nítida al acercar).
    const grande = p.photos.length ? ` srcset="${esc(fotos[v])} 1000w, ${esc(fotoZoom(fotos[v]))} 2000w" sizes="(max-width: 700px) 94vw, 450px"` : "";
    $("dMain").innerHTML = `<img src="${esc(fotos[v])}"${grande} alt="${esc(p.name)}, foto ${v+1}" width="500" height="500" data-code="${esc(p.code)}" data-i="${v}" onerror="onPhotoError(this)">`;
    $("dMain").dataset.v = v;
    $("dThumbs").querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-current", i === v));
    $("dMain").classList.toggle("zoomable", p.photos.length > 0);
    $("dMain").classList.remove("zoom");
  };
  $("dThumbs").hidden = fotos.length < 2;
  $("dThumbs").innerHTML = fotos.map((src,v)=>`<button type="button" aria-label="Foto ${v+1}"><img src="${esc(fotoMini(src))}" alt="" width="64" height="64" data-code="${esc(p.code)}" data-i="${v}" onerror="onPhotoError(this)"></button>`).join("");
  $("dThumbs").querySelectorAll("button").forEach((b,i)=>b.onclick = ()=>show(i));
  show(0);

  if (p.digital){
    $("dLocales").hidden = true; $("dNote").hidden = false;
    $("dNote").textContent = "Código digital: se entrega por WhatsApp tras confirmar el pago.";
  } else {
    $("dLocales").hidden = false; $("dNote").hidden = true;
    $("dLocales").innerHTML = Object.entries(CONFIG.locales).map(([k,L])=>{
      const n = p.stock[k], cls = !n ? "out" : n <= CONFIG.lowStockAt ? "low" : "ok";
      return `<li><span>${L.nombre}<small>${L.zona}, ${L.detalle}</small></span><span class="stock ${cls}"><span class="dot"></span>${disponibles(n)}</span></li>`;
    }).join("");
  }

  const plats = plataformasDe(p);
  const rel = PRODUCTS.filter(x=>x !== p && x.cat === p.cat && (!plats.length || plataformasDe(x).some(n=>plats.includes(n))))
    .concat(PRODUCTS.filter(x=>x !== p && x.cat !== p.cat && plats.length && plataformasDe(x).some(n=>plats.includes(n))))
    .slice(0, 10);
  $("dRelWrap").hidden = !rel.length;
  $("dRel").innerHTML = rel.map(x=>cardHTML(x)).join("");
  $("dShareTxt").textContent = "Compartir";

  D = {p, q: 1, agregado: false, wcodigo: nuevoCodigo()};
  $("dFav").dataset.fav = p.code;
  $("dFav").setAttribute("aria-pressed", FAVS.has(p.code));
  $("dFavTxt").textContent = FAVS.has(p.code) ? "Guardado" : "Guardar";
  registrarVisto(p.code);
  medir("ver-producto", {codigo: p.code, nombre: p.name.slice(0, 60)});
  pintarCompra();
  if (!$("dlg").open) $("dlg").showModal();
  // La foto entra girando en 3D (salvo si llega volando desde la tarjeta: ese ya es su movimiento).
  if (!reduceMotion() && !document.documentElement.classList.contains("vt-ficha"))
    $("dMain").animate?.([{transform: "perspective(900px) rotateY(-32deg) rotateX(8deg) scale(.9)", opacity: 0.25}, {transform: "perspective(900px)", opacity: 1}],
      {duration: 750, easing: "cubic-bezier(.2,.9,.25,1.12)"});
  $("dlg").scrollTop = 0;
  $("dRel").scrollLeft = 0;
  actualizarFlechas(document.querySelector('.rail-nav[data-rail="dRel"]'));
  $("dClose").focus({preventScroll: true});
  escribirURL();
}

// Zoom de la foto en la ficha. Con mouse: se amplía donde apunta. En celular: tocar acerca justo
// donde se tocó, arrastrar el dedo recorre la foto y otro toque la aleja.
function origenZoom(x, y){
  const r = $("dMain").getBoundingClientRect(), img = $("dMain").querySelector("img"); if (!img) return;
  const px = Math.min(100, Math.max(0, (x - r.left) / r.width * 100)), py = Math.min(100, Math.max(0, (y - r.top) / r.height * 100));
  img.style.transformOrigin = `${px.toFixed(1)}% ${py.toFixed(1)}%`;
}
$("dMain").addEventListener("pointermove", e=>{
  if (e.pointerType !== "mouse" || !$("dMain").classList.contains("zoomable")) return;
  origenZoom(e.clientX, e.clientY);
  const img = $("dMain").querySelector("img");
  if (img?.srcset && img.sizes !== "2000px") img.sizes = "2000px";   // la lupa usa la copia de 2000 px
  $("dMain").classList.add("zoom");
});
$("dMain").addEventListener("pointerleave", e=>{ if (e.pointerType === "mouse") $("dMain").classList.remove("zoom"); });
$("dMain").addEventListener("click", ()=>{
  if (!$("dMain").classList.contains("zoomable") || !D) return;
  abrirVisor(D.p, Number($("dMain").dataset.v) || 0);
});

// Celular: el reflejo de luz cruza cada foto cuando el producto aparece en pantalla (una vez).
if (matchMedia("(hover: none)").matches && !reduceMotion() && "IntersectionObserver" in window){
  const io = new IntersectionObserver(entradas=>{
    for (const e of entradas) if (e.isIntersecting){ e.target.classList.add("brilla"); io.unobserve(e.target); }
  }, {threshold: 0.6});
  const observar = raiz => raiz.querySelectorAll?.(".card .img:not(.brilla)").forEach(el=>{ if (el.querySelector('img[src^="fotos/"]')) io.observe(el); });
  new MutationObserver(ms=>{ for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) observar(n); })
    .observe(document.body, {childList: true, subtree: true});
  observar(document);
  document.addEventListener("touchstart", ()=>{}, {passive: true});   // activa el efecto al presionar en iPhone
}

// Celular: al inclinar el teléfono, la foto de la ficha se inclina con él y la cruza un brillo (como un objeto real).
if (matchMedia("(hover: none)").matches && !reduceMotion() && "DeviceOrientationEvent" in window){
  let base = null, cuadroF = 0;
  $("dlg").addEventListener("close", ()=>{ base = null; });
  addEventListener("deviceorientation", e=>{
    if (!$("dlg").open || e.gamma == null || $("dMain").classList.contains("zoom")) return;
    if (!base) base = {b: e.beta, g: e.gamma};   // como se tenía el teléfono al abrir = foto derecha
    const rx = Math.max(-12, Math.min(12, (e.beta - base.b) * -0.5)), ry = Math.max(-14, Math.min(14, (e.gamma - base.g) * 0.6));
    cancelAnimationFrame(cuadroF);
    cuadroF = requestAnimationFrame(()=>{
      const m = $("dMain").style;
      m.setProperty("--fx", `${rx.toFixed(1)}deg`); m.setProperty("--fy", `${ry.toFixed(1)}deg`); m.setProperty("--gx", `${(50 + ry * 3).toFixed(0)}%`);
    });
  }, {passive: true});
}

// Diagnóstico: abrir la página con ?diag muestra qué soporta este celular o navegador.
const VERSION = "2026-09-28-chat";
if (new URLSearchParams(location.search).has("diag")){
  const d = document.createElement("pre");
  d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99;margin:0;background:#fff;color:#000;font:12px/1.5 monospace;padding:12px;border-radius:12px;white-space:pre-wrap;box-shadow:0 10px 30px rgba(0,0,0,.5)";
  d.textContent = [
    `Versión de la página: ${VERSION}`,
    `Navegador: ${navigator.userAgent}`,
    `"Reducir animaciones" del celular: ${reduceMotion() ? "ACTIVADO (por eso se apagan los efectos)" : "no"}`,
    `Foto que vuela a la ficha: ${document.startViewTransition ? "sí" : "no (navegador antiguo)"}`,
    `Vitrina 360° y mascota en 3D: ${"WebGL2RenderingContext" in window ? "sí" : "no (sin WebGL 2)"}`,
    `Animaciones con el scroll: ${CSS.supports("animation-timeline: view()") ? "sí" : "no (navegador antiguo)"}`,
    `Pantalla táctil: ${matchMedia("(hover: none)").matches ? "sí" : "no"}`
  ].join("\n");
  document.body.appendChild(d);
}

// ===== Mascota: el muñequito de la tienda da la bienvenida en la portada =====
// En 3D (mascota3d.js): cae de un salto, saluda, hace "pulgar arriba" y se queda bailando; si lo tocan,
// salta y dice algo útil. Sin WebGL 2, con ahorro de datos o con "reducir movimiento", queda el dibujo.
const MASCOTA = {api: null, frases: []};
function decirMascota(texto, ms = 3200){
  const g = $("mascotaGlobo");
  g.textContent = texto;
  g.classList.add("ver");
  clearTimeout(decirMascota.t);
  decirMascota.t = setTimeout(()=>g.classList.remove("ver"), ms);
}
// Frases con datos reales de la tienda (la primera la dice al dar la bienvenida).
function frasesMascota(){
  const locales = Object.values(CONFIG.locales).map(l=>l.nombre.replace(/ Shopping$/, ""));
  const lista = [
    PRODUCTS.length ? `Tenemos ${PRODUCTS.length} productos listos para ti` : "",
    "¡Pagando en efectivo o transferencia ahorras!",
    locales.length > 1 ? `Retira en ${locales.slice(0, -1).join(", ")} o ${locales.at(-1)}` : "",
    "Arma tu pedido y envíalo por WhatsApp",
    "¿Buscas algo? Usa la lupa de arriba",
    "¡Qué chévere tenerte por aquí!",
  ].filter(Boolean);
  MASCOTA.frases.splice(0, MASCOTA.frases.length, ...lista);
}
// Espera a que termine la intro de la marca (primera visita) para que el salto se vea.
function trasLaIntro(fn){
  const html = document.documentElement;
  if (!html.classList.contains("con-intro")) return fn();
  const mo = new MutationObserver(()=>{ if (!html.classList.contains("con-intro")){ mo.disconnect(); setTimeout(fn, 150); } });
  mo.observe(html, {attributes: true, attributeFilter: ["class"]});
}
{
  // En celular va en su franja arriba del titular; en computadora, frente a la vitrina.
  const mq = matchMedia("(max-width: 960px)");
  // Solo se mueve si no está ya en su lugar: moverlo de nuevo lo vuelve a dibujar (y la página tarda más en "estar lista").
  const ubicar = () => {
    const m = $("mascota"), destino = mq.matches ? $("mascotaMovil") : $("vitrina");
    if (m.parentNode === destino) return;
    if (mq.matches) destino.append(m); else destino.insertBefore(m, destino.querySelector(".vitrina-acc"));
  };
  ubicar();
  mq.addEventListener?.("change", ubicar);
}
// Modo fiesta (sorpresa): luces de colores en la portada y papelitos que salen del muñequito.
function fiestaMascota(){
  medir("mascota-fiesta");
  const hero = $("hero");
  hero.classList.remove("fiesta"); void hero.offsetWidth; hero.classList.add("fiesta");
  clearTimeout(fiestaMascota.t);
  fiestaMascota.t = setTimeout(()=>hero.classList.remove("fiesta"), 6200);
  if (reduceMotion()) return;
  confeti($("mascota"));
  setTimeout(()=>confeti($("mascota")), 900);
  setTimeout(()=>confeti($("mascota")), 1800);
}
function mascotaPlana(){
  const img = $("mascotaPlana");
  $("mascota").classList.add("plana");
  img.hidden = false;
  let i = 0, toques = [];
  img.onclick = ()=>{
    img.classList.remove("salta"); void img.offsetWidth; img.classList.add("salta");
    const ahora = Date.now(); toques = toques.filter(t=>ahora - t < 3000); toques.push(ahora);
    if (toques.length >= 5){ toques = []; decirMascota("¡Modo fiesta activado!", 3400); fiestaMascota(); return; }
    if (MASCOTA.frases.length) decirMascota(MASCOTA.frases[i++ % MASCOTA.frases.length], 3000);
  };
  // La entrada (cae de arriba) solo va tapada por la intro de marca; si no hay intro, ya está a la vista desde el inicio.
  const conIntro = document.documentElement.classList.contains("con-intro");
  trasLaIntro(()=>{
    if (conIntro) img.classList.add("entra");
    document.documentElement.classList.remove("mascota-espera");
    setTimeout(()=>decirMascota("¡Hola! Bienvenidos a Electronic Games", 3600), reduceMotion() ? 0 : 800);
  });
}
async function cargarMascota(){
  // En el modo vitrina de las pantallas de los locales la portada queda tapada todo el día: ahí no se carga.
  if (new URLSearchParams(location.search).has("vitrina")) return;
  const puede = "WebGL2RenderingContext" in window && "ResizeObserver" in window && "IntersectionObserver" in window && !navigator.connection?.saveData && !reduceMotion();
  // Primero el dibujo (saluda igual); con la primera interacción se cambia por el 3D, que sigue bailando.
  mascotaPlana();
  if (!puede){ $("mascotaCanvas").hidden = true; return; }
  alInteractuar(async ()=>{
    try {
      const {iniciar} = await import(`./mascota3d.js?v=${VERSION}`);
      const caja = $("mascota");
      // Cuando el 3D ya está dibujado (clase "listo") se quita el dibujo plano: el cambio no se nota.
      const mo = new MutationObserver(()=>{ if (caja.classList.contains("listo")){ mo.disconnect(); $("mascotaPlana").hidden = true; caja.classList.remove("plana"); } });
      mo.observe(caja, {attributes: true, attributeFilter: ["class"]});
      MASCOTA.api = iniciar({
        contenedor: caja, lienzo: $("mascotaCanvas"), frases: MASCOTA.frases, bienvenida: false,
        alDecir: decirMascota, alTocar: ()=>medir("mascota"), alFiesta: fiestaMascota
      });
      trasLaIntro(()=>MASCOTA.api.empezar());
      new MutationObserver(()=>MASCOTA.api.pausar(!!document.querySelector("dialog[open]")))
        .observe(document.body, {subtree: true, attributes: true, attributeFilter: ["open"]});
    } catch (e){
      console.warn("Mascota 3D no disponible:", e);
      $("mascotaCanvas").hidden = true;
    }
  });
}
cargarMascota();

// ===== Mis pedidos: los que se enviaron por WhatsApp desde este dispositivo =====
// Para volver a pedir lo mismo o preguntar por WhatsApp cómo va un pedido (con su código).
const CLAVE_PEDIDOS = "eg_pedidos_v1";
function leerPedidos(){
  try { const v = JSON.parse(localStorage.getItem(CLAVE_PEDIDOS) || "[]"); return Array.isArray(v) ? v.filter(x => x && x.codigo && Array.isArray(x.items)) : []; }
  catch(e) { return []; }
}
function guardarEnHistorial(){
  const ls = lineas(); if (!ls.length || !PEDIDO.codigo) return;
  const h = leerPedidos().filter(x => x.codigo !== PEDIDO.codigo);
  h.unshift({codigo: PEDIDO.codigo, fecha: Date.now(), items: ls.map(({p, q}) => [p.code, q, p.name]), total: totalPedido(), retiro: PEDIDO.retiro, pago: PEDIDO.pago});
  try { localStorage.setItem(CLAVE_PEDIDOS, JSON.stringify(h.slice(0, 10))); } catch(e) {}
  pintarPedidosN();
}
const fechaCorta = t => new Intl.DateTimeFormat("es-EC", {timeZone: CONFIG.tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(t);
const mensajeEstado = x => `Hola ${CONFIG.storeName}, quería saber cómo va mi pedido ${x.codigo} (enviado el ${fechaCorta(x.fecha)}).`;
function pedidoHTML(x){
  const L = CONFIG.locales[x.retiro];
  return `<article class="pedido-h">
    <div class="pedido-h-cab"><b>Pedido ${esc(x.codigo)}</b><span>${esc(fechaCorta(x.fecha))}${L ? " · " + esc(corto(L.nombre)) : ""}</span></div>
    <ul>${x.items.map(([c, q, n]) => `<li>${Number(q) || 1} × ${esc(buscar(c)?.name || n || c)}</li>`).join("")}</ul>
    <div class="pedido-h-pie"><b>${fmt(Number(x.total) || 0)}</b>
      <a class="wa-btn" href="${esc(waLink(mensajeEstado(x)))}" target="_blank" rel="noopener" data-tipo="estado-pedido"><svg aria-hidden="true"><use href="#i-wa"/></svg>¿Cómo va?</a>
      <button type="button" class="add-btn" data-repetir="${esc(x.codigo)}">Volver a pedir</button>
    </div>
  </article>`;
}
function pintarPedidosN(){ const n = leerPedidos().length; $("menuPedN").textContent = n ? ` (${n})` : ""; }
function pintarPedidos(){
  const ls = leerPedidos();
  $("pedidosLista").innerHTML = ls.length ? ls.map(pedidoHTML).join("")
    : `<div class="vacio"><img class="mascota-mini" src="mascota/mascota-chica.webp" alt="" width="243" height="360" loading="lazy" decoding="async">Aún no envías pedidos desde este dispositivo.<br>Cuando envíes uno por WhatsApp, lo verás aquí.</div>`;
}
function abrirPedidos(){
  for (const d of ["dlg", "menu", "cart", "cmdk", "favs"]) if ($(d).open) $(d).close();
  pintarPedidos();
  $("pedidos").showModal();
}
// Vuelve a poner en el pedido lo de un pedido anterior (lo que siga disponible).
function repetirPedido(codigo){
  const x = leerPedidos().find(y => y.codigo === codigo);
  if (!x) return null;
  const puestos = [], faltan = [];
  for (const [c, q, n] of x.items){
    const p = buscar(c), max = p ? maxQty(p) : 0;
    if (!max){ faltan.push(n || c); continue; }
    setCantidad(p.code, Math.max(PEDIDO.items.get(p.code) || 0, Math.min(q, max)));
    puestos.push(p);
  }
  if (CONFIG.locales[x.retiro]) PEDIDO.retiro = x.retiro;
  guardarPedido(); actualizarPedido();
  medir("repetir-pedido", {puestos: puestos.length, faltan: faltan.length});
  return {puestos, faltan};
}
$("pedidosClose").onclick = () => $("pedidos").close();
$("pedidos").addEventListener("click", e => { if (e.target === $("pedidos")) $("pedidos").close(); });
pintarPedidosN();

// ===== "Avísame cuando llegue": se guarda lo que alguien buscó y no había; cuando vuelve y ya llegó, el muñequito le avisa =====
// (en este dispositivo, sin cuentas ni servidor). Con código: un producto agotado; con palabras: una búsqueda sin resultados.
const CLAVE_AVISOS = "eg_avisos_v1";
function leerAvisos(){
  try { const v = JSON.parse(localStorage.getItem(CLAVE_AVISOS) || "[]");
    return Array.isArray(v) ? v.filter(a => a && (a.q || a.codigo) && Date.now() - (a.t || 0) < 60 * 86400000) : []; }
  catch(e) { return []; }
}
function guardarAvisos(ls){ try { localStorage.setItem(CLAVE_AVISOS, JSON.stringify(ls.slice(0, 15))); } catch(e) {} }
const hayAhora = a => a.codigo ? [buscar(a.codigo)].filter(p => p && maxQty(p) > 0) : PRODUCTS.filter(p => maxQty(p) > 0 && coincide(p, a.q));
function guardarAviso(a){
  a = a.codigo ? {codigo: String(a.codigo)} : {q: String(a.q || "").trim().slice(0, 60)};
  if (!a.codigo && !a.q) return;
  a.t = Date.now();
  a.habia = hayAhora(a).map(p => p.code);   // lo que ya había (en otra categoría, por ejemplo) no cuenta como "llegó"
  guardarAvisos([a, ...leerAvisos().filter(x => a.codigo ? x.codigo !== a.codigo : norm(x.q || "") !== norm(a.q))]);
  medir("avisame", {q: (a.q || a.codigo).slice(0, 60)});
}
let LLEGO = null;
function revisarAvisos(){
  const ls = leerAvisos();
  if (!ls.length || !PRODUCTS.length) return;
  LLEGO = ls.map(a => ({a, ps: hayAhora(a).filter(p => !(a.habia || []).includes(p.code))})).find(x => x.ps.length) || null;
  if (!LLEGO) return;
  guardarAvisos(ls.filter(a => a !== LLEGO.a));
  const mostrar = () => {
    if (document.querySelector("dialog[open]") || document.body.matches(".en-anillo, .en-portal") || !$("ayudante").hidden){ setTimeout(mostrar, 5000); return; }
    try { sessionStorage.setItem("eg_ayudante", "1"); } catch(e) {}   // hoy no sale también el "¿te ayudo?"
    $("chatBoton").hidden = true;
    const [p] = LLEGO.ps;
    $("llegoTxt").textContent = LLEGO.ps.length === 1 ? `${p.name.slice(0, 70)} ya está en la tienda →` : `«${LLEGO.a.q}»: ${LLEGO.ps.length} productos →`;
    const el = $("llego");
    el.hidden = false; el.classList.add("entra");
    medir("avisame-llego", {q: (LLEGO.a.q || LLEGO.a.codigo).slice(0, 60)});
  };
  mostrar();
}
function cerrarLlego(){
  const el = $("llego");
  if (el.hidden) return;
  el.classList.add("sale");
  setTimeout(() => { el.hidden = true; el.classList.remove("entra", "sale"); if (CONFIG.chatMascotaUrl && !VITRINA_URL) $("chatBoton").hidden = false; }, 280);
}
function verLlego(){
  cerrarLlego();
  if (!LLEGO) return;
  if (LLEGO.ps.length === 1) abrirProducto(LLEGO.ps[0].code);
  else aplicarFiltro({q: LLEGO.a.q, cat: "all", plat: "all"});
}
$("llegoVer").onclick = verLlego;
$("llegoCara").onclick = verLlego;
$("llegoCerrar").onclick = cerrarLlego;

// ===== Logros: como en los videojuegos, se desbloquean usando la tienda (solo en este dispositivo) =====
// Se enteran por las mismas mediciones de la página (medir); no se ganan en la vitrina de la tienda.
const CLAVE_LOGROS = "eg_logros_v1";
const LOGROS = [
  {id: "primer-item", ico: "🛒", t: "Primer ítem", d: "Agrega tu primer producto al pedido."},
  {id: "coleccionista", ico: "❤️", t: "Coleccionista", d: "Guarda un producto en favoritos."},
  {id: "curioso", ico: "🔍", t: "Curioso", d: "Mira 10 productos distintos."},
  {id: "explorador", ico: "🌎", t: "Explorador de mundos", d: "Entra a 3 mundos de consolas."},
  {id: "ojo", ico: "🦅", t: "Ojo de halcón", d: "Haz zoom a la foto de un producto."},
  {id: "vitrina", ico: "🔄", t: "Mirada 360°", d: "Abre un producto desde la vitrina 3D."},
  {id: "charla", ico: "💬", t: "Buena charla", d: "Conversa con el muñequito."},
  {id: "decidido", ico: "🎮", t: "Ya sé lo que quiero", d: "Termina el test «¿Qué consola me compro?»."},
  {id: "amigo", ico: "🤝", t: "Buen amigo", d: "Comparte un producto."},
  {id: "fiesta", ico: "🎉", t: "Modo fiesta", d: "Descubre la fiesta secreta del muñequito."},
  {id: "gg", ico: "🏆", t: "¡GG!", d: "Envía tu primer pedido por WhatsApp."},
];
function leerLogros(){
  try { const v = JSON.parse(localStorage.getItem(CLAVE_LOGROS) || "{}");
    return {ok: v.ok && typeof v.ok === "object" ? v.ok : {}, vistos: Array.isArray(v.vistos) ? v.vistos : [], mundos: Array.isArray(v.mundos) ? v.mundos : []}; }
  catch(e) { return {ok: {}, vistos: [], mundos: []}; }
}
function guardarLogros(L){ try { localStorage.setItem(CLAVE_LOGROS, JSON.stringify(L)); } catch(e) {} }
function logroPorEvento(ev, d = {}){
  if (VITRINA_URL || $("kiosco").open) return;
  const L = leerLogros();
  let id = {"agregar-al-pedido": "primer-item", "zoom-foto": "ojo", "vitrina-360": "vitrina", "chat-mensaje": "charla",
    "guia-consola": "decidido", "compartir": "amigo", "mascota-fiesta": "fiesta"}[ev] || null;
  if (ev === "favorito" && d.accion === "guardar") id = "coleccionista";
  if (ev === "whatsapp") id = d.tipo === "pedido" ? "gg" : d.tipo === "compartir" ? "amigo" : null;
  if (ev === "ver-producto" && d.codigo && !L.ok.curioso){
    L.vistos = [...new Set([...L.vistos, d.codigo])].slice(-10); guardarLogros(L);
    if (L.vistos.length >= 10) id = "curioso";
  }
  if (ev === "mundo" && d.plataforma && !L.ok.explorador){
    L.mundos = [...new Set([...L.mundos, d.plataforma])]; guardarLogros(L);
    if (L.mundos.length >= 3) id = "explorador";
  }
  if (id) desbloquear(id);
}
const COLA_LOGROS = [];
function desbloquear(id){
  const L = leerLogros(), l = LOGROS.find(x => x.id === id);
  if (!l || L.ok[id]) return;
  L.ok[id] = Date.now(); guardarLogros(L);
  pintarLogrosN();
  COLA_LOGROS.push(l);
  if (COLA_LOGROS.length === 1) setTimeout(mostrarLogro, 700);
}
function mostrarLogro(){
  const l = COLA_LOGROS[0], el = $("logro");
  if (!l) return;
  el.innerHTML = `<span class="logro-ico" aria-hidden="true">${l.ico}</span><span><small>🏆 Logro desbloqueado</small><b>${esc(l.t)}</b><span class="d">${esc(l.d)}</span></span>`;
  try { el.hidePopover(); } catch(e) {}
  if (el.showPopover){ try { el.showPopover(); } catch(e) {} }
  else el.classList.add("ver");   // sin "popover" (iOS 16 o anterior)
  $("aviso").textContent = `Logro desbloqueado: ${l.t}`;
  try { navigator.vibrate?.([12, 60, 12]); } catch(e) {}
  setTimeout(() => {
    try { el.hidePopover(); } catch(e) {}
    el.classList.remove("ver");
    COLA_LOGROS.shift();
    if (COLA_LOGROS.length) setTimeout(mostrarLogro, 450);
  }, 4200);
}
const logrosHechos = () => { const L = leerLogros(); return LOGROS.filter(l => L.ok[l.id]).length; };
function pintarLogrosN(){ $("menuLogN").textContent = ` (${logrosHechos()}/${LOGROS.length})`; }
function abrirLogros(){
  for (const d of ["dlg", "menu", "cart", "cmdk", "favs", "pedidos"]) if ($(d).open) $(d).close();
  const L = leerLogros(), n = logrosHechos();
  $("logrosCuenta").innerHTML = `<b>${n} de ${LOGROS.length}</b> logros desbloqueados${n === LOGROS.length ? ". ¡Los completaste todos! 🏆" : "."}`;
  $("logrosBarra").style.width = `${Math.round(n / LOGROS.length * 100)}%`;
  $("logrosLista").innerHTML = LOGROS.map(l => `<div class="logro-item${L.ok[l.id] ? "" : " bloqueado"}"><span class="logro-ico" aria-hidden="true">${L.ok[l.id] ? l.ico : "🔒"}</span><b>${esc(l.t)}</b><span>${esc(l.d)}</span></div>`).join("");
  $("logros").showModal();
  medir("logros-abiertos", {n});
}
$("logrosClose").onclick = () => $("logros").close();
$("logros").addEventListener("click", e => { if (e.target === $("logros")) $("logros").close(); });
$("logro").addEventListener("click", () => { try { $("logro").hidePopover(); } catch(e) {} abrirLogros(); });
pintarLogrosN();

// Instalar la página como app: Chrome/Edge/Android avisan que se puede; en iPhone se explica cómo.
let instalador = null;
const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); instalador = e; $("menuInstalar").hidden = false; });
addEventListener("appinstalled", () => { instalador = null; $("menuInstalar").hidden = true; medir("app-instalada"); });
if (esIOS) $("instalarIOS").hidden = false;
async function instalarApp(){
  if (!instalador) return false;
  instalador.prompt();
  const {outcome} = await instalador.userChoice.catch(() => ({}));
  instalador = null; $("menuInstalar").hidden = true;
  return outcome === "accepted";
}

// En la ficha: si alguien se queda un rato mirando un producto, "Preguntar" le hace una seña.
{
  let t = 0;
  new MutationObserver(() => {
    clearTimeout(t);
    const b = $("dChat");
    b.classList.remove("llama"); b.querySelector("span").textContent = "Preguntar";
    if ($("dlg").open && !b.hidden) t = setTimeout(() => {
      if (!$("dlg").open) return;
      b.classList.add("llama"); b.querySelector("span").textContent = "¿Dudas? Pregúntame";
    }, 12000);
  }).observe($("dlg"), {attributes: true, attributeFilter: ["open"]});
}

// ===== Chat con el muñequito (IA) =====
// La página arma en cada mensaje el contexto (hora, locales, pedido, productos relacionados con
// la pregunta) y le dice a la IA qué puede hacer aquí (HERRAMIENTAS_CHAT: agregar al pedido,
// mostrar productos, abrir fichas…). El Worker de Cloudflare solo guarda la clave de Gemini y
// pasa la respuesta en vivo, así que agregar o cambiar algo del chat no obliga a tocar el Worker.
// Sin URL configurada (CONFIG.chatMascotaUrl), el botón de "abrir chat" lleva a WhatsApp.
const CLAVE_CHAT = "eg_chat_v1", CLAVE_CHAT_VOZ = "eg_chat_voz";
const CHAT = {mensajes: [], enviando: false, citados: [], leerProxima: false,
  voz: (()=>{ try { return localStorage.getItem(CLAVE_CHAT_VOZ) === "1"; } catch(e) { return false; } })()};
const enCelular = () => matchMedia("(max-width: 700px)").matches;

// --- Lo que sabe: hora, locales, pedido y los productos que tienen que ver con la pregunta ---
function horarioTexto(){
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const [s0, s1] = CONFIG.horario.semana, [d0, d1] = CONFIG.horario.domingo;
  return `Lunes a sábado de ${hm(s0)} a ${hm(s1)}. Domingo de ${hm(d0)} a ${hm(d1)}.`;
}
function localesTexto(){
  return Object.entries(CONFIG.locales).map(([k, l]) => `[${k}] ${l.nombre} (${l.zona}${l.detalle ? ", " + l.detalle : ""})`).join("; ");
}
function ahoraTexto(){
  const f = new Intl.DateTimeFormat("es-EC", {timeZone: CONFIG.tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(new Date());
  return `Ahora en Ecuador es ${f}. Estado de los locales: ${estadoTienda().txt}.`;
}
function lineaProducto(p, conDesc){
  const efectivo = p.price_efectivo ?? p.price, tarjeta = p.price_tarjeta;
  const precioTxt = tarjeta && tarjeta !== efectivo ? `$${efectivo} (tarjeta $${tarjeta})` : `$${efectivo}`;
  const stockTxt = Object.entries(p.stock || {}).filter(([, v]) => v > 0)
    .map(([k, v]) => `${CONFIG.locales[k]?.nombre || k} ${v}`).join(", ") || (p.digital ? "código digital" : "agotado");
  const extra = [consolaDe(p).txt, p.origen === "original" && "original", p.origen === "generico" && "genérico", p.estado === "medio-uso" && "medio uso",
    p.nuevo && "nuevo", p.top && "top ventas"].filter(Boolean).join(", ");
  const d = (p.desc || (p.incluye?.length ? (p.desc_auto || "").replace(/\s*Incluye [^.]*\./, "") : p.desc_auto) || "").replace(/\s+/g, " ").trim();
  const desc = conDesc && d ? ` | ${d.slice(0, 200)}` : "";
  const incluye = p.incluye?.length ? ` | incluye: ${p.incluye.join(", ")}` : "";
  const sinMarca = /\b(R36|SUP|X9|K10|MINI GAME|GAME ?STICK|PANDORA|ARCADE)\b/i.test(p.name) || p.origen === "generico" ? " | sin marca conocida: di solo lo que dice su nombre, no inventes sus características" : "";
  return `- ${p.name} | código: ${p.code} | ${p.cat_label}${extra ? " | " + extra : ""} | ${precioTxt} | stock: ${stockTxt}${incluye}${desc}${sinMarca}`;
}
const PALABRAS_VACIAS = new Set(("que para con los las una uno unos unas tienen tiene tienes tendran hay quiero queria quisiera busco buscando necesito " +
  "cuanto cuanta cuesta cuestan vale valen precio precios del por algo este ese esa esta estos esos esas estas eso esto muestrame muestra ensename " +
  "dame agrega agregame agregar anade anademe pon ponme pedido carrito favor porfa porfavor gracias hola buenas buenos dias tardes noches como donde " +
  "cual cuales mas menos hasta dolares dolar usd son sus mis tus mismo ver tambien pero sin sobre entre desde cuando todo toda todos todas otro otra " +
  "otros otras bien muy aqui alli ahi puedes puede pueden podrias seria sera cosa cosas tipo ella ellos algun alguna algunos algunas cualquier tengo " +
  "presupuesto maximo barato barata baratos baratas economico economica mejor mejores recomiendas recomienda recomendacion regalo regalar nino nina " +
  "ninos ninas hijo hija sobrino anos edad nuevo nueva nuevos nuevas novedad novedades recien llego llegaron vendido vendidos popular top quisieramos " +
  "estan esta ubicados ubicado ubicacion ubican queda quedan direccion llegar llego local locales tienda tiendas abren abierto abiertos cierran cierra " +
  "horario horarios hora abrir atienden servicio tecnico reparar reparan arreglar arreglan garantia envio envios envian domicilio pagar pago pagos tarjeta " +
  "efectivo transferencia terminar enviar whatsapp retirar retiro retiras nombre ayuda ayudame ayudar gracias ok okay listo quitar quita cambiar cambia " +
  "cuentame cuenta saber sirve funciona generico genericos usado medio uso incluye trae viene caja prende prender enciende encender " +
  "falla fallas dano danado danada roto rota problema problemas producto productos articulo articulos item items opcion opciones modelo " +
  "modelos marca marcas catalogo disponible disponibles oferta ofertas promocion promociones descuento descuentos entraron ingresaron llegado " +
  "salio salieron lanzaron venta ventas vende venden mostrar ensenar quisiera gustaria interesa busca " +
  "stock existencia existencias directo directa credito debito cuotas cuota financiamiento abono abonos plazo plazos " +
  "aparte ademas entonces bueno igual porfis pues oye disculpa disculpe amigo amiga amigos vendedor senor senora joven " +
  "diferencia diferencias diferente diferentes comparar compara comparame comparacion versus entre " +
  "sobrina primo prima nieto nieta papa mama esposo esposa hermano hermana cumpleanos navidad sorpresa extra adicional adicionales junto juntos " +
  "eres soy ustedes usted somos robot bot chatgpt gemini humano persona asistente mascota muneco llamas " +
  "nano nana pana panas mijo mija manito bro compa compadre jefe patron sale salen " +
  "primero primera segundo segunda tercero tercera ultimo ultima anterior ese esa esos esas aquel aquella mismo misma " +
  "dos tres cuatro cinco seis siete ocho nueve diez once doce " +
  "drift deriva ruido apaga apagado calienta sobrecalienta traba lento lenta " +
  "caro cara caros caras costoso costosa " +
  "mucho muchos mucha muchas varios varias bastante bastantes cantidad juegazo juegazos " +
  "sea sean puedo podemos podria comprar compro comprarle comprarme compra alcanza alcance conviene gastar plata dinero tenga tengan " +
  "you have has the any there for sale price how much want buy please hello what which are does").split(" "));
// Palabras que la gente usa y el catálogo escribe distinto.
// Juegos para compartir: lo que se busca con "mi novia", "la familia", "mi hermano"…
const COOP = ["it takes two", "overcooked", "mario party", "switch sports", "just dance", "mario kart", "wonder", "lego"];
const VR_CHAT = ["oculus", "quest"];
const SINONIMOS_CHAT = {novia: COOP, novio: COOP, pareja: COOP, familia: COOP, familiar: COOP, multijugador: COOP, cooperativo: COOP, futbol: ["fifa", "fc 2", "efootball", "pes 20"], fifa: ["fc 2"], soccer: ["fifa", "fc 2"], carros: ["kart", "racing", "gran turismo", "forza", "need for speed", "crash team"],
  carreras: ["kart", "racing", "gran turismo", "forza", "need for speed"], pelea: ["mortal kombat", "street fighter", "tekken", "smash", "dragon ball"],
  peleas: ["mortal kombat", "street fighter", "tekken", "smash", "dragon ball"], terror: ["resident evil", "silent hill", "outlast"],
  disparos: ["call of duty", "battlefield", "halo", "fortnite"], guerra: ["call of duty", "battlefield"], switch: ["swicth"], switch2: ["switch 2", "swicth 2"],
  audifonos: ["audifono", "headset", "auricular", "diadema"], pokemones: ["pokemon"], cartas: ["tcg", "carta", "booster"], tarjetas: ["tcg", "carta", "booster"],
  joycons: ["joy con", "joy-con"], joycon: ["joy con", "joy-con"],
  virtual: VR_CHAT, vr: VR_CHAT, lentes: VR_CHAT, gafas: VR_CHAT, realidad: VR_CHAT, meta: VR_CHAT,
  accion: ["god of war", "spiderman", "spider-man", "call of duty", "gta", "grand theft", "red dead", "assassin", "battlefield", "just cause", "farcry", "far cry",
    "ghost of", "wolverine", "devil may cry", "the last of us", "black myth", "halo", "gears of war", "ratchet", "returnal", "robocop", "onimusha", "ronin"],
  aventura: ["zelda", "mario", "kirby", "crash", "sackboy", "astro bot", "hollow knight", "pokemon", "sonic", "ratchet", "minecraft", "hogwarts", "metroid", "yoshi", "donkey kong", "luigi"],
  deportes: ["fc 2", "fifa", "nba", "w2k", "madden", "pes 20", "f1 2", "tiger woods", "ufc", "sports", "mario tennis"],
  deportivos: ["fc 2", "fifa", "nba", "w2k", "madden", "pes 20", "f1 2", "tiger woods", "ufc", "sports", "mario tennis"]};
for (const k of ["carros", "carreras"]) SINONIMOS_CHAT[k].push("f1 2", "mario kart", "hot wheels");
for (const k of ["pelea", "peleas"]) SINONIMOS_CHAT[k].push("tokon", "ufc", "w2k");
SINONIMOS_CHAT.terror.push("house of ashes", "little nightmares", "five nights", "callisto", "dead space", "requiem");
const CATEGORIAS_CHAT = [
  ["juegos", /\b(video)?juegos?\b|\btitulos?\b/],
  ["consolas", /\bconsolas?\b/],
  ["palancas", /\b(control(es)?|mandos?|palancas?|joysticks?|joy-?cons?|dualsense|dualshock)\b/],
  ["accesorios", /\b(accesorios?|audifonos?|headsets?|auriculares?|cargador(es)?|cables?|fundas?|estuches?|bases?|memorias?|volantes?|protector(es)?)\b/],
];
// Estas nombran la categoría en general; las demás (audífonos, volante…) además se buscan en el nombre.
// Preguntas sobre la tienda (no sobre un producto): garantía, pagos, cuotas, envíos, horario, ubicación, descuentos…
const INFO_CHAT = /\b(garantia|envios?|enviar|envian|domicilio|delivery|pagos?|pagar|transferencia|credito|debito|cuotas?|financ\w*|abonos?|plazos?|factura\w*|apart(ar|ado|ados|arlo|arla|arme|an|amos)|separar|reserv\w*|devol\w*|cambios?|horarios?|abren|abierto|abiertos|cierran|cierra|ubicacion|ubicados?|direccion|telefono|instagram|redes)\b|\bdonde (esta|queda|quedan|estan)\b|\bcomo (llego|llegar|voy)\b|\bhora\b|\b(hac\w+|dan|dar|aplic\w+)\b.{0,20}\bdescuentos?\b/;
// "El primero", "ese", "agrégalo": habla de lo que ya se le mostró.
const REFERENCIA_CHAT = /\b(primer[oa]?|segund[oa]|tercer[oa]?|ultim[oa]|ese|esa|esos|esas|eso|aquel\w*|mismo|anterior)\b|\bagreg\w*(lo|la|los|las)\b|\b(ponlo|ponla|quitalo|quitala|llevalo|llevala)\b/;
// Títulos para adultos: no se le ofrecen a un niño pequeño.
const MADURO_CHAT = /THE LAST OF US|GOD OF WAR|CALL OF DUTY|\bGTA\b|GRAND THEFT|RESIDENT EVIL|MORTAL KOMBAT|WOLVERINE|SPIDER-?MAN|RED DEAD|DEAD SPACE|SILENT HILL|OUTLAST|\bDOOM\b|FAR ?CRY|ASSASSIN|CYBERPUNK|WITCHER|BLOODBORNE|DEVIL MAY CRY|HITMAN|BATTLEFIELD|MODERN WARFARE|BLACK OPS|WARZONE|FALLOUT|SEKIRO|ELDEN RING|DARK SOULS|FIVE NIGHTS|\bMARVEL|LITTLE NIGHTMARES|NIGHTMARE|HORROR|ZOMBI|EVIL|DEAD|BLOOD|KILL|MAFIA|JUST CAUSE|CALLISTO|FINAL FANTASY XVI|DEATH STRANDING|BLACK MYTH|CRIMSON DESERT|GEARS OF WAR|\bHALO\b|HOUSE OF ASHES|ONIMUSHA|ROBOCOP|RETURNAL|GHOST OF|STAR WARS JEDI|WUCHANG|DRAGON DOGMA|\bUFC\b|RONIN|CRONOS/i;
// Cosas que Contífico pone en "Juegos" pero no son juegos.
const NO_ES_JUEGO = /^(ESTUCHE|FUNDA|MICA|PROTECTOR|CARGADOR|CASE)\b/i;
const GENERICAS_CHAT = /\b(video)?juegos?\b|\btitulos?\b|\bconsolas?\b|\baccesorios?\b|\bcontrol(es)?\b|\bmandos?\b|\bpalancas?\b|\bjoysticks?\b/g;
const ALIAS_CONSOLA = [[/\bplay ?station ?5\b|\bplay ?5\b|\bps ?5\b/g, " ps5 "], [/\bplay ?station ?4\b|\bplay ?4\b|\bps ?4\b/g, " ps4 "],
  [/\bplay ?station\b|\bplay\b/g, " playstation "], [/\bswitch ?2\b/g, " switch2 "]];
const esPlataforma = w => w !== "switch" && w !== "switch2" && CONFIG.plataformas.some(([, re]) => re.test(w.toUpperCase()));
const QUIERE_PRODUCTO = /\b(tienen|tienes|hay|venden|vendes|busco|buscando|quiero|quisiera|necesito|precios?|cuesta|cuestan|vale|valen|stock|disponible|llega|llegan|consigo|algo de|muestrame|ensename|quiero ver|a como|a cuanto)\b/;
const LOCALES_CHAT = new Set(Object.entries(CONFIG.locales).flatMap(([k, L]) => [k, ...norm(`${L.nombre} ${L.zona}`).split(/\s+/)]));
// Faltas y abreviaturas comunes al escribir rápido ("kiero un kontrol d xbox", "la swich 2", "maicraft").
const ERRATAS_CHAT = [[/\bk(iero|ieres|iere|ieren)\b/g, "qu$1"], [/\bkontrol(es)?\b/g, "control$1"], [/\bkonsola(s)?\b/g, "consola$1"],
  [/\b(swich|swith|suich|suitch|switc|swtich|swicht)\b/g, "switch"], [/\b(plei|pley|plai)\b/g, "play"], [/\b(maicraft|maincraft|mincraft|maicra)\b/g, "minecraft"],
  [/\b(q|k)\b/g, "que"], [/\bd\b/g, "de"], [/\bpa\b/g, "para"], [/\b(xq|pq|porq)\b/g, "porque"], [/\bjuegitos?\b/g, "juegos"], [/\bxbos\b/g, "xbox"],
  [/\bpoquemon|pokemom|pokémon\b/g, "pokemon"], [/\bfornite\b/g, "fortnite"], [/\bnintendo swicth\b/g, "nintendo switch"]];
// Modelos puntuales de consola: además de la plataforma, se buscan en el nombre ("ps2" no es "cualquier PlayStation").
const MODELO_CONSOLA = /^(ps[123]|psp|vita|wii|atari|nes|snes|gameboy|3ds|oculus|portal|joycons?|dualsense|dualshock|amiibo)$/;
function analizarConsulta(texto){
  let t = norm(texto).replace(/\b(a nombre de|me llamo|mi nombre es|soy)\b.*$/, " ");
  for (const [re, r] of ERRATAS_CHAT) t = t.replace(re, r);
  for (const [re, r] of ALIAS_CONSOLA) t = t.replace(re, r);
  const T = t.toUpperCase().replace("SWITCH2", "SWITCH 2");
  const plats = CONFIG.plataformas.filter(([, re]) => re.test(T)).map(([n]) => n);
  const mundos = new Set(plats.map(n => CONFIG.mundos[n] ? n : Object.keys(CONFIG.mundos).find(m => CONFIG.mundos[m].subs.includes(n)) || n));
  const plat = mundos.size === 1 ? (plats.find(n => !CONFIG.mundos[n]) || plats[0]) : null;   // lo más puntual: "PS5" antes que "PlayStation"
  // "un control para qué consola": la consola dice para cuál es, no que busque consolas.
  const tc = t.replace(/\b(para|de) (que|cual|mi|la|una|esa|tu|su) consola\b/g, " ")
    .replace(/\b(cuant[oa]s|que|cuales)\s+(video)?juegos?\s+(trae|traen|incluye|incluyen|viene|vienen|contiene|contienen|tiene)\b/g, " ").replace(/\bcuant[oa]s\s+(video)?juegos?\b/g, " ");
  const cats = CATEGORIAS_CHAT.filter(([, re]) => re.test(tc)).map(([c]) => c);
  let cat = cats.length === 1 ? cats[0] : null;

  let max = null, min = null;
  const plata = t.match(/\$\s*(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:\$|dolares?|usd)|(?:menos de|hasta|maximo|no mas de|presupuesto(?: de)?|tengo)\s*\$?\s*(\d{1,5})/);
  if (plata){
    const v = parseFloat((plata[1] || plata[2] || plata[3]).replace(",", "."));
    if (/\b(mas de|desde|mayor a|minimo|arriba de)\s*\$?\s*\d/.test(t)) min = v; else max = v;
  }
  const barato = /\b(barat[oa]s?|economic[oa]s?)\b/.test(t);
  const caro = !barato && /\b(mas caro|mas cara|mas caros|mas caras|el mejor y mas caro|de gama alta|premium)\b/.test(t);
  const nuevo = /\b(nuev[oa]s?|novedad(es)?|recien|llegaron|lanzamientos?)\b|\b(que|algo|cosas?|productos?|juegos?|consolas?)\b.{0,12}\bllego\b|\bya llego\b/.test(t);
  const top = /\b(mas vendid[oa]s?|top|popular(es)?|recomienda[s]?|recomendacion|regal[oa]r?|mejor(es)?)\b/.test(t);
  const topExplicito = /\b(mas vendid[oa]s?|top|popular(es)?)\b/.test(t);
  const oferta = /\b(ofertas?|descuentos?|promo(cion(es)?)?|rebajas?|ahorr\w*)\b/.test(t);
  const palabras = [...new Set((t.replace(GENERICAS_CHAT, " ").match(/[a-z0-9]{3,}/g) || []))]
    .filter(w => !PALABRAS_VACIAS.has(w) && !LOCALES_CHAT.has(w) && (!esPlataforma(w) || MODELO_CONSOLA.test(w)) && !/^\d+$/.test(w) &&
      !/^(agreg|anad|quit|pon|dam|llev|compr|sac|elimin|borr|mand|envi|muestr|ensen|regal|separ|guard|cambi)\w*(lo|la|los|las|le|les|melo|mela|selo|sela)$/.test(w));   // "agrégalo", "quítala"
  // "xbox 360", "xbox one": el modelo exacto.
  for (const m of t.matchAll(/\bxbox (360|one)\b/g)) if (!palabras.includes(m[0])) palabras.push(m[0]);
  // "pokemon za": la parte corta también es del nombre (si algún producto la tiene).
  for (const m of t.matchAll(/\b([a-z]{3,}) ([a-z]{1,2})\b/g)){
    const frase = `${m[1]} ${m[2]}`;
    if (!PALABRAS_VACIAS.has(m[1]) && !/^(de|el|la|lo|en|un|al|mi|tu|su|si|no|ya|es|se|me|te|le|y|o|a|u|e)$/.test(m[2]) && !palabras.includes(frase) && PRODUCTS.some(p => textoBusqueda(p).includes(frase)))
      palabras.push(frase);
  }
  // "FC 26", "GTA 5": el número es parte del nombre; se busca la frase (si algún producto la tiene) además de la palabra.
  for (const m of t.matchAll(/\b([a-z]{2,})\s+(\d{1,3})\b(?!\s*(?:\$|dolares?|usd|anos?|gb|tb|jugadores|meses|dias|pulgadas|hz))/g)){
    const frase = `${m[1]} ${m[2]}`;
    if (!PALABRAS_VACIAS.has(m[1]) && !LOCALES_CHAT.has(m[1]) && !esPlataforma(m[1]) && m[1] !== "switch" && m[1] !== "ps" && !palabras.includes(frase) && PRODUCTS.some(p => textoBusqueda(p).includes(frase)))
      palabras.push(frase);
  }
  const regalo = /\bregal\w*\b/.test(t);
  // "la play 4", "una ps5", "el nintendo switch": sin decir más, se habla de la consola.
  if (!cat && plat && !palabras.filter(w => !/^switch2?$/.test(w)).length && /\b(la|una|mi|el|un)\s+(play ?station ?\d?|play ?\d?|ps ?\d|xbox( series [xs]| one| 360)?|nintendo switch( 2| oled| lite)?|switch( 2| oled| lite)?|(nintendo )?switch2)\b/.test(t) && PRODUCTS.some(p => p.cat === "consolas" && plataformasDe(p).includes(plat))) cat = "consolas";
  const edad = t.match(/\b(\d{1,2}) anos?\b/);
  const ninos = /\b(nin[oa]s?|peque\w*|chiquit\w*|bebe|infantil\w*)\b/.test(t) || !!(edad && +edad[1] <= 12);
  const servicio = /\b(servicio tecnico|reparar|reparacion|arregl\w*|revis\w*\s+(?:(?:un|una|mi|el|la|mis)\s+)?(?:control|palanca|consola|ps\d|xbox|switch|equipo|aparato|celular|tablet)\w*|cobran|cotiz\w*|diagnostic\w*|mantenimiento|no (prende|enciende|carga|funciona|lee|responde)|se (dano|quemo|rompio|traba|apaga)|drift|deriva|falla\w*|ruido|sobrecalient\w*|repara\w*|cambi\w* (de |del |el |la |los |las )?(pantalla|lector|bateria|flex|analogos?|stick|hdmi|puerto|fuente|ventilador|disco duro)|(luz|luces) (roja|rojas|amarilla|naranja)|parpadea\w*|pantalla (negra|azul)|no da imagen|se congela|se reinicia|no lee (discos?|juegos?))\b/.test(t);
  return {plat, cat, max, min, barato, caro, nuevo, top, topExplicito, oferta, ninos, regalo, palabras, servicio, info: INFO_CHAT.test(t), quiere: QUIERE_PRODUCTO.test(t),
    filtros: !!(plat || cat || max != null || min != null || nuevo || top || oferta)};
}
const variantes = w => {
  const sing = [w, w.length > 5 && w.endsWith("es") ? w.slice(0, -2) : null, w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : null].filter(Boolean);
  // "negro" también encuentra "NEGRA" (y "blanca", "roja", "morada"…).
  const genero = sing.filter(x => x.length >= 4 && /[oa]$/.test(x)).map(x => " " + x.slice(0, -1) + (x.endsWith("o") ? "a" : "o"));
  return [...sing, ...genero, ...(SINONIMOS_CHAT[w] || []), ...(SINONIMOS[w] || [])];
};
function buscarParaChat(actual, anterior){
  const r = buscarParaChatBase(actual, anterior);
  r.lista = unicos(r.lista);
  return r;
}
function buscarParaChatBase(actual, anterior){
  const c = analizarConsulta(actual);
  const esta = (p, w) => variantes(w).some(v => textoBusqueda(p).includes(v));
  // Un verbo que no está en ningún nombre ("tengan", "cobran", "quisieran") no es lo que se busca.
  const soloReales = ps => ps.filter(w => !/(ar|er|ir|an|en|amos|emos|imos|aron|ieron|ando|iendo|ria|rian)$/.test(w) || PRODUCTS.some(p => esta(p, w)));
  c.palabras = soloReales(c.palabras);
  if (c.servicio || (c.info && !c.palabras.length)) return {c, propia: c, lista: [], sinCoincidencia: false, nota: "", empates: 0};   // servicio técnico, garantía, pagos…: no es una búsqueda
  const propia = {...c};   // lo que dice este mensaje por sí solo (antes de heredar lo anterior)
  const soloConsola = c.palabras.every(w => /^switch2?$/.test(w));   // "y para switch 2": la consola, no un producto
  // Sigue hablando de lo de antes ("¿y para PS4?", "el más barato", "de acción") — no si es "hola", "gracias" o "retiro en Scala".
  const tq = norm(actual);
  const sigue = !datosEnMensaje(actual) && !/^\s*(hola|buen[oa]s?|gracias|muchas gracias|ok|okay|listo|chao|adios|perfecto|dale|vale|bueno|si|no)\b[\s!.?]*$/.test(tq) &&
    (c.plat || c.cat || c.max != null || c.min != null || c.barato || c.nuevo || c.top || c.ninos || c.regalo ||
     /^\s*(y|para|de|del|en|el|la|los|las|algo|alguno|alguna|uno|una|otr[oa]s?|mas|cual|cuales|cuanto|cuanta|cuantos|que tal|que sea|que sean|tienes|tienen|hay|precio|me (lo|la)|lo|la|ese|esa)\b/.test(tq) ||
     /\b(cuesta|cuestan|vale|valen|precio|sale|salen|stock|disponible|incluye|trae)\b/.test(tq));
  if (anterior && !soloConsola && sigue && /^\s*(y |de |del |para |que sea|algo de|uno de|una de|alguno de)/.test(tq)){   // "de fútbol", "y de acción"
    const a = analizarConsulta(anterior);
    c.plat ??= a.plat; c.cat ??= a.cat; c.max ??= a.max; c.min ??= a.min; c.ninos ||= a.ninos; c.regalo ||= a.regalo;
    if (!c.palabras.some(w => /^switch2?$/.test(w))){ const ms = [...norm(anterior).matchAll(/\bswitch ?2\b|\bswitch\b/g)]; if (ms.length) c.palabras.push(/2/.test(ms.at(-1)[0]) ? "switch2" : "switch"); }
  }
  if (anterior && soloConsola && sigue){   // "¿y para PS4?" sigue hablando de lo de antes
    const a = analizarConsulta(anterior);
    // De "switch" o "switch 2" vale lo último que dijo (lo de ahora, o lo último de antes).
    let sw = c.palabras.filter(w => /^switch2?$/.test(w));
    if (!sw.length){ const ms = [...norm(anterior).matchAll(/\bswitch ?2\b|\bswitch\b/g)]; if (ms.length) sw = [/2/.test(ms.at(-1)[0]) ? "switch2" : "switch"]; }
    if (!c.cat || c.cat === a.cat) c.palabras = [...new Set([...a.palabras.filter(w => !/^switch2?$/.test(w)), ...sw])];   // "¿y un control?" ya no busca lo de antes
    for (const k of ["plat", "cat", "max", "min"]) c[k] ??= a[k];
    c.nuevo ||= a.nuevo; c.top ||= a.top; c.barato ||= a.barato; c.oferta ||= a.oferta; c.quiere ||= a.quiere; c.ninos ||= a.ninos; c.regalo ||= a.regalo;
    c.filtros ||= a.filtros;
  }
  const efectivo = p => precio(p, "efectivo");
  // "Qué llegó nuevo" filtra lo nuevo; "la de disco nueva" o "el fifa nuevo" solo lo prefieren (abajo, al ordenar).
  const soloNuevos = c.nuevo && !c.palabras.filter(w => !/^switch2?$/.test(w)).length;
  const filtrar = (sinPrecio) => PRODUCTS.filter(p => (!c.plat || plataformasDe(p).includes(c.plat)) && (!c.cat || p.cat === c.cat) && !(c.cat === "juegos" && NO_ES_JUEGO.test(p.name)) &&
    (sinPrecio || c.max == null || efectivo(p) <= c.max) && (sinPrecio || c.min == null || efectivo(p) >= c.min) && (!soloNuevos || p.nuevo));
  let lista = filtrar(false), nota = "";
  // Una palabra que está en pocos productos ("iphone") pesa más que una que está en muchos ("pro").
  c.palabras = soloReales(c.palabras);
  const peso = Object.fromEntries(c.palabras.map(w => { const n = PRODUCTS.filter(p => esta(p, w)).length; return [w, n <= 10 ? 4 : n <= 30 ? 2 : 1]; }));
  // "minecraft para switch": "switch" ya es la consola; lo que se busca es "minecraft" (tiene que estar).
  const clave = c.palabras.filter(w => !/^switch2?$/.test(w));
  const puntuar = ls => {
    const puntos = new Map();
    for (const p of ls){
      if (clave.length && !clave.some(w => esta(p, w))) continue;
      const s = c.palabras.reduce((s, w) => s + (esta(p, w) ? peso[w] : 0), 0);
      if (s) puntos.set(p, s);
    }
    const mejor = Math.max(0, ...puntos.values());
    for (const [p, s] of puntos) if (s < mejor * 0.6) puntos.delete(p);   // solo los que coinciden en lo importante
    return puntos;
  };
  let puntos = new Map(), sinCoincidencia = false;
  if (c.palabras.length){
    puntos = puntuar(lista);
    if (!puntos.size && (c.max != null || c.min != null)){   // quizá existe, pero en otro precio
      const sinTope = puntuar(filtrar(true));
      if (sinTope.size){ puntos = sinTope; lista = [...sinTope.keys()]; nota = "en ese precio no hay; estos son los que hay"; }
    }
    if (!puntos.size && c.plat){   // quizá el nombre no dice la consola ("compatible con consolas")
      const libres = puntuar(PRODUCTS.filter(p => (!c.cat || p.cat === c.cat) && !plataformasDe(p).length && /COMPATIBLE|UNIVERSAL|CONSOLAS|GAMER|GAMING/i.test(p.name) && (c.max == null || efectivo(p) <= c.max) && (c.min == null || efectivo(p) >= c.min)));
      if (libres.size){ puntos = libres; lista = [...libres.keys()]; nota = "no dicen para qué consola son (pueden ser compatibles con varias): confirma la compatibilidad por WhatsApp"; }
    }
    const todas = m => new Map([...m].filter(([p]) => clave.every(w => esta(p, w))));
    if (!puntos.size && c.cat){   // "volante": la categoría que se adivinó no es la del producto
      const otra = todas(puntuar(PRODUCTS.filter(p => (!c.plat || plataformasDe(p).includes(c.plat)) && (c.max == null || efectivo(p) <= c.max) && (c.min == null || efectivo(p) >= c.min))));
      if (otra.size){ puntos = otra; lista = [...otra.keys()]; }
    }
    if (!puntos.size && c.plat){   // "minecraft para switch": para esa consola no hay, pero sí para otras
      const otras = todas(puntuar(PRODUCTS.filter(p => (!c.cat || p.cat === c.cat))));
      if (otras.size){
        lista = [...otras.keys()]; sinCoincidencia = true;
        nota = `para ${c.plat} no hay; estos son de otras consolas (dilo claro: no son para ${c.plat})`;
        CHAT.otrasConsolas = true;
        return {c, propia, lista, sinCoincidencia, nota, empates: 0, desconocidas: []};
      }
    }
    if (puntos.size) lista = lista.filter(p => puntos.has(p));
    else if (c.filtros || c.quiere) sinCoincidencia = true;
    else lista = [];   // no era una búsqueda ("¿dónde están?")
  } else if (!c.filtros) lista = [];
  else if (!lista.length && (c.max != null || c.min != null)){   // "juegos de PS5 de menos de $30": los más baratos que sí hay
    lista = filtrar(true);
    nota = `no hay por ${c.max != null ? "menos de $" + c.max : "más de $" + c.min}; estos son los más cercanos`;
    c.barato = c.max != null;
  }
  // "GTA 6", "Black Ops 7", "PS6": la palabra existe pero esa versión no. Se dice que no hay y lo de la lista es "lo más parecido".
  if (!sinCoincidencia && lista.length){
    const tn = norm(actual);
    for (const m of tn.matchAll(/\b([a-z]{2,})\s?(\d{1,2})\b(?!\s*(?:\$|dolares?|usd|anos?|gb|tb|jugadores|meses|dias|horas|pulgadas|hz|unidades))/g)){
      const [, w, n] = m;
      if (w === "ps" && +n > 5){ sinCoincidencia = true; nota = `la PS${n} no existe todavía o no la tenemos`; break; }
      if (!c.palabras.includes(w)) continue;   // "tengo 50", "dame 2": no es parte de un nombre
      const tiene = p => { const x = " " + textoBusqueda(p).replace(/[^a-z0-9]+/g, " ") + " "; return x.includes(" " + n + " ") || (ROMANOS_CHAT[n] && x.includes(" " + ROMANOS_CHAT[n] + " ")); };
      if (!lista.slice(0, 12).some(tiene)){
        sinCoincidencia = true; CHAT.otrasConsolas = true;   // los parecidos sí sirven de alternativa
        nota = `no hay «${w} ${n}»; lo más parecido que sí hay es esto (dilo claro: no es lo que pidió)`;
        break;
      }
    }
  }
  if (!sinCoincidencia && lista.length && clave.length){
    const tn = norm(actual);
    // "Xbox Series S": "series" existe, "series s" no.
    for (const m of tn.matchAll(/\b([a-z]{3,}) ([a-z])\b/g)){
      if (!c.palabras.includes(m[1]) || /^(y|o|a|e|u)$/.test(m[2])) continue;
      const frase = `${m[1]} ${m[2]}`;
      if (!PRODUCTS.some(p => (" " + textoBusqueda(p).replace(/[^a-z0-9]+/g, " ") + " ").includes(" " + frase + " "))){
        sinCoincidencia = true; CHAT.otrasConsolas = true; nota = `no hay «${frase}»; lo más parecido que sí hay es esto (dilo claro: no es lo que pidió)`; break;
      }
    }
    // "¿Venden celulares?", "¿tienen Steam Deck?": solo aparece en productos "para ..." o "compatible con ...".
    const compat = p => { const n = norm(p.name); const i = Math.max(n.search(/\b(para|compatible con|compatibles con)\b/), n.indexOf("/")); return i >= 0 && clave.every(w => variantes(w).some(v => n.slice(i).includes(v)) && !variantes(w).some(v => n.slice(0, i).includes(v))); };
    if (!sinCoincidencia && !c.cat && lista.slice(0, 8).every(compat)){
      sinCoincidencia = true; CHAT.otrasConsolas = true; nota = `no venden «${clave.join(" ")}»; esto es compatible con eso (dilo claro)`;
    }
  }
  const sinPalabras = !c.palabras.filter(w => !/^switch2?$/.test(w)).length;   // "switch" cuenta como plataforma
  if (c.topExplicito && sinPalabras && lista.filter(p => p.top).length >= 3) lista = lista.filter(p => p.top);
  if (c.oferta && !sinCoincidencia){   // no hay ofertas cargadas: lo que sí hay es el ahorro pagando en efectivo
    lista = lista.filter(p => ahorroDe(p) >= 1).sort((a, b) => ahorroDe(b) - ahorroDe(a));
    nota = "no hay ofertas especiales publicadas; estos son los que más ahorran pagando en efectivo o transferencia en vez de tarjeta";
    return {c, propia, lista, sinCoincidencia, nota, empates: 0};
  }
  const hay = p => maxQty(p) > 0 ? 1 : 0;
  lista.sort((a, b) => (puntos.get(b) || 0) - (puntos.get(a) || 0) || hay(b) - hay(a) ||
    // "Tengo $100" sin decir qué: primero lo que más aprovecha el presupuesto; "barato" o con categoría: lo más barato primero.
    (c.barato || (c.max != null && (c.cat || !sinPalabras)) ? efectivo(a) - efectivo(b) : c.max != null || c.caro ? efectivo(b) - efectivo(a) : 0) || (b.top === true) - (a.top === true));
  if (c.ninos && sinPalabras){ const f = lista.filter(p => !MADURO_CHAT.test(p.name)); if (f.length) lista = f; }
  // Regalo, niños o presupuesto sin decir qué: primero los juegos (no micas ni estuches). "una ps5" sin más: primero las consolas.
  const t0 = norm(actual);
  // Dijo "switch" (no "switch 2"): lo de Switch 2 no le sirve a una Switch 1 (al revés sí).
  if (c.palabras.includes("switch") && !c.palabras.includes("switch2")){
    const s1 = lista.filter(p => !/SWI(TC|CT)H 2\b/.test(p.name.toUpperCase()) || /SWI(TC|CT)H 1 ?(Y|-) ?2|1-2/.test(p.name.toUpperCase()));
    if (s1.length) lista = s1;
  }
  if (c.nuevo && !soloNuevos) lista.sort((a, b) => !!b.nuevo - !!a.nuevo);
  if (/\b(nuev[oa]s?|sellad[oa]s?)\b/.test(t0) && !/\b(medio uso|usad[oa]s?|segunda mano)\b/.test(t0)) lista.sort((a, b) => USADO_CHAT.test(a.name) - USADO_CHAT.test(b.name));
  if (!c.cat && c.palabras.length && c.palabras.every(w => MODELO_CONSOLA.test(w) || /^switch2?$|^xbox (360|one)$/.test(w))) lista.sort((a, b) => (b.cat === "consolas") - (a.cat === "consolas"));
  if ((c.ninos || c.regalo || (c.max != null && !c.barato)) && !c.cat && sinPalabras)
    lista.sort((a, b) => (b.cat === "juegos") - (a.cat === "juegos"));
  else if (c.plat && !c.cat && sinPalabras && !c.nuevo && !c.top && !c.oferta && !c.barato)
    lista.sort((a, b) => (b.cat === "consolas") - (a.cat === "consolas"));
  // Cuántos productos distintos empatan como "el que pidió" (para no adivinar cuál agregar).
  const mejor = Math.max(0, ...lista.map(p => puntos.get(p) || 0));
  const empates = new Set(lista.filter(p => (puntos.get(p) || 0) === mejor).map(claveDup)).size;
  const desconocidas = puntos.size ? c.palabras.filter(w => !PRODUCTS.some(p => esta(p, w))) : [];   // nombró algo que no está en ninguna ficha
  return {c, propia, lista, sinCoincidencia, nota, empates, desconocidas};
}
const USADO_CHAT = /MEDIO USO|USAD[OA]|SEGUNDA MANO/;
const ROMANOS_CHAT = {1: "i", 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi", 7: "vii", 8: "viii", 9: "ix", 10: "x"};
// En el catálogo hay productos repetidos (mismo nombre y precio con otro código): al cliente se le muestra uno solo.
const claveDup = p => norm(p.name).replace(/\s+/g, " ").trim() + "|" + precio(p, "efectivo");
function unicos(ps){
  const orden = [], vistos = new Map();
  for (const p of ps){
    const k = claveDup(p);
    if (!vistos.has(k)){ vistos.set(k, orden.length); orden.push(p); }
    else if (!maxQty(orden[vistos.get(k)]) && maxQty(p)) orden[vistos.get(k)] = p;   // se queda el que tiene stock
  }
  return orden;
}
// "Compárame la Switch OLED con la Switch 2": cada cosa que nombra se busca por separado (si no, una tapa a la otra).
function buscarComparacion(mensaje){
  const t = norm(mensaje);
  if (!/\b(compar\w*|diferencias?|versus|vs|mejor|conviene|recomiend\w*|prefier\w*)\b/.test(t)) return null;
  let resto = t.replace(/^.*?\b(?:compar\w*|diferencias?(?: entre)?|(?:que|cual) (?:es |sera |seria )?mejor(?: entre)?|cual (?:me )?conviene|entre)\b/, "");
  // "PS5 o Xbox Series X, ¿cuál es mejor?": lo que se compara va antes.
  if (resto.replace(/[^a-z0-9]/g, "").length < 3) resto = t.replace(/[,¿?]*\s*\b(?:cual|que)\s+(?:es\s+|sera\s+|seria\s+|me\s+)?(?:el\s+|la\s+)?(?:mejor|conviene|recomiendas)\b.*$/, "");
  const fuerte = /\b(compar\w*|diferencias?|versus|vs)\b/.test(t);   // "mejor", "recomiendas"…: solo si dice "A o B"
  const partes = resto.split(fuerte ? /\s+(?:con|y|vs\.?|versus|contra|o)\s+/ : /\s+(?:o|vs\.?|versus)\s+/).map(x => x.replace(/[¿?¡!,.]/g, " ").trim()).filter(x => /[a-z0-9]{3,}/.test(x)).slice(0, 3);
  if (partes.length < 2) return null;
  const busquedas = partes.map(x => ({c: analizarConsulta(x), lista: buscarParaChat(x, null).lista.filter(p => maxQty(p) > 0)}));
  // Se comparan cosas del mismo tipo: la categoría que más se repite ("consolas" si solo nombró plataformas).
  const solasPlataformas = busquedas.every(b => !b.c.palabras.length && !b.c.cat);
  const cats = busquedas.map(b => b.lista[0]?.cat).filter(Boolean);
  const cat = solasPlataformas ? "consolas" : cats.sort((a, b) => cats.filter(x => x === b).length - cats.filter(x => x === a).length)[0];
  const porParte = busquedas.map(b => { const f = cat ? b.lista.filter(p => p.cat === cat) : b.lista; return (f.length ? f : b.lista).slice(0, 4); });
  return porParte.every(l => l.length) ? {partes, porParte} : null;
}
// "Quiero el Mario Kart y un control de PS4": cada cosa se busca por separado (la consola de una no es la de la otra).
function buscarMultiples(mensaje){
  const t = norm(mensaje).replace(/[¿?¡!]/g, " ");
  const partes = t.split(/\s*,\s*|\s+(?:y\s+)?(?:tambien|ademas)\s+|\s+(?:y|e|mas|con)\s+(?=(?:un|una|unos|unas|el|la|los|las|dos|tres|cuatro|\d+)\b)/).map(x => x.trim()).filter(x => /[a-z0-9]{3,}/.test(x)).slice(0, 3);
  if (partes.length < 2) return null;
  let bs = partes.map(x => ({x, c: analizarConsulta(x), r: buscarParaChat(x, null)}));
  // "el juego de Spider-Man para la PS5 y un control extra": el control es para la misma consola.
  const plat = bs.find(b => b.c.plat)?.c.plat;
  if (plat) bs = bs.map(b => b.c.cat && !b.c.plat && !b.c.palabras.length ? {...b, x: `${b.x} ${plat}`, c: analizarConsulta(`${b.x} ${plat}`), r: buscarParaChat(`${b.x} ${plat}`, null)} : b);
  bs = bs.filter(b => !b.c.info && !b.c.servicio && (b.c.palabras.length || b.c.cat || b.c.plat) && !b.r.sinCoincidencia && b.r.lista.some(p => maxQty(p) > 0));
  if (bs.length < 2) return null;
  const porParte = bs.map(b => b.r.lista.filter(p => maxQty(p) > 0).slice(0, 4)), ef = p => precio(p, "efectivo");
  // Las sumas las hace la página (la IA se equivoca al sumar).
  return {partes: bs.map(b => b.x), porParte, totalMin: porParte.reduce((t, l) => t + Math.min(...l.map(ef)), 0), totalPrimeros: porParte.reduce((t, l) => t + ef(l[0]), 0)};
}
function pedidoTexto(){
  const ls = lineas();
  if (!ls.length) return "Pedido actual del cliente: vacío.";
  const L = PEDIDO.retiro && CONFIG.locales[PEDIDO.retiro];
  const sug = sugerencias(4);
  return `Pedido actual del cliente (${unidades()} unidades, total ${fmt(totalPedido())} pagando ${PEDIDO.pago === "tarjeta" ? "con tarjeta" : "en efectivo o transferencia"}; ` +
    `retiro: ${L ? L.nombre : "sin elegir"}${PEDIDO.nombre ? "; a nombre de " + PEDIDO.nombre : ""}):\n` +
    ls.map(({p, q}) => `- ${q} x ${p.name} | código: ${p.code} | disponibles: ${maxQty(p)}`).join("\n") +
    (sug.length ? `\nCombinan con su pedido (ofrécelos si viene al caso):\n${sug.map(p => lineaProducto(p)).join("\n")}` : "");
}
function pedidosTexto(){
  const ls = leerPedidos().slice(0, 3);
  if (!ls.length) return "";
  return `Pedidos que el cliente ya envió por WhatsApp desde este dispositivo (el primero es el último; la tienda los confirma por WhatsApp y la página no sabe en qué estado están):\n` +
    ls.map(x => `- ${x.codigo} | ${fechaCorta(x.fecha)} | ${fmt(Number(x.total) || 0)} | retiro: ${CONFIG.locales[x.retiro]?.nombre || "sin elegir"} | ` +
      x.items.map(([c, q, n]) => `${q} x ${buscar(c)?.name || n || c}`).join("; ")).join("\n");
}
function resumenCatalogo(){
  const cats = {}, mundos = {};
  for (const p of PRODUCTS){
    cats[p.cat_label] = (cats[p.cat_label] || 0) + 1;
    for (const m of Object.keys(CONFIG.mundos)) if (plataformasDe(p).includes(m)) mundos[m] = (mundos[m] || 0) + 1;
  }
  return `Catálogo: ${PRODUCTS.length} productos. Por categoría: ${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(", ")}. ` +
    `Por consola: ${Object.entries(mundos).map(([m, n]) => `${m} ${n}`).join(", ")}.`;
}
// Lo último que pidió. Si eso fue solo una respuesta corta ("PlayStation", "y algo más barato"), se le suma lo
// anterior ("un regalo para mi sobrino de 6 años") para no perder de qué se estaba hablando.
function mensajeAnterior(mensaje){
  const us = CHAT.mensajes.filter(m => m.rol === "usuario" && m.texto && m.texto !== mensaje).map(m => m.texto).reverse();
  let t = us[0], i = 1;
  for (; t && i < us.length && i < 3; i++){
    const a = analizarConsulta(t);
    if (a.palabras.filter(w => !/^switch2?$/.test(w)).length || a.ninos || a.regalo || a.servicio) break;
    t = us[i] + " " + t;
  }
  // "Tienen juegos de PS4" → "de acción" → "de menos de $30": la consola y el tipo de producto siguen valiendo.
  if (t){
    const a = analizarConsulta(t);
    for (let j = i; j < Math.min(us.length, i + 3) && (!a.plat || !a.cat); j++){
      const b = analizarConsulta(us[j]);
      if (b.servicio || b.palabras.filter(w => !/^switch2?$/.test(w)).length) break;   // otro tema: ahí se corta
      if (!a.plat && b.plat){ t += " " + b.plat.toLowerCase(); a.plat = b.plat; }
      if (!a.cat && b.cat){ t += " " + ({palancas: "controles"}[b.cat] || b.cat); a.cat = b.cat; }
    }
  }
  return t;
}
function contextoTienda(mensaje){
  const anterior = mensajeAnterior(mensaje);
  const partes = [
    ahoraTexto(),
    `Tienda: ${CONFIG.storeName}. WhatsApp: +${CONFIG.whatsapp}. Instagram: @electronicgamesec.`,
    `Locales (la clave entre corchetes es la que se usa en las funciones; ahí se retiran los pedidos y se recibe el servicio técnico): ${localesTexto()}.`,
    `Horario de los 3 locales: ${horarioTexto()}`,
    `Cómo comprar: se arma el pedido en la página, se elige el local de retiro y la forma de pago (efectivo, transferencia o tarjeta; con tarjeta algunos precios son más altos) y se envía por WhatsApp, donde se confirma la disponibilidad antes de cobrar. No hay pago dentro de la web ni envío a domicilio.`,
    `Servicio técnico: consolas y palancas/controles de PlayStation, Nintendo y Xbox, en los 3 locales; se cotiza por WhatsApp con el modelo y la falla.`,
    `El stock sale del inventario y se actualiza cada 15 minutos. Los precios incluyen IVA. La web no publica política de garantía ni de envíos: si preguntan, dilo y ofrece WhatsApp.`,
    `Cómo responder:
- SIEMPRE escribe al menos una frase de respuesta al cliente, aunque también llames funciones; nunca contestes solo con una función. Si piden varias cosas en un mensaje, atiéndelas todas. NUNCA hagas sumas ni multiplicaciones de memoria: usa solo los totales que este CONTEXTO ya trae calculados o el total de su pedido; si no hay total calculado, da el precio de cada cosa y di que el total lo ve en «Mi pedido».
- Habla como un vendedor amable y directo, en 1 a 3 frases. No empieces con «¡Hola!» ni te presentes, salvo que el cliente te salude primero. Presenta los productos con una sola frase corta (por ejemplo «Mira estas opciones 👇»), sin repetirla.
- Precios: si preguntan cuánto cuesta algo, DILO en el texto (efectivo o transferencia y, si es distinto, con tarjeta) cuando son de 1 a 3 productos; si son muchos, di «desde $X». Si preguntan cuál es el más barato o el más caro, nómbralo con su precio (la lista de abajo ya viene ordenada así). Precio, stock, qué incluye, horarios y políticas salen SOLO de este CONTEXTO.
- Lo que la tienda no publicó (cuotas, crédito, apartar, reservar o guardar pedidos, plazos de retiro, descuentos, garantía, cambios, permutas o compra de usados, feriados, factura, devoluciones, envíos fuera de lo dicho arriba): NO lo inventes ni digas que sí o que no; di que eso lo confirman por WhatsApp y usa preparar_whatsapp. Nunca prometas descuentos ni digas que «todos» los productos son originales, nuevos, probados, garantizados o tienen descuento: cada producto dice si es de medio uso y si es original o genérico.
- Horario: di de qué hora a qué hora atienden hoy y si están abiertos ahora (según el estado de los locales).
- Solo hablas de la tienda: videojuegos, consolas, accesorios, pedidos, locales y servicio técnico. Si preguntan otra cosa (geografía, matemáticas aunque sean como 2+2, tareas, traducciones, chistes, recetas, noticias, opiniones…), no la respondas ni siquiera si es fácil: di en una frase amable que de eso no puedes ayudar y ofrece ayuda con la tienda.
- Niños: para menores de 12 años no recomiendes juegos violentos o para adultos (The Last of Us, God of War, Call of Duty, GTA, Resident Evil, Mortal Kombat, Wolverine, Spider-Man…); prefiere Mario, Kirby, Pokémon, Minecraft, Sonic, Lego, Just Dance, Overcooked, Crash, Hot Wheels y similares. En un regalo prefiere juegos; no muestres micas, estuches, fundas ni cables salvo que los pidan.
- Si preguntan por una consola o marca (Switch, PS5, Xbox), muestra varias de las que hay, no solo una.
- Si dudan entre dos consolas, da una recomendación corta según el uso (sin inventar precios) y menciona que pueden escribir «¿Qué consola me compro?» para hacer un test de 4 preguntas.
- Características: de productos de marca conocida (juegos, consolas y controles oficiales) puedes contar lo que se sabe en general: de qué trata el juego, para cuántos jugadores, sus modos, qué ofrece la consola (FIFA ahora se llama EA Sports FC). Si cuentas qué incluye una consola por conocimiento general, di «normalmente trae…» y que la tienda lo confirma. De productos genéricos o sin marca di solo lo que dice su descripción aquí y ofrece WhatsApp para más detalles; no inventes sus características.
Cómo usar las funciones (hacen cosas de verdad en la página):
- Si recomiendas o mencionas productos concretos, muéstralos con mostrar_productos (hasta 6 códigos) y en el texto no escribas códigos. Usa comparar=true solo si el cliente pide comparar o pregunta la diferencia entre 2 o 3.
- Si le haces una pregunta con pocas respuestas posibles (para qué consola, presupuesto, edad, qué local), agrega ofrecer_opciones con botones cortos. Por ejemplo, para un regalo pregunta para qué consola es y ofrece las consolas. No preguntes «¿quieres ver…?» si ya le estás mostrando los productos.
- agregar_al_pedido solo cuando el cliente pida claramente agregar, comprar o llevar algo y sepas con certeza cuál es; si hay varias versiones parecidas, muéstralas y pregunta cuál. Usa solo códigos de este contexto, nunca inventes uno.
- cambiar_cantidad para cambiar o quitar (cantidad 0) algo que ya está en el pedido; con codigo TODO y cantidad 0 vacía todo el pedido.
- datos_del_pedido para elegir el local de retiro, la forma de pago o el nombre.
- abrir_pantalla: pedido_actual cuando quiera terminar, pagar, enviar o revisar su pedido (lo envía él mismo por WhatsApp desde ahí); ficha_producto para ver fotos y detalles de uno; catalogo para ver muchos de una consola, categoría o búsqueda; favoritos; pedidos_enviados para ver los que ya mandó.
- repetir_pedido para volver a pedir lo de un pedido ya enviado; compartir_producto si quiere mandarle un producto a alguien; instalar_app si quiere la tienda como app.
- guardar_favorito si quiere guardarlo para después; como_llegar si pregunta la ubicación o cómo llegar a un local.
- Si describen una falla (drift, no prende, ruido, se apaga…): sí lo revisan en el servicio técnico; nunca digas que no tienen el servicio. Pregunta el modelo si falta y usa preparar_whatsapp con el equipo y la falla.
- preparar_whatsapp para: servicio técnico (primero pregunta el equipo y la falla, luego arma el mensaje), saber cómo va un pedido ya enviado (con su código) y lo que la tienda no publicó (arriba). Si un producto no está en el catálogo, di simplemente que por ahora no lo tienen (sin hablar de fechas de lanzamiento ni preventas) y ofrece avisarle cuando llegue.
- Después de usar una función la página ya le confirma al cliente: no repitas "listo, lo agregué". Si dices "mira estas opciones", "te dejo el botón" o algo así, TIENES que llamar a la función en esa misma respuesta.
Formato: puedes usar **negritas** y listas cortas con guiones (hasta 4 puntos si cuentas características). Nunca escribas códigos de producto, nombres de funciones, notas técnicas, tablas ni enlaces en el texto.`,
    pedidoTexto(),
    pedidosTexto(),
  ].filter(Boolean);
  const ficha = buscar(CHAT.desdeFicha);
  if (ficha) partes.push(`El cliente viene de la ficha de «${ficha.name}» (código ${ficha.code}) y quiere saber más: cuéntale en el chat lo más útil (precio, stock por local, para qué consola es, qué incluye y, si es de una marca conocida, sus características principales). No le vuelvas a abrir la ficha.\n${lineaProducto(ficha, true)}`);
  if (!PRODUCTS.length) partes.push("El catálogo todavía no cargó en esta visita: si preguntan por un producto, sugiere revisarlo en la página o preguntar por WhatsApp.");
  else {
    partes.push(resumenCatalogo());
    CHAT.otrasConsolas = false;
    CHAT.vistosAntes = [...CHAT.citados];
    const {c, propia, lista, sinCoincidencia, nota, empates, desconocidas} = buscarParaChat(mensaje, anterior);
    CHAT.platPedida = CHAT.otrasConsolas ? null : c.plat;
    CHAT.empates = empates;
    const tokens = (norm(mensaje).match(/[a-z0-9]+/g) || []).length || 1;
    CHAT.ultimaBusqueda = (sinCoincidencia && !CHAT.otrasConsolas) || c.info ? [] : lista.slice(0, 6).map(p => p.code);
    // ¿de verdad está buscando productos? (si no, no se le muestran tarjetas por una palabra suelta)
    // (con lo que dice este mensaje, no con lo que se hereda: "gracias" después de ver juegos no pide más juegos)
    CHAT.intencionProducto = !c.info && !c.servicio && !!(propia.quiere || propia.plat || propia.max != null || propia.min != null || propia.nuevo || propia.topExplicito || propia.oferta || propia.barato || propia.caro || propia.ninos || propia.regalo || propia.palabras.length / tokens >= 0.5 ||
      propia.cat || (tokens <= 4 && propia.palabras.some(w => !/^switch2?$/.test(w) && PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))))));   // nombra algo que hay ("y el gta 5?")
    CHAT.desconocidas = desconocidas || [];
    CHAT.candidatos = [...new Set([...lista.slice(0, 30).map(p => p.code), ...CHAT.citados])];
    CHAT.buscaEspecifico = !c.info && !c.oferta && !c.servicio && c.palabras.length > 0;
    CHAT.esOferta = !c.info && !!c.oferta;
    CHAT.noEncontrado = sinCoincidencia && c.quiere && CHAT.buscaEspecifico && (propia.palabras.length || propia.plat) && !QUIERE_COMPARAR.test(norm(mensaje)) ? nombreBuscado(mensaje) : "";
    CHAT.esReferencia = REFERENCIA_CHAT.test(norm(mensaje));
    if (CHAT.esReferencia){
      const ult = [...CHAT.mensajes].reverse().find(m => m.productos || m.comparar), ps = ult ? (ult.productos || ult.comparar).map(buscar).filter(Boolean) : [];
      if (ps.length) partes.push(`Lo último que le mostraste al cliente, en orden (si dice «el primero», «el segundo», «ese», «agrégalo»… se refiere a estos):\n${ps.map((p, i) => `${i + 1}) ${p.name} | código: ${p.code} | ${fmt(precio(p, "efectivo"))}`).join("\n")}`);
    }
    if (desconocidas?.length && lista.length && !c.info)
      partes.push(`OJO: ninguna ficha menciona «${desconocidas.join(" ")}». Si el cliente busca justo eso, probablemente no lo tenemos: dilo y ofrece avisarle, y muestra solo lo parecido que sí hay.`);
    const comp = buscarComparacion(mensaje);
    CHAT.comparacion = comp ? unicos(comp.porParte.map(l => l[0])).map(p => p.code) : null;
    if (comp){
      CHAT.ultimaBusqueda = CHAT.comparacion;
      partes.push("El cliente quiere comparar. Esto es lo que hay de cada cosa que nombró (usa mostrar_productos con comparar=true y un código de cada una; si algo no aparece aquí, no lo tenemos):\n" +
        comp.porParte.map((l, i) => `(${i + 1}) «${comp.partes[i]}»:\n${l.map(p => lineaProducto(p)).join("\n")}`).join("\n"));
    }
    const mult = comp ? null : buscarMultiples(mensaje);
    CHAT.montos = mult ? [mult.totalMin, mult.totalPrimeros] : [];
    if (comp || mult) CHAT.intencionProducto = true;   // "¿PS5 o Xbox?", "el Mario Kart y un control": pide productos aunque no diga una consola sola
    if (mult){
      CHAT.noEncontrado = "";
      CHAT.ultimaBusqueda = unicos(mult.porParte.map(l => l[0])).map(p => p.code);
      partes.push("El cliente pidió varias cosas en un solo mensaje. Esto es lo que hay de cada una (atiende todas; muéstralas con mostrar_productos y, si pide el total, súmalo con los precios de efectivo o transferencia):\n" +
        mult.porParte.map((l, i) => `(${i + 1}) «${mult.partes[i]}»:\n${l.map(p => lineaProducto(p)).join("\n")}`).join("\n") +
        `\nTotales YA CALCULADOS (efectivo o transferencia; no hagas cuentas tú): llevando lo más económico de cada cosa suma ${fmt(mult.totalMin)}; con el primero de cada lista suma ${fmt(mult.totalPrimeros)}.`);
    }
    // "Agrega el Spider-Man 2" → "y un control negro original": sigue agregando.
    const usuarios = CHAT.mensajes.filter(m => m.rol === "usuario" && m.texto && m.texto !== mensaje);
    const previo = norm(usuarios.at(-1)?.texto || "");
    CHAT.agregarImplicito = /\b(agreg\w*|anad\w*|pon|ponme|llevo|me llevo)\b/.test(previo) && /^\s*(y|tambien|ademas)\b|\b(tambien|ademas)\b/.test(norm(mensaje)) &&
      !/\b(cuanto|precio|cuesta|vale|hay|tienen|tienes|que|cual|como|donde)\b/.test(norm(mensaje)) && !c.servicio && !c.info;
    if (CHAT.agregarImplicito) partes.push("El cliente sigue agregando cosas a su pedido: si lo que pide ahora es un solo producto claro, agrégalo con agregar_al_pedido; si hay varios parecidos, muéstralos y pregunta cuál.");
    // ¿Pidió agregar algo sin decir cuál? Si describió varios parecidos, primero se le pregunta cuál (la página lo hace cumplir).
    const propio = analizarConsulta(mensaje);
    CHAT.ambiguo = null;
    if (/\b(agrega\w*|anade\w*|ponme|poner|pon|comprar|llevo|llevar|quiero (el|la|los|las|un|una|dos|tres|\d+))\b/.test(norm(mensaje)) && !/agreg\w*(lo|la|los|las)\b|\b(ese|esa|esos|esas|primero|segundo|tercero|ultimo|mismo|anterior)\b/.test(norm(mensaje)) &&
        lista.length > 1 && !sinCoincidencia && !mult && ((!propio.palabras.length && (propio.cat || propio.plat)) || (propio.palabras.length && empates > 1)))
      CHAT.ambiguo = lista.slice(0, 6).map(p => p.code);
    if (CHAT.ambiguo) partes.push("OJO: hay varios productos que encajan con lo que pidió y no dijo cuál. NO uses agregar_al_pedido todavía: muéstralos con mostrar_productos y pregúntale cuál quiere.");
    const vistos = new Set(lista.slice(0, 30).map(p => p.code));
    if (sinCoincidencia && !c.info && !mult && !comp){
      medir("chat-sin-resultados", {q: c.palabras.join(" ").slice(0, 60)});
      partes.push(CHAT.otrasConsolas
        ? `Para ${c.plat} no hay «${c.palabras.join(" ")}». Dilo claro y ofrece avisarle cuando llegue; si le sirve, sí hay para otras consolas (muéstralos aclarando para cuál es cada uno):\n${lista.slice(0, 12).map(p => lineaProducto(p)).join("\n")}`
        : `No hay ningún producto que coincida con lo que pidió en el catálogo. Dilo con honestidad y ofrece preguntar por WhatsApp (preparar_whatsapp) para que le avisen si llega.` +
        (lista.length ? ` Parecidos que sí hay (${lista.length}):\n${lista.slice(0, 12).map(p => lineaProducto(p)).join("\n")}` : ""));
    } else if (lista.length && !mult){
      partes.push(`Productos relacionados con la pregunta (${lista.length} en total${lista.length > 30 ? ", aquí los 30 más relevantes" : ""}${nota ? "; ojo: " + nota : ""}):\n` +
        lista.slice(0, 30).map((p, i) => lineaProducto(p, i < 5)).join("\n"));
    }
    if (c.barato && !mult && !comp && !sinCoincidencia && lista.length > 1){
      const m = lista.find(p => maxQty(p) > 0) || lista[0];
      partes.push(`Pidió lo más barato: lo más barato de esa lista que hay en stock es «${m.name}» a ${fmt(precio(m, "efectivo"))} (efectivo o transferencia). Nombra ese, no otro; ponlo primero en mostrar_productos.`);
    }
    const antes = CHAT.citados.map(buscar).filter(p => p && !vistos.has(p.code)).slice(0, 8);
    if (antes.length) partes.push(`Productos de los que ya se habló en esta conversación:\n${antes.map(p => lineaProducto(p)).join("\n")}`);
    const miro = VISTOS.map(buscar).filter(p => p && !vistos.has(p.code)).slice(0, 3);
    if (miro.length) partes.push(`Productos que el cliente miró hace poco en la página (el primero es el último):\n${miro.map(p => lineaProducto(p)).join("\n")}`);
    const favs = favoritosVigentes().slice(0, 5);
    if (favs.length) partes.push(`Sus favoritos: ${favs.map(p => `${p.name} (código ${p.code})`).join("; ")}.`);
  }
  return partes.join("\n\n").slice(0, 28000);
}

// --- Lo que puede hacer en la página ---
// Son 12 como máximo (el Worker no manda más): varias agrupan acciones y normalizarAccion las separa.
const HERRAMIENTAS_CHAT = [
  {name: "mostrar_productos", description: "Muestra en el chat tarjetas con foto, precio y botón de agregar de hasta 6 productos del CONTEXTO. Úsala siempre que recomiendes o menciones productos concretos. Con comparar=true y 2 o 3 códigos muestra una tabla que los compara (precios, consola, stock por local).",
    parameters: {type: "OBJECT", properties: {codigos: {type: "ARRAY", items: {type: "STRING"}, description: "Códigos exactos del CONTEXTO, del más al menos relevante."}, comparar: {type: "BOOLEAN", description: "true si el cliente quiere compararlos."}}, required: ["codigos"]}},
  {name: "agregar_al_pedido", description: "Agrega un producto del CONTEXTO al pedido del cliente. Solo cuando lo pide claramente y sabes con certeza cuál es.",
    parameters: {type: "OBJECT", properties: {codigo: {type: "STRING", description: "Código exacto del CONTEXTO."}, cantidad: {type: "INTEGER", description: "Cuántos agregar; si no lo dice, 1."}}, required: ["codigo"]}},
  {name: "cambiar_cantidad", description: "Cambia la cantidad de un producto que ya está en el pedido; con 0 lo quita. Con codigo TODO y cantidad 0 vacía todo el pedido (se puede deshacer).",
    parameters: {type: "OBJECT", properties: {codigo: {type: "STRING"}, cantidad: {type: "INTEGER", description: "Cantidad final (0 = quitar)."}}, required: ["codigo", "cantidad"]}},
  {name: "datos_del_pedido", description: "Elige el local donde se retira el pedido, la forma de pago o el nombre de quien retira.",
    parameters: {type: "OBJECT", properties: {
      local: {type: "STRING", enum: Object.keys(CONFIG.locales), description: "Clave del local (la que va entre corchetes en el CONTEXTO)."},
      pago: {type: "STRING", enum: ["efectivo", "transferencia", "tarjeta"]},
      nombre: {type: "STRING", description: "Nombre de quien retira."}}}},
  {name: "abrir_pantalla", description: "Abre una parte de la página: pedido_actual (para revisarlo y enviarlo él mismo por WhatsApp), ficha_producto (fotos y detalles de un producto), catalogo (muchos productos filtrados), favoritos o pedidos_enviados (los que ya mandó desde este dispositivo).",
    parameters: {type: "OBJECT", properties: {
      pantalla: {type: "STRING", enum: ["pedido_actual", "ficha_producto", "catalogo", "favoritos", "pedidos_enviados"]},
      codigo: {type: "STRING", description: "Para ficha_producto: código del producto."},
      busqueda: {type: "STRING", description: "Para catalogo: palabras a buscar, por ejemplo 'mario' o 'volante'."},
      categoria: {type: "STRING", enum: ["consolas", "palancas", "juegos", "accesorios"]},
      consola: {type: "STRING", enum: [...new Set(CONFIG.plataformas.map(([n]) => n))]}}, required: ["pantalla"]}},
  {name: "guardar_favorito", description: "Guarda un producto en los favoritos del cliente.",
    parameters: {type: "OBJECT", properties: {codigo: {type: "STRING"}}, required: ["codigo"]}},
  {name: "como_llegar", description: "Muestra un botón para abrir en Google Maps la ubicación de un local.",
    parameters: {type: "OBJECT", properties: {local: {type: "STRING", enum: Object.keys(CONFIG.locales)}}, required: ["local"]}},
  {name: "preparar_whatsapp", description: "Muestra un botón que abre WhatsApp de la tienda con un mensaje ya escrito (servicio técnico, producto que no está en el catálogo, cómo va un pedido ya enviado, garantía, envíos o algo que no sepas).",
    parameters: {type: "OBJECT", properties: {mensaje: {type: "STRING", description: "Mensaje completo para la tienda, en primera persona del cliente."}, boton: {type: "STRING", description: "Texto corto del botón."}}, required: ["mensaje"]}},
  {name: "ofrecer_opciones", description: "Muestra de 2 a 5 botones con respuestas cortas para que el cliente toque una en vez de escribir. Úsala cuando le hagas una pregunta con pocas respuestas posibles (consola, presupuesto, edad, local, sí o no).",
    parameters: {type: "OBJECT", properties: {opciones: {type: "ARRAY", items: {type: "STRING"}, description: "Respuestas cortas (hasta 4 palabras), escritas como las diría el cliente."}}, required: ["opciones"]}},
  {name: "compartir_producto", description: "Muestra botones para mandarle un producto a otra persona por WhatsApp o copiar su enlace.",
    parameters: {type: "OBJECT", properties: {codigo: {type: "STRING"}}, required: ["codigo"]}},
  {name: "repetir_pedido", description: "Vuelve a poner en el pedido actual lo de un pedido que ya envió (lo que siga disponible).",
    parameters: {type: "OBJECT", properties: {codigo: {type: "STRING", description: "Código del pedido enviado (del CONTEXTO); si no lo dice, el último."}}}},
  {name: "instalar_app", description: "Ayuda a instalar la tienda como app en el celular o la computadora (botón o pasos)."},
];
const decir = texto => agregarMensaje({rol: "mascota", texto});
function citar(ps){ CHAT.citados = [...new Set([...ps.map(p => p.code), ...CHAT.citados])].slice(0, 12); }
const ACCIONES_CHAT = {
  mostrar_productos({codigos}){
    const ps = unicos([...new Set(Array.isArray(codigos) ? codigos : [])].map(buscar).filter(Boolean)).slice(0, 6);
    if (!ps.length) return;
    citar(ps);
    agregarMensaje({rol: "mascota", productos: ps.map(p => p.code)});
  },
  agregar_al_pedido({codigo, cantidad}){
    const p = buscar(codigo);
    if (!p) return decir("No logré identificar bien ese producto para agregarlo — dime el nombre tal como aparece en la página.");
    const max = maxQty(p);
    if (!max){
      decir(`${p.name} está agotado por ahora 😔 Si quieres, te aviso aquí cuando vuelva.`);
      return agregarMensaje({rol: "mascota", botones: [{texto: "🔔 Avísame aquí cuando vuelva", accion: "avisame-codigo", valor: p.code}]});
    }
    const actual = PEDIDO.items.get(p.code) || 0, nueva = Math.min(actual + Math.max(1, Math.min(20, parseInt(cantidad, 10) || 1)), max);
    citar([p]);
    if (nueva === actual) return decir(`Ya tienes en tu pedido todas las unidades disponibles de ${p.name} (${max}).`);
    setCantidad(p.code, nueva);
    confirmarAgregado(p, nueva - actual);
    medir("agregar-al-pedido", {codigo: p.code, via: "chat"});
    decir(`¡Listo! Agregué ${nueva - actual > 1 ? (nueva - actual) + " x " : ""}${p.name} a tu pedido 🛒` + (nueva - actual < (parseInt(cantidad, 10) || 1) ? ` (solo hay ${max} disponible${max === 1 ? "" : "s"})` : ""));
  },
  cambiar_cantidad({codigo, cantidad}){
    const p = buscar(codigo), antes = p ? PEDIDO.items.get(p.code) || 0 : 0;
    if (!p || !antes) return decir("Ese producto no está en tu pedido.");
    const q = Math.max(0, Math.min(parseInt(cantidad, 10) || 0, maxQty(p)));
    if (!q) guardarDeshacer(`Quitaste ${p.name}`);
    setCantidad(p.code, q);
    decir(q ? `Listo, ahora tienes ${q} x ${p.name} en tu pedido.` : `Listo, quité ${p.name} de tu pedido.`);
  },
  datos_del_pedido({local, pago, nombre}){
    const hecho = [];
    let ojo = "";
    if (local && CONFIG.locales[local]){
      PEDIDO.retiro = local; hecho.push(`retiras en ${CONFIG.locales[local].nombre}`);
      // Lo que no hay en ese local (para que no vaya a retirarlo y no esté).
      const faltan = lineas().filter(({p}) => p.stock && !(p.stock[local] > 0));
      if (faltan.length) ojo = " Ojo: " + faltan.map(({p}) => {
        const donde = Object.keys(p.stock).filter(k => p.stock[k] > 0 && CONFIG.locales[k]).map(k => CONFIG.locales[k].nombre);
        return `${p.name} no hay en ${CONFIG.locales[local].nombre}` + (donde.length ? ` (sí hay en ${donde.join(" y ")})` : "");
      }).join("; ") + ". Al confirmar por WhatsApp te dicen si lo pueden traer o si te conviene retirar en otro local.";
    }
    if (pago){ PEDIDO.pago = pago === "tarjeta" ? "tarjeta" : "efectivo"; hecho.push(pago === "tarjeta" ? "pagas con tarjeta" : `pagas ${pago === "transferencia" ? "por transferencia" : "en efectivo"}`); }
    if (typeof nombre === "string" && nombre.trim()){ PEDIDO.nombre = nombre.trim().slice(0, 60); $("nombre").value = PEDIDO.nombre; hecho.push(`a nombre de ${PEDIDO.nombre}`); }
    if (!hecho.length) return;
    guardarPedido(); actualizarPedido();
    decir(`Anotado: ${hecho.join(", ")} ✅` + ojo);
  },
  ver_pedido(){
    if (!unidades()) return decir("Tu pedido todavía está vacío. ¿Te ayudo a encontrar algo?");
    abrirCarrito();
    decir("Te abrí tu pedido: revísalo y toca «Enviar por WhatsApp» para mandarlo 📲");
  },
  abrir_producto({codigo}){
    const p = buscar(codigo);
    if (!p) return decir("No encontré ese producto en el catálogo.");
    citar([p]);
    // Si justo viene de esa ficha, no se la vuelve a abrir: se le deja la tarjeta aquí.
    if (p.code === CHAT.desdeFicha) return ACCIONES_CHAT.mostrar_productos({codigos: [p.code]});
    decir(`Te abrí la ficha de ${p.name} 👀`);
    abrirProducto(p.code);
  },
  ver_catalogo({busqueda, categoria, consola}){
    const cat = ["consolas", "palancas", "juegos", "accesorios"].includes(categoria) ? categoria : "all";
    const plat = CONFIG.plataformas.some(([n]) => n === consola) ? consola : "all";
    aplicarFiltro({q: String(busqueda || "").slice(0, 60), cat, plat});
    const n = listaFiltrada().length;
    decir(n ? `Te llevé al catálogo: ${n} producto${n === 1 ? "" : "s"} 👇` : "No encontré productos con eso en el catálogo 😔");
    if (enCelular()) $("chatMascota").close();
  },
  guardar_favorito({codigo}){
    const p = buscar(codigo);
    if (!p) return;
    if (!FAVS.has(p.code)) alternarFavorito(p.code);
    decir(`Guardé ${p.name} en tus favoritos ❤️`);
  },
  como_llegar({local}){
    const L = CONFIG.locales[local];
    if (L) agregarMensaje({rol: "mascota", enlace: {href: L.maps, texto: `Cómo llegar a ${L.nombre}`, tipo: "mapa"}});
  },
  preparar_whatsapp({mensaje, boton}){
    const m = String(mensaje || "").trim().slice(0, 700);
    if (m) agregarMensaje({rol: "mascota", enlace: {href: waLink(m), texto: String(boton || "Enviar por WhatsApp").slice(0, 40), tipo: "wa"}});
  },
  comparar_productos({codigos}){
    const ps = unicos([...new Set(Array.isArray(codigos) ? codigos : [])].map(buscar).filter(Boolean)).slice(0, 3);
    if (ps.length < 2) return ACCIONES_CHAT.mostrar_productos({codigos});
    citar(ps);
    agregarMensaje({rol: "mascota", comparar: ps.map(p => p.code)});
  },
  vaciar_pedido(){
    if (!unidades()) return decir("Tu pedido ya está vacío.");
    const antes = [...PEDIDO.items];
    PEDIDO.items.clear(); PEDIDO.codigo = ""; guardarPedido(); actualizarPedido();
    agregarMensaje({rol: "mascota", texto: "Listo, vacié tu pedido 🧹", deshacer: antes});
  },
  ver_favoritos(){
    const fs = favoritosVigentes();
    if (!fs.length) return decir("Todavía no tienes favoritos. Toca el ❤️ de un producto para guardarlo y tenerlo a mano.");
    ACCIONES_CHAT.mostrar_productos({codigos: fs.slice(0, 6).map(p => p.code)});
    agregarMensaje({rol: "mascota", botones: [{texto: fs.length > 6 ? `Ver mis ${fs.length} favoritos` : "Abrir mis favoritos", accion: "abrir-favoritos"}]});
  },
  mis_pedidos(){
    const ls = leerPedidos();
    if (!ls.length) return decir("Todavía no has enviado pedidos desde este dispositivo. Cuando mandes uno por WhatsApp, te lo guardo aquí 📦");
    agregarMensaje({rol: "mascota", pedidos: ls.slice(0, 3).map(x => x.codigo)});
    if (ls.length > 3) agregarMensaje({rol: "mascota", botones: [{texto: `Ver mis ${ls.length} pedidos`, accion: "abrir-pedidos"}]});
  },
  repetir_pedido({codigo}){
    const ls = leerPedidos(), c = String(codigo || "").trim().toUpperCase();
    const x = ls.find(y => y.codigo.toUpperCase() === c) || (!c || ls.length === 1 ? ls[0] : null);
    if (!x){
      if (!ls.length) return decir("Todavía no has enviado pedidos desde este dispositivo.");
      decir("No encontré ese pedido; estos son los que enviaste 👇");
      return ACCIONES_CHAT.mis_pedidos();
    }
    contarRepetido(repetirPedido(x.codigo), x.codigo);
  },
  ofrecer_opciones({opciones}){
    const ops = [...new Set((Array.isArray(opciones) ? opciones : []).map(o => String(o ?? "").trim().slice(0, 40)).filter(Boolean))].slice(0, 5);
    if (ops.length >= 2) agregarMensaje({rol: "mascota", opciones: ops});
  },
  compartir_producto({codigo}){
    const p = buscar(codigo);
    if (!p) return;
    citar([p]);
    const url = paginaDe(p);
    agregarMensaje({rol: "mascota", botones: [
      {texto: "Mandar por WhatsApp", icono: "wa", href: `https://wa.me/?text=${encodeURIComponent(`Mira: ${p.name} a ${fmt(precio(p, "efectivo"))} en ${CONFIG.storeName} ${url}`)}`},
      {texto: "Copiar enlace", accion: "copiar", valor: url}]});
  },
  avisar_llegada({q}){
    q = String(q || "").trim().slice(0, 60);
    if (q) agregarMensaje({rol: "mascota", botones: [
      {texto: "Avísenme por WhatsApp", icono: "wa", tipo: "chat", href: waLink(`Hola ${CONFIG.storeName}, ¿tienen ${q}? Me gustaría que me avisen cuando llegue.`)},
      {texto: "🔔 Avísame aquí", accion: "avisame", valor: q}]});
  },
  instalar_app(){
    if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) return decir("¡Ya la estás usando como app! 🙌");
    if (instalador) return agregarMensaje({rol: "mascota", botones: [{texto: "Instalar la app", accion: "instalar"}]});
    decir(esIOS ? "En iPhone: toca **Compartir** (el cuadrito con la flecha) y luego **Agregar a pantalla de inicio** 📲"
      : "Abre el menú del navegador (⋮) y toca **Instalar app** o **Agregar a pantalla de inicio** 📲");
  },
};
function contarRepetido(r, codigo){
  if (!r) return;
  if (!r.puestos.length) return decir(`De tu pedido ${codigo} ya no queda nada disponible 😔`);
  decir(`Listo, puse en tu pedido lo del ${codigo}${r.puestos.length <= 3 ? ": " + r.puestos.map(p => p.name).join(", ") : ` (${r.puestos.length} productos)`} 🛒` +
    (r.faltan.length ? `\nYa no hay: ${r.faltan.join(", ")}.` : ""));
  agregarMensaje({rol: "mascota", botones: [{texto: "Ver mi pedido", accion: "ver-pedido"}]});
}
// Algunas herramientas agrupan varias acciones (para no pasar de 12): aquí se traducen a las de la página.
const QUIERE_COMPARAR = /\b(compar\w*|diferencias?|vs|versus|mejor|conviene|se (parecen|diferencian))\b/;
function normalizarAccion(a, pregunta = ""){
  const x = a.args || {};
  if ((a.nombre === "mostrar_productos" && x.comparar === true || a.nombre === "comparar_productos") && Array.isArray(x.codigos) && x.codigos.length >= 2)
    return {nombre: !pregunta || QUIERE_COMPARAR.test(norm(pregunta)) ? "comparar_productos" : "mostrar_productos", args: x};   // tabla solo si pidió comparar
  if (a.nombre === "cambiar_cantidad" && /^(todos?|all|\*)$/i.test(String(x.codigo || "").trim())) return {nombre: "vaciar_pedido", args: {}};
  if (a.nombre === "abrir_pantalla"){
    const nombre = {pedido_actual: "ver_pedido", ficha_producto: "abrir_producto", catalogo: "ver_catalogo", favoritos: "ver_favoritos", pedidos_enviados: "mis_pedidos"}[x.pantalla || (x.codigo ? "ficha_producto" : "catalogo")];
    return nombre ? {nombre, args: x} : a;
  }
  return a;
}
function ejecutarAccionChat(accion){
  const f = ACCIONES_CHAT[accion?.nombre];
  if (!f) return;
  medir("chat-accion", {nombre: accion.nombre});
  try { f(accion.args || {}); } catch(e) {}
}

// El modelo "lite" a veces escribe los códigos en vez de mostrar las tarjetas, anuncia "mira estas
// opciones 👇" sin mostrarlas, o deja notas técnicas: la página lo corrige sola.
const NOMBRES_HERRAMIENTAS = new RegExp(`\\b(${[...new Set([...HERRAMIENTAS_CHAT.map(h => h.name), ...Object.keys(ACCIONES_CHAT)])].join("|")})\\b`);
const codigosEn = t => [...new Set((t.match(/[A-Za-z0-9][A-Za-z0-9.\-]{3,}/g) || []).map(c => c.replace(/\.+$/, "")).filter(c => /[\d.\-]/.test(c) && buscar(c)))];
const LLAMADA_ESCRITA = new RegExp(`(?:call:)?(?:default_api:)?\\b(${[...new Set([...HERRAMIENTAS_CHAT.map(h => h.name), ...Object.keys(ACCIONES_CHAT)])].join("|")})\\b\\s*[({][^\\n]*`, "g");
function limpiarTexto(t){
  for (const c of codigosEn(t)) t = t.split(c).join("");
  t = t.replace(LLAMADA_ESCRITA, "");   // la IA a veces escribe la llamada como texto en vez de hacerla
  t = t.split("\n").filter(l => !NOMBRES_HERRAMIENTAS.test(l)).join("\n")
    .replace(/[\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u0e00-\u0eff\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, "")
    .replace(/[*_]*\(?\s*nota (interna|t[eé]cnica|para el sistema|del sistema)[^\n]*/gi, "")
    .replace(/\(\s*(c[oó]digo:?)?\s*\)/gi, "").replace(/\(\s*(le|te) (mostr|dej|di)[^)]*\)/gi, "").replace(/^[\s.*·•_\-–—]+$/gm, "").replace(/^[ \t]*[-*•][ \t]*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  // Dos frases seguidas de "mira estas opciones 👇": queda la primera.
  const ps = t.split(/\n{2,}/);
  if (ps.filter(p => p.includes("👇")).length > 1)
    t = ps.filter((p, i) => !(i > 0 && p.includes("👇") && p.length < 45 && ps.slice(0, i).some(x => x.includes("👇")))).join("\n\n");
  return t;
}
// No se saluda con «¡Hola!» a quien no saludó.
function sinSaludo(t, pregunta){
  if (/\b(hola|buen(as|os)|saludos|hey|que tal)\b/.test(norm(pregunta))) return t;
  const r = t.replace(/^\s*¡?hola!?[\s\p{Extended_Pictographic}️,.:;-]*/iu, "");
  return r && r !== t ? r.charAt(0).toUpperCase() + r.slice(1) : t;
}
// Lo que se cuenta como "mostrar algo" (si la IA hizo una de estas, no hace falta poner tarjetas de respaldo).
const VISUALES = ["mostrar_productos", "comparar_productos", "agregar_al_pedido", "cambiar_cantidad", "vaciar_pedido", "abrir_producto", "ver_catalogo", "datos_del_pedido",
  "ver_pedido", "ver_favoritos", "mis_pedidos", "repetir_pedido", "compartir_producto", "instalar_app", "como_llegar", "ofrecer_opciones", "avisar_llegada"];
const PROMETE_MOSTRAR = /👇|\b(mira|miren|te dejo|aqui (tienes|estan)|estas opciones|estos productos)\b/;
// Lo que el cliente quiso buscar, tal como lo escribió ("¿tienen el GTA 6?" → "GTA 6").
// Lo que la tienda no publicó: la respuesta es fija (la IA lo inventaba: "no hacemos cambios", "todos son originales…").
const POLITICAS = [
  ["garantia", /\b(garantia|garantizad\w*)\b/, "La garantía no está publicada en la web y puede cambiar según el producto; te la confirman por WhatsApp."],
  ["plazo", /\b(cuanto (demora|demoran|tardan|tarda)|en cuanto tiempo|tiempo de (preparacion|entrega|espera))\b.{0,40}\b(pedido|retiro|retirar|listo|entrega)\b|\bcuando (puedo|podria) retirar\b/, "Al enviar el pedido por WhatsApp te confirman la disponibilidad y cuándo puedes retirarlo."],
  ["cuotas", /\b(cuotas?|credito|financ\w*|abonos?|a plazos?|diferid\w*)\b/, "No tengo confirmado si hay cuotas o crédito; eso lo confirman por WhatsApp."],
  ["apartar", /\b(apart(ar|ado|ados|arlo|arla|arme|an|amos)|reserv\w*|separ(ar|arme|arlo|arla)|guard(ar|arme|arlo|arla|an|en)\b.{0,30}\b(pedido|consola|juego|producto|control|hasta))\b/, "Los pedidos se confirman por WhatsApp; si se puede apartar o guardar algo, te lo confirman ahí."],
  ["usados", /\b(permut\w*|trueque|parte de pago)\b|\b(compran|reciben|aceptan|toman|cambian|cambio|cambios)\b.{0,40}\b(usad\w*|segunda mano|medio uso)\b|\b(cambio|cambios|cambian)\b.{0,25}\b(juegos?|consolas?|controles?|palancas?)\b/, "No tengo confirmado si reciben usados, hacen cambios o permutas; eso lo confirman por WhatsApp."],
  ["descuento", /\b(descuentos?|rebajas?|regateo|negociar|mejor precio|ultimo precio|hacen precio)\b/, "Los descuentos los confirman por WhatsApp. Ojo: pagando en efectivo o transferencia el precio suele ser menor que con tarjeta."],
  ["factura", /\b(factura\w*|ruc|comprobante)\b/, "Si necesitas factura con tus datos, eso lo coordinan por WhatsApp."],
  ["devolucion", /\b(devol\w*|reembols\w*|reclamo\w*)\b/, "Las devoluciones y reclamos los atienden por WhatsApp."],
  ["feriados", /\b(feriado\w*|festivo\w*|navidad|fin de ano|carnaval|semana santa)\b/, () => `Normalmente atendemos: ${horarioTexto()} El horario en feriados no está publicado: confírmalo por WhatsApp.`],
  ["medio-uso", /\b(medio uso|usad\w*|segunda mano)\b.{0,30}\b(funcion\w*|probad\w*|garant\w*|sirven|andan|estado)\b|\b(funcion\w*|sirven|andan)\b.{0,20}\b(medio uso|usad\w*)\b/, "Los productos de medio uso están marcados así en su ficha. Su estado, si funcionan bien y su garantía te los confirman por WhatsApp."],
  ["envios", /\b(envios?|envian|enviarian|delivery|a domicilio|domicilio|despach\w*|courier|servientrega|mandan (a|hasta|para))\b/, () => `Los pedidos se retiran en nuestros locales (${Object.values(CONFIG.locales).map(L => L.nombre).join(", ")}). Si necesitas que te lo envíen, pregúntalo por WhatsApp y te confirman si se puede.`],
  ["originales", /\b(son|es)\b.{0,12}\b(original\w*|autentic\w*|pirat\w*|sellad\w*|probad\w*)\b/, "En cada producto se indica si es de medio uso y, en controles y accesorios, si es original o genérico. De uno en concreto, pregúntalo por WhatsApp.", "sin-producto"],
];
function respuestaPolitica(texto){
  const t = norm(texto).replace(/tarjetas? de (credito|debito)/g, "tarjeta"), c = analizarConsulta(texto);   // "tarjeta de crédito" es una forma de pago, no un crédito
  if (c.servicio || c.plat || productosNombrados(texto, PRODUCTS.map(p => p.code)).length) return null;   // si nombra una consola o un producto, o pide reparación, responde la IA
  const p = POLITICAS.find(([, re, , solo]) => re.test(t) && (solo !== "sin-producto" || !c.plat));
  return p ? {tema: p[0], texto: typeof p[2] === "function" ? p[2]() : p[2]} : null;
}
// "¿Cuánto es todo?": el total lo calcula la página (la IA a veces suma mal o suma cosas que no están en el pedido).
function respuestaTotal(texto){
  const q = norm(texto), c = analizarConsulta(texto);
  const deProducto = c.palabras.filter(w => !/^(total|suma|junto|juntos)$/.test(w) && PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))));
  if (c.plat || c.cat || deProducto.length) return null;
  const trasPedido = /\bpedido\b/.test(norm([...CHAT.mensajes].reverse().find(m => m.rol === "mascota" && m.texto)?.texto || "")) &&
    /^\s*(y )?(cuanto (es|seria|sale|queda|me sale|pago|debo|te debo)|y cuanto)\b[^a-z]*$/.test(q);   // "¿cuánto es?" justo después de agregar
  if (!trasPedido && (!/\b(cuanto|total|suma|sumame)\b/.test(q) || !/\b(todo|total|pedido|carrito|suma|cuenta)\b/.test(q))) return null;
  if (!unidades()) return {tema: "total", texto: "Tu pedido todavía está vacío 🛒 Cuéntame qué buscas y lo agregamos.", sinBoton: true};
  const ls = lineas(), ef = totalPedido("efectivo"), tj = totalPedido("tarjeta");
  const detalle = ls.map(({p, q}) => `- ${q > 1 ? q + " x " : ""}${p.name}: ${fmt(precio(p, "efectivo") * q)}`).join("\n");
  return {tema: "total", texto: `Tu pedido suma **${fmt(ef)}** en efectivo o transferencia` + (tj > ef ? ` (${fmt(tj)} con tarjeta)` : "") + `:\n${detalle}`,
    botones: [{texto: "Ver mi pedido", accion: "ver-pedido"}]};
}
// Servicio técnico: siempre se hace (consolas y palancas de PlayStation, Nintendo y Xbox, en los 3 locales); el precio y
// el tiempo dependen de la revisión, así que se cotiza por WhatsApp. Respuesta fija para que la IA no invente "no hacemos eso".
const EQUIPO_CHAT = /\b(ps[1-5]|playstation|play|xbox|switch\d?|nintendo|control\w*|palanca\w*|joy ?cons?|dualsense|dualshock|consolas?|psp|wii|portatil|r36\w*|oculus|portal)\b/;
function respuestaServicio(texto){
  const c = analizarConsulta(texto), q = norm(texto);
  // Justo antes se habló de servicio técnico: "es la OLED", "cuánto demoran", "cuánto me cobran" siguen siendo de eso.
  const siguiendo = CHAT.ultimoTema === "servicio" && !c.quiere && !c.max && /\b(cuanto|demora\w*|tarda\w*|tiempo|cobra\w*|precio|costo|es (la|el|una|un)|es de|modelo|version|oled|lite|slim|pro|normal|original|generic\w*)\b|^\s*(es|son|la|el|una|un|mi)\b/.test(q);
  if ((!c.servicio && !siguiendo) || /\b(venden|vendes|comprar|repuestos?)\b/.test(q)) return null;
  // Lo que ya contó antes (equipo y falla) también va en el mensaje de WhatsApp.
  const antes = CHAT.mensajes.filter(m => m.rol === "usuario" && m.texto && m.texto !== texto).slice(-3).map(m => m.texto)
    .filter(t => analizarConsulta(t).servicio || EQUIPO_CHAT.test(norm(t)));
  const todo = [...antes, texto].join(". ");
  const conDetalle = EQUIPO_CHAT.test(norm(todo)) && (antes.length || !/^\s*(necesito|quiero|busco|hacen|tienen|dan|ofrecen)?\s*(el |un )?(servicio tecnico|mantenimiento|reparacion\w*)\s*\??\s*$/.test(norm(texto)));
  const wa = `Hola ${CONFIG.storeName}, quisiera cotizar un servicio técnico: ${todo}`.slice(0, 600);
  return conDetalle
    ? {tema: "servicio", texto: "Sí, eso lo revisamos en nuestro servicio técnico 🔧 Recibimos consolas y palancas de PlayStation, Nintendo y Xbox en los 3 locales. El precio y el tiempo dependen de la revisión, así que te lo cotizan por WhatsApp. Te dejo el mensaje listo 👇", wa, boton: "Cotizar por WhatsApp"}
    : {tema: "servicio", texto: "¡Claro! Hacemos servicio técnico de consolas y palancas (PlayStation, Nintendo y Xbox) y lo recibimos en los 3 locales 🔧 ¿Qué equipo es y qué le pasa? También puedes escribirnos directo 👇", wa, boton: "Cotizar por WhatsApp"};
}
const nombreBonito = p => p.name.toLowerCase().replace(/\s+/g, " ").replace(/-c$/, "").trim().split(" ").map((w, i) =>
  /\d/.test(w) || /^(fc|gta|nba|ufc|tcg|vr|hd|rgb|usb|pc|ii|iii|iv|vi|vii|xvi|dj|ea|nes|snes|psp|oled|sup|tv|x|z|ps)$/.test(w) ? w.toUpperCase()
    : i && /^(de|del|con|para|y|o|of|the|la|el|los|las|por|en|a)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
// "¿La tienen en Scala?", "¿en qué local está el Mario Kart?": el stock por local sale del inventario, sin IA.
function respuestaStock(texto){
  const q = norm(texto);
  const Ls = Object.entries(CONFIG.locales);
  const local = Ls.find(([k, L]) => q.includes(k) || q.includes(norm(L.nombre)) || (k === "valle" && /\bel valle\b/.test(q)));
  const preguntaLocal = /\b(en (que|cual|cuales) (local|locales|tienda|tiendas|centro comercial|isla)|donde (hay|esta|estan|lo|la|los|las|tienen|encuentro|consigo|queda)|que locales? (tiene|tienen|hay))\b/.test(q);
  const preguntaHay = /\b(hay|tienen|tienes|stock|disponible|queda|quedan|esta|estan|lo tienen|la tienen|habra)\b/.test(q);
  if (!(preguntaLocal || (local && preguntaHay)) || datosEnMensaje(texto) || /\b(retir|recoj|recog|pag)\w*\b/.test(q)) return null;
  // ¿De qué producto? El que nombra (si es uno solo) o, si dice "la/lo", el último que se le mostró.
  const c = analizarConsulta(texto);
  let p = null;
  if (c.palabras.filter(w => !/^switch2?$/.test(w)).length || c.plat || c.cat){
    const r = buscarParaChat(texto, null);
    if (r.sinCoincidencia || !r.lista.length || r.empates !== 1) return null;
    p = r.lista[0];
  } else if (/\b(la|lo|las|los) (tienen|tienes|hay|encuentro|consigo|venden)\b|\b(esa|ese|esas|esos|esta|este)\b|^\s*(y )?en (el |la )?(scala|condado|valle|plaza)/.test(q)) p = productoEnFoco();
  if (!p || p.digital) return null;
  const hayEn = Ls.filter(([k]) => p.stock?.[k] > 0);
  const n = k => `${p.stock[k]} ${p.stock[k] === 1 ? "unidad" : "unidades"}`;
  let txt;
  if (!hayEn.length) txt = `${nombreBonito(p)} está agotado por ahora en los 3 locales 😕`;
  else if (local) txt = p.stock?.[local[0]] > 0 ? `Sí ✅ En **${local[1].nombre}** hay ${n(local[0])} de ${nombreBonito(p)}.`
    : `En **${local[1].nombre}** no hay ${nombreBonito(p)} ahora 😕 Sí hay en ${hayEn.map(([k, L]) => `**${L.nombre}** (${n(k)})`).join(" y ")}.`;
  else txt = `${nombreBonito(p)} hay en ${hayEn.map(([k, L]) => `**${L.nombre}** (${n(k)})`).join(", ").replace(/, ([^,]*)$/, " y $1")}.`;
  return {tema: "stock-local", texto: txt + " El stock se actualiza cada 15 minutos 👇", acciones: [{nombre: "mostrar_productos", args: {codigos: [p.code]}}]};
}
// "¿Cuánto cuesta esa?", "¿y con tarjeta?": el precio del producto del que se está hablando.
function respuestaFoco(texto){
  const q = norm(texto), c = analizarConsulta(texto);
  const deProducto = c.palabras.filter(w => PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))));
  if (deProducto.length || c.plat || c.cat || c.servicio) return null;
  const pidePrecio = /\b(cuanto (cuesta|vale|sale|esta)|que precio|precio|a como|a cuanto)\b/.test(q) && /\b(esa|ese|eso|esta|este|la|lo|el|ella|ellos|ese juego|esa consola|ese control)\b|^\s*(y )?(cuanto( cuesta| vale| sale| esta| es)?|que precio( tiene)?|precio|a como|a cuanto)\b[^a-z]*$/.test(q);
  const modo = /^\s*(y )?(con|en|pagando con|si pago con|y si pago con|por) (tarjeta|efectivo|transferencia)\b[\s?¿!.]*$/.exec(q);
  if (!pidePrecio && !modo) return null;
  const p = productoEnFoco();
  if (!p) return null;
  const ef = precio(p, "efectivo"), tj = precio(p, "tarjeta");
  const txt = modo && modo[3] === "tarjeta" ? `Con tarjeta, ${nombreBonito(p)} cuesta **${fmt(tj)}**` + (tj > ef ? ` (en efectivo o transferencia: ${fmt(ef)}).` : ".")
    : `${nombreBonito(p)} cuesta **${fmt(ef)}** en efectivo o transferencia` + (tj > ef ? ` (${fmt(tj)} con tarjeta).` : ".");
  return {tema: "precio", texto: txt + " 👇", acciones: [{nombre: "mostrar_productos", args: {codigos: [p.code]}}]};
}
// Ubicación, horario y contacto de la tienda: datos fijos, sin IA (así nunca se equivoca de dirección u hora).
function respuestaTienda(texto){
  const q = norm(texto), c = analizarConsulta(texto);
  const deProducto = c.palabras.filter(w => PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))));
  if (c.servicio || c.plat || c.cat || deProducto.length || c.max != null) return null;
  const ubic = /\b(donde (estan|queda|quedan|esta|los encuentro|ubico|puedo retirar|retiro)|ubicad\w*|ubicacion\w*|direccion\w*|como (llego|llegar|voy|ir)|sucursal\w*|mapa|en que (centro comercial|mall|parte))\b|\b(sus|los|cuales son los) locales\b/.test(q);
  const hora = /\b(a que hora|horarios?|hora de (atencion|apertura|cierre)|abren|abierto\w*|cierran|cierra|atienden|atencion)\b/.test(q);
  const contacto = /\b(whatsapp|wasap|wsp|numero|telefono|contacto|llamar|instagram|redes|facebook|tiktok)\b/.test(q) && !/\b(pedido|envi\w*|mand\w*)\b/.test(q);
  if (!ubic && !hora && !contacto) return null;
  const Ls = Object.entries(CONFIG.locales), nombrado = Ls.filter(([k, L]) => q.includes(k) || q.includes(norm(L.nombre)) || q.includes(norm(L.zona)));
  const partes = [], acciones = [];
  if (ubic){
    const cuales = nombrado.length ? nombrado : Ls;
    partes.push(cuales.length === 1 ? `Estamos en **${cuales[0][1].nombre}** (${cuales[0][1].zona}${cuales[0][1].detalle ? ", " + cuales[0][1].detalle : ""}). Te dejo cómo llegar 👇`
      : `Tenemos ${cuales.length} locales:\n` + cuales.map(([, L]) => `- **${L.nombre}** (${L.zona}${L.detalle ? ", " + L.detalle : ""})`).join("\n"));
    for (const [k] of cuales) acciones.push({nombre: "como_llegar", args: {local: k}});
  }
  if (hora || ubic) partes.push(`Atendemos de ${horarioTexto().replace(/^Lunes/, "lunes").replace(/\.$/, "")} (los 3 locales). Ahora: ${estadoTienda().txt.toLowerCase()}.`);
  if (contacto){
    const w = CONFIG.whatsapp.replace(/^593(\d{2})(\d{3})(\d{4})$/, "+593 $1 $2 $3");
    partes.push(`Nuestro WhatsApp es **${w}** y en Instagram somos **@electronicgamesec**.`);
  }
  return {tema: ubic ? "ubicacion" : hora ? "horario" : "contacto", texto: partes.join("\n\n"), acciones: acciones.length ? acciones : null, sinBoton: !contacto && !acciones.length};
}
function nombreBuscado(p){
  return String(p || "").replace(/[¿?¡!]/g, " ").replace(/^\s*(hola|buen[oa]s?( tardes| dias| noches)?|disculpa|oye)[\s,.:]*/i, "")
    .replace(/^\s*(me (pueden|podrian|puedes)\s+)?(tienen|tienes|tendran|hay|venden|vendes|busco|buscando|quiero|quisiera|necesito|consigo|conseguir)\s+(el|la|los|las|un|una|unos|unas|de|del)?\s*/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 60);
}
// Nombre sin las palabras que se repiten en todos ("JUEGO NINTENDO SWITCH SUPER MARIO RPG" → "super mario rpg").
const NOMBRE_COMUN = /\b(juego|consola|palanca|control|nintendo|switch|swicth|ps[1-5]|playstation|xbox|pc|medio uso|usado|original|generico|c)\b/g;
const NOMBRE_GENERICO = /^(normal|edicion|edition|version|color|caja|con|para|the|and|del|las|los|varios|variados|disenos|modelos|pack|incluido|unidad|por|day|one|nuevo|nueva|gb|tb|128gb|500gb|1tb|512gb)$/;
const nombreCorto = p => norm(p.name).replace(NOMBRE_COMUN, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Productos que el texto de la IA menciona por su nombre, en el orden en que los menciona.
function productosNombrados(t, codigos){
  const T = norm(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " "), Tn = T.replace(/ /g, "");
  const hits = [];
  for (const c of codigos){
    const p = buscar(c); if (!p) continue;
    const n = nombreCorto(p), nn = n.replace(/ /g, ""), pal = n.split(" ");
    if (nn.length >= 6 && Tn.includes(nn)){ hits.push({p, i: Tn.indexOf(nn)}); continue; }
    if (n.length >= 4 && /\d/.test(n) && (" " + T + " ").includes(" " + n + " ")){ hits.push({p, i: T.indexOf(n)}); continue; }   // "FC 27", "F1 25"
    // "Crash Bandicoot 4" por "Crash Bandicoot 4 It's About Time": al menos las 3 primeras palabras
    let ya = false;
    for (let k = pal.length - 1; k >= 3; k--){
      const pre = " " + pal.slice(0, k).join(" ") + " ";
      if (pre.length >= 12 && (" " + T + " ").includes(pre)){ hits.push({p, i: (" " + T + " ").indexOf(pre)}); ya = true; break; }
    }
    if (ya) continue;
    // "Mario Kart 8 Deluxe" o "PS5 Slim con disco": todas sus palabras propias (2 o más) están en el texto.
    const propias = pal.filter(w => w.length >= 3 && !NOMBRE_GENERICO.test(w));
    if (propias.length >= 2 && propias.every(w => (" " + T + " ").includes(" " + w + " "))){ hits.push({p, i: T.indexOf(propias[0])}); continue; }
    // Consolas que se nombran casi solo con la marca: "Nintendo Switch 2", "Xbox Series X".
    if (p.cat === "consolas"){
      const ws = norm(p.name).replace(/^consola\s+/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ");
      for (let k = ws.length; k >= 3; k--){
        const pre = " " + ws.slice(0, k).join(" ") + " ";
        if (pre.length >= 9 && (" " + T + " ").includes(pre)){ hits.push({p, i: (" " + T + " ").indexOf(pre)}); break; }
      }
    }
  }
  return unicos(hits.sort((a, b) => a.i - b.i).map(h => h.p));
}
// El producto del que se está hablando: el de la última tarjeta (si era una sola) o el único que nombró la mascota al mostrarlas.
function productoEnFoco(){
  const ms = CHAT.mensajes;
  for (let i = ms.length - 1; i >= 0; i--){
    const m = ms[i];
    if (m.rol !== "mascota" || !(m.productos || m.comparar)) continue;
    const ls = unicos((m.productos || m.comparar).map(buscar).filter(Boolean));
    if (ls.length === 1) return ls[0];
    for (let j = i - 1; j >= 0 && ms[j].rol === "mascota"; j--)
      if (ms[j].texto){
        let n = productosNombrados(ms[j].texto, ls.map(p => p.code));
        if (n.length > 1){ const conPrecio = n.filter(p => ms[j].texto.includes(fmt(precio(p, "efectivo")))); if (conPrecio.length) n = conPrecio; }
        return n.length === 1 ? n[0] : null;
      }
    return null;
  }
  return null;
}
// El producto del que se habla va primero en las tarjetas.
function mostrarPrimero(hacer, code){
  const m = hacer.find(a => a.nombre === "mostrar_productos");
  if (m && Array.isArray(m.args?.codigos)) m.args.codigos = [code, ...m.args.codigos.filter(c => c !== code)];
}
// Si pidió una consola ("para PS5"), las tarjetas son de esa consola: se quitan las de otra (si quedan otras).
function deLaConsola(codigos){
  const plat = CHAT.platPedida;
  if (!plat || !Array.isArray(codigos)) return codigos;
  const ok = codigos.filter(c => { const p = buscar(c); return p && (!plataformasDe(p).length || plataformasDe(p).includes(plat)); });
  return ok.length ? ok : codigos;
}
// Qué producto del pedido nombra el mensaje ("quita el mario kart"); con "quítalo" o si hay uno solo, el último agregado.
function productoDelPedido(pregunta){
  const enPedido = lineas().map(l => l.p);
  if (!enPedido.length) return null;
  // Solo cuentan las palabras que están en algún producto ("ponle", "sean"… no).
  const pal = analizarConsulta(pregunta).palabras.filter(w => w.length >= 3 && !/^(otr[oa]s?|igual|mas|uno|una|dos|tres|todo|todos)$/.test(w) &&
    PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))));
  const puntos = enPedido.map(p => ({p, n: pal.filter(w => variantes(w).some(v => textoBusqueda(p).includes(v))).length}));
  const mejor = Math.max(0, ...puntos.map(x => x.n));
  if (mejor > 0){ const top = puntos.filter(x => x.n === mejor); return top.length === 1 ? top[0].p : null; }
  // "que sean dos del control": por la categoría o la consola que nombra.
  const c = analizarConsulta(pregunta);
  if (c.cat || c.plat){
    const f = enPedido.filter(p => (!c.cat || p.cat === c.cat) && (!c.plat || plataformasDe(p).includes(c.plat)));
    if (f.length === 1) return f[0];
    if (f.length > 1) return null;
  }
  const q = norm(pregunta);
  if (pal.length && !/\b\w+(lo|la|los|las)\b/.test(q)) return null;   // nombró algo que no está en el pedido
  return enPedido.length === 1 || /\b\w+(lo|la)\b|\b(ese|esa|eso|el ultimo|la ultima)\b/.test(q) ? buscar([...PEDIDO.items.keys()].pop()) : null;
}
const NUMEROS_CHAT = {un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10};
function cantidadPedida(q){
  const m = /\b(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b(?!\s*(dolares|usd|anos|horas|\$))/.exec(q.replace(/\bps ?\d\b|\bswitch ?2\b|\bfc ?\d+\b|\b(play|xbox) ?\w*\b/g, " "));
  return m ? (NUMEROS_CHAT[m[1]] ?? parseInt(m[1], 10)) : null;
}
// "Retiro en Scala", "pago con tarjeta", "a nombre de Ana Torres".
function datosEnMensaje(texto){
  const q = norm(texto), d = {};
  if (/\b(retir\w*|recoj\w*|recog\w*|paso|pasare|pasar|voy|ire|ir|buscar|busco)\b/.test(q))
    for (const [k, L] of Object.entries(CONFIG.locales))
      if (q.includes(k) || q.includes(norm(L.nombre)) || (k === "valle" && /\b(el valle|plaza del valle|san rafael)\b/.test(q))){ d.local = k; break; }
  const pago = /\b(pag\w*|cancel\w*|abon\w*)\b.{0,30}\b(tarjeta|efectivo|transferencia|deposito)\b/.exec(q);
  if (pago && !/\?|\b(se puede|puedo|aceptan|reciben|hay|tienen|cuanto|precio|sale|cuesta|vale|seria)\b/.test(norm(texto).replace(/[¿]/g, "")) && !/\?/.test(texto)) d.pago = pago[2] === "deposito" ? "transferencia" : pago[2];
  const nom = /\ba nombre de\s+([A-Za-zÁÉÍÓÚÑáéíóúñü][A-Za-zÁÉÍÓÚÑáéíóúñü' ]{1,50})/.exec(texto);
  if (nom) d.nombre = nom[1].replace(/\s+(y|para|que|por favor|porfa)\b.*$/i, "").trim();
  return Object.keys(d).length ? d : null;
}
function completarAcciones(t, acciones, pregunta){
  const hay = n => acciones.some(a => n.includes(a.nombre));
  let quitarNada = false;
  // Lo que pidió el cliente, aunque la IA no haya usado la función.
  const q = norm(pregunta);
  if (!hay(["ver_pedido"]) && unidades() && /\b(termin|finaliz|envi|mand|complet|cerr|revis)\w*\b.{0,20}\bpedido\b|\bver (mi )?pedido\b|\bquiero pagar( ya)?$/.test(q))
    acciones.push({nombre: "ver_pedido", args: {}});
  if (!hay(["vaciar_pedido", "cambiar_cantidad"]) && unidades() && /\b(vaci|borr|elimin|quit|limpi|cancel)\w*( me| le)? (todo( (el|mi) (pedido|carrito))?|(el|mi) (pedido|carrito))(?=$|\s+(por favor|porfa|porfavor|ya)\b)/.test(q))
    acciones.push({nombre: "vaciar_pedido", args: {}});
  // Quitar algo o cambiar cuántos lleva: la IA a veces contesta "ya lo quité" sin hacerlo, así que la página lo hace.
  if (unidades() && !hay(["vaciar_pedido", "cambiar_cantidad"])){
    const cual = productoDelPedido(pregunta);
    const quitar = /\b(quit\w*|sac(a|ame|alo|ala|alos|ar)|elimin\w*|borr\w*|cancel\w*|ya no (lo |la )?(quiero|necesito|me interesa))\b/.test(q);
    const n = cantidadPedida(q);
    if (cual && quitar) acciones.push({nombre: "cambiar_cantidad", args: {codigo: cual.code, cantidad: 0}});
    else if (quitar && !cual && analizarConsulta(pregunta).palabras.some(w => PRODUCTS.some(p => variantes(w).some(v => textoBusqueda(p).includes(v))))) quitarNada = true;   // "quita el zelda" y no está
    else if (hay(["agregar_al_pedido"])) {}
    else if (cual && n != null && /\b(ponle|ponme|pon|que sean|cambi\w*|dej\w*|sub\w*|baj\w*|mejor|solo|nada mas)\b/.test(q) && !/\b(dolares|usd|\$)\b/.test(q))
      acciones.push({nombre: "cambiar_cantidad", args: {codigo: cual.code, cantidad: n}});
    else if (/\b(otr[oa]|uno mas|una mas|otro igual|otra igual)\b/.test(q) && /\b(agreg\w*|anad\w*|pon\w*|quiero|dame|mete\w*)\b/.test(q) && !analizarConsulta(pregunta).palabras.filter(w => !/^(otr[oa]s?|igual|mas|uno|una)$/.test(w)).length){
      const ult = [...PEDIDO.items.keys()].pop();
      if (ult) acciones.push({nombre: "agregar_al_pedido", args: {codigo: ult, cantidad: 1}});
    }
  }
  // "Agrégalo" / "quiero el segundo": se agrega lo que se le acaba de mostrar (si es uno solo, o el que dice por su orden).
  if (!hay(["agregar_al_pedido", "cambiar_cantidad", "vaciar_pedido"])){
    const pronombre = /\b(agreg(a|ame|ale)?(lo|la|los|las)|agregamel[oa]|anade(lo|la)|anademel[oa]|pon(lo|la|melo|mela)|me (lo|la) llevo|(lo|la) (quiero|llevo|compro))\b/.test(q) ||
      /^\s*(agrega|agregame|anade|pon|ponme|dame|quiero)\s+(\d+|dos|tres|cuatro|cinco)\s*$/.test(q);   // "agrega dos"
    const orden = /\b(el|la) (primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|ultim[oa])\b/.exec(q);
    if (pronombre || (orden && /\b(agreg|anad|pon|quiero|llevo|compr|dame)\w*/.test(q))){
      const ult = [...CHAT.mensajes].reverse().find(m => m.rol === "mascota" && (m.productos || m.comparar));
      const ls = unicos(ult ? (ult.productos || ult.comparar).map(buscar).filter(Boolean) : []);
      const pos = orden ? {primer: 0, primero: 0, primera: 0, segundo: 1, segunda: 1, tercer: 2, tercero: 2, tercera: 2, cuarto: 3, cuarta: 3, ultimo: ls.length - 1, ultima: ls.length - 1}[orden[2]] : (ls.length === 1 ? 0 : -1);
      const p = pos >= 0 ? ls[pos] : (!orden ? productoEnFoco() : null);
      if (p && maxQty(p)) acciones.push({nombre: "agregar_al_pedido", args: {codigo: p.code, cantidad: cantidadPedida(q.replace(orden?.[0] || "", "")) || 1}});
    }
  }
  // Dice "lo agregué" pero no llamó a la función: si pidió agregar y el texto nombra un solo producto, se agrega ese.
  if (!hay(["agregar_al_pedido", "cambiar_cantidad"]) && !CHAT.ambiguo && /\b(agregu[eé]|añad[ií]|agregad[oa]|añadid[oa]|lo puse|la puse)\b/i.test(t) && /\b(agreg|anad|pon|ponme|ponle|quiero|llevo|dame|mete|compr)\w*\b/.test(q)){
    const ns = productosNombrados(t, CHAT.candidatos || []);
    if (ns.length === 1 && maxQty(ns[0])) acciones.push({nombre: "agregar_al_pedido", args: {codigo: ns[0].code, cantidad: cantidadPedida(q) || 1}});
  }
  const pideAgregar = /^\s*(ok |si |bueno |dale |listo |entonces )?(agreg\w*|anad\w*|pon(me|le)?|mete(me)?|quiero comprar|me llevo|lo llevo|la llevo|separame|carga(me)?|quiero (\d+|dos|tres|cuatro|cinco))\b/.test(q) && !/\b(agreg|anad|pon|met)\w*(lo|la|los|las)\b/.test(q);
  if ((CHAT.agregarImplicito || (pideAgregar && CHAT.buscaEspecifico)) && !hay(["agregar_al_pedido", "cambiar_cantidad"]) && !CHAT.ambiguo && CHAT.empates === 1 && CHAT.ultimaBusqueda?.length && !CHAT.noEncontrado){
    const p = buscar(CHAT.ultimaBusqueda[0]);
    if (p && maxQty(p) && !PEDIDO.items.has(p.code)) acciones = [{nombre: "agregar_al_pedido", args: {codigo: p.code, cantidad: cantidadPedida(q) || 1}}, ...acciones.filter(a => a.nombre !== "mostrar_productos")];
  }
  // Dónde retira, cómo paga y a nombre de quién: si lo dijo y la IA no lo anotó, se anota.
  if (!hay(["datos_del_pedido"])){
    const d = datosEnMensaje(pregunta);
    if (d) acciones.push({nombre: "datos_del_pedido", args: d});
  }
  if (!hay(["mis_pedidos", "repetir_pedido", "preparar_whatsapp"]) && leerPedidos().length &&
      /\b(mis pedidos|pedidos? (anterior|pasad|enviad)\w*|pedido que (hice|envie|mande)|(mi )?ultimo pedido|como va (mi|el) pedido|volver a pedir|repet\w* (mi |el )?pedido)\b/.test(q))
    acciones.push({nombre: "mis_pedidos", args: {}});
  if (!hay(["ver_favoritos"]) && /\bmis favoritos\b/.test(q)) acciones.push({nombre: "ver_favoritos", args: {}});
  if (!hay(["instalar_app"]) && /\b(instal\w* (la )?(app|aplicacion|pagina|tienda)|(la|una|su|como) (app|aplicacion)|pantalla de inicio)\b/.test(q))
    acciones.push({nombre: "instalar_app", args: {}});
  // Escribió los botones como texto en vez de mostrarlos ("ofrecer_opciones{opciones:[a,b]}" o "(Le di a elegir: a / b)").
  if (!hay(["ofrecer_opciones"])){
    const escrita = /ofrecer_opciones\s*\{\s*opciones\s*:\s*\[([^\]]*)\]/i.exec(t), imitado = /\(\s*le di a elegir:\s*([^)]+)\)/i.exec(t);
    if (escrita) acciones.push({nombre: "ofrecer_opciones", args: {opciones: escrita[1].split(",").map(o => o.replace(/^["'\s]+|["'\s]+$/g, ""))}});
    else if (imitado) acciones.push({nombre: "ofrecer_opciones", args: {opciones: imitado[1].split("/")}});
  }
  if (!hay(["como_llegar"]) && /\b(como (llego|llegar|voy)|ubicacion|ubicados?|donde (queda|quedan|esta|estan)|direccion|mapa)\b/.test(q)){
    const nombrados = Object.entries(CONFIG.locales).filter(([k, L]) => q.includes(k) || q.includes(norm(L.zona)) || q.includes(norm(L.nombre).split(" ")[0]));
    for (const [k] of nombrados.length ? nombrados : Object.entries(CONFIG.locales)) acciones.push({nombre: "como_llegar", args: {local: k}});
  }
  // Tarjetas de respaldo: solo si la IA no mostró nada y (está buscando productos o prometió mostrarlos).
  const diceQueNoHay = /\bno (contamos|tenemos|manejamos|hay|encontr\w+|disponemos|esta(n)? disponibles?|lo (tenemos|manejamos)|llego|llegaron)\b/.test(norm(t));
  if (!hay(VISUALES)){
    const codigos = codigosEn(t);
    const nombrados = productosNombrados(t, CHAT.candidatos || []);
    const promete = PROMETE_MOSTRAR.test(norm(t).split("\n").filter(l => !/\b(boton|whatsapp|mapa|enlace)\b/.test(l)).join("\n"));
    if (codigos.length) acciones.unshift({nombre: "mostrar_productos", args: {codigos}});
    else if (CHAT.comparacion?.length >= 2) acciones.unshift({nombre: "comparar_productos", args: {codigos: CHAT.comparacion}});   // "¿PS5 o Xbox?": la tabla con las dos
    else if (nombrados.length) acciones.unshift({nombre: "mostrar_productos", args: {codigos: deLaConsola(nombrados.map(p => p.code)).slice(0, 6)}});
    else if (CHAT.ultimaBusqueda?.length && (promete || (CHAT.intencionProducto && !CHAT.esReferencia && (!diceQueNoHay || CHAT.esOferta)))) acciones.unshift({nombre: "mostrar_productos", args: {codigos: CHAT.ultimaBusqueda}});
  }
  // "¿Cuál es mejor, este o este?": con 2 o 3 productos, tabla en vez de tarjetas.
  if (/\b(compar\w*|diferencias?|vs|versus|se (parecen|diferencian))\b/.test(q) || (QUIERE_COMPARAR.test(q) && /\b(o|u)\b/.test(q)))   // "cuál me conviene si me gusta el fútbol" no es "A o B"
    for (const [i, a] of acciones.entries())
      if (a.nombre === "mostrar_productos" && a.args?.codigos?.length >= 2 && a.args.codigos.length <= 3) acciones[i] = {nombre: "comparar_productos", args: a.args};
  if (hay(["como_llegar"])) acciones = acciones.filter(a => a.nombre !== "ofrecer_opciones");
  if (!hay(["preparar_whatsapp"]) && analizarConsulta(pregunta).servicio && /escrib\w*|cotiz\w*|whatsapp/i.test(t) && !/\?\s*$/.test(t.trim()))
    acciones.push({nombre: "preparar_whatsapp", args: {mensaje: `Hola ${CONFIG.storeName}, ${pregunta}`, boton: "Cotizar por WhatsApp"}});
  CHAT.textoForzado = "";
  if (quitarNada){
    CHAT.textoForzado = `Eso no está en tu pedido 🤔 Ahora tienes: ${lineas().map(({p, q}) => (q > 1 ? q + " x " : "") + nombreBonito(p)).join(", ")}.`;
    return acciones.filter(a => !["mostrar_productos", "comparar_productos", "agregar_al_pedido"].includes(a.nombre));
  }
  // Quiere terminar/enviar su pedido pero no tiene nada: no se abre un pedido vacío ni se manda a WhatsApp.
  if (!unidades() && !hay(["agregar_al_pedido", "mostrar_productos", "comparar_productos"]) && /\b(termin\w*|finaliz\w*|enviar\w*|envia\w*|cerrar|confirm\w*|pagar)\b.*\b(pedido|compra|carrito|orden)\b/.test(q) && !/\b(mis pedidos|pedidos? (anterior|pasad|enviad)\w*|como va)\b/.test(q)){
    CHAT.textoForzado = "Tu pedido todavía está vacío 🛒 Cuéntame qué buscas (consola, juego o accesorio) y lo agregamos.";
    return [];
  }
  // Un regalo sin decir la consola: primero se le pregunta para cuál es (la IA a veces lo salta).
  if (/\bregal\w*\b/.test(q) && !/\b(tarjetas?|psn|eshop|game ?pass|codigos?|digital\w*)\b/.test(q) && !analizarConsulta(pregunta).plat && !CHAT.mensajes.some(m => m.rol === "usuario" && analizarConsulta(m.texto || "").plat) && !hay(["agregar_al_pedido"])){
    if (!/\?/.test(t) || /\b(mira|muestro|dejo|encontre)\b/.test(norm(t))) CHAT.textoForzado = "¡Qué buen detalle! ¿Para qué consola es el regalo? 👇";
    return [acciones.find(a => a.nombre === "ofrecer_opciones") || {nombre: "ofrecer_opciones", args: {opciones: ["PlayStation", "Nintendo Switch", "Xbox", "No tiene consola"]}}];
  }
  // Un producto que no hay: WhatsApp y "avísame aquí" juntos, en un solo mensaje.
  const buscado = CHAT.noEncontrado || (diceQueNoHay && CHAT.intencionProducto && CHAT.buscaEspecifico ? nombreBuscado(pregunta) : "");
  if (buscado && !hay(["como_llegar", "ver_pedido", "agregar_al_pedido"])){
    acciones = acciones.filter(a => a.nombre !== "preparar_whatsapp");
    acciones.push({nombre: "avisar_llegada", args: {q: buscado}});
  } else if (!hay(["preparar_whatsapp", "como_llegar", "ver_pedido", "mis_pedidos"]) && /whatsapp/i.test(t) && !CHAT.mensajes.slice(-6).some(m => m.enlace?.tipo === "wa"))
    acciones.push({nombre: "preparar_whatsapp", args: {mensaje: `Hola ${CONFIG.storeName}, ${pregunta}`, boton: "Escribir por WhatsApp"}});
  return acciones;
}

// --- Test "¿Qué consola me compro?": preguntas con botones (sin IA, al instante) y consolas reales en stock ---
const GUIA = [
  {id: "quien", q: "¡Vamos! 🎮 Son 4 preguntas rápidas. ¿Para quién es la consola?", o: [["🙋 Para mí", "adulto"], ["🧒 Un niño o niña", "nino"], ["👨‍👩‍👧 Toda la familia", "familia"]]},
  {id: "gusta", q: "¿Qué le gusta jugar?", o: [["⚽ Fútbol y deportes", "deportes"], ["🍄 Mario y aventuras", "aventura"], ["💥 Acción y disparos", "accion"], ["👾 Clásicos retro", "retro"], ["🎲 De todo un poco", "todo"]]},
  {id: "donde", q: "¿Dónde va a jugar?", o: [["📺 En la TV", "tv"], ["🎒 En cualquier lado", "portatil"], ["🔁 Las dos", "ambos"]]},
  {id: "plata", q: "¿Cuánto quieres gastar, más o menos?", o: [["Hasta $150", 150], ["Hasta $400", 400], ["Hasta $800", 800], ["💎 Lo mejor que haya", 0]]},
];
// Qué tan bien le va a cada tipo de consola con cada gusto (g) y cada persona (p), de 0 a 3.
const FAMILIAS = [
  {id: "ps5", re: /\bPS5\b|PLAYSTATION 5/, nombre: "PlayStation 5", por: "Tiene gráficos de última generación y los juegos más nuevos (EA Sports FC, Spider-Man, Call of Duty…).",
    g: {deportes: 3, accion: 3, aventura: 2, todo: 3}, p: {adulto: 3, nino: 1, familia: 2}},
  {id: "ps4", re: /\bPS4\b/, nombre: "PlayStation 4", por: "Tiene un catálogo enorme de juegos y cuesta mucho menos que una PS5.",
    g: {deportes: 3, accion: 3, aventura: 2, todo: 3, retro: 1}, p: {adulto: 2, nino: 2, familia: 2}},
  {id: "xbox", re: /XBOX (SERIES|ONE)/, nombre: "Xbox", por: "Es ideal para acción, carreras y disparos (Forza, Halo, Call of Duty).",
    g: {deportes: 2, accion: 3, aventura: 1, todo: 2}, p: {adulto: 3, nino: 1, familia: 1}},
  {id: "switch", re: /SWI[CT]{2}H/, nombre: "Nintendo Switch", por: "Se juega en la TV y también como portátil, y tiene Mario, Pokémon y Zelda: perfecta para niños y familia.",
    g: {deportes: 2, accion: 1, aventura: 3, todo: 3, retro: 1}, p: {adulto: 2, nino: 3, familia: 3}},
  {id: "bolsillo", re: /\bR36|\bX9\b|CONSOLA SUP\b|\bK10\b|MINI GAME/, nombre: "Consola retro portátil", por: "Es portátil, económica y perfecta para jugar los clásicos.",
    g: {retro: 3, todo: 1, aventura: 1}, p: {nino: 2, adulto: 1, familia: 1}},
  {id: "retro", re: /ATARI|SNES|NESS|SUPER NINTENDO|GAME ?STICK|ARCADE|PANDORA/, nombre: "Consola retro", por: "Es para jugar los clásicos de siempre en la TV.",
    g: {retro: 3, todo: 1}, p: {familia: 2, adulto: 2, nino: 1}},
  {id: "clasica", re: /\bPS[23]\b|XBOX 360|\bPSP\b/, nombre: "Consola clásica", por: "Es una consola de generaciones anteriores, a buen precio, para revivir sus grandes juegos.",
    g: {retro: 2, accion: 1, deportes: 1, todo: 1}, p: {adulto: 2, nino: 1, familia: 1}},
];
const NO_GUIA = /PORTAL|DJ HERO|OCULUS|QUEST/;   // necesitan otra consola o no son para jugar en la TV
const PORTATIL = /SWI[CT]{2}H|\bPSP\b|\bR36|\bX9\b|CONSOLA SUP\b|\bK10\b|MINI GAME/;
const PIDE_GUIA = /\b(que|cual) consola (me )?(compro|comprar|recomiendas?|recomiendan|elijo|escojo|conviene)\b|\b(hacer|repetir|hazme|haz) (el )?test\b|\bayudame a (elegir|escoger) (una )?consola\b|\btest de (la )?consola/;
function recomendarConsolas(r){
  const efectivo = p => precio(p, "efectivo");
  const todas = PRODUCTS.filter(p => p.cat === "consolas" && maxQty(p) > 0 && !NO_GUIA.test(p.name.toUpperCase()))
    .map(p => ({p, N: p.name.toUpperCase()})).map(x => ({...x, f: FAMILIAS.find(f => f.re.test(x.N))})).filter(x => x.f);
  if (!todas.length) return {lista: []};
  const tope = r.plata || Infinity, masCara = Math.max(...todas.map(x => efectivo(x.p)));
  const puntos = ({p, N, f}) => {
    const port = PORTATIL.test(N), tv = !port || f.id === "switch";
    let s = (f.g[r.gusta] || 0) * 2 + (f.p[r.quien] || 0);
    if (r.donde === "tv") s += tv ? 1 : -4;
    if (r.donde === "portatil") s += port ? 3 : -4;
    if (r.donde === "ambos") s += port && tv ? 3 : -1;
    s += r.plata ? efectivo(p) / r.plata * 1.5 : efectivo(p) / masCara * 4;   // aprovechar el presupuesto / "lo mejor"
    if (/MEDIO USO|USAD|HACK/.test(N)) s -= 0.8;
    if (p.photos.length) s += 0.4;   // a igual puntaje, la que se puede ver en foto
    return s;
  };
  let lista = todas.filter(x => efectivo(x.p) <= tope);
  const sinPresupuesto = !lista.length;
  if (sinPresupuesto) lista = [...todas].sort((a, b) => efectivo(a.p) - efectivo(b.p)).slice(0, 3);
  lista = lista.map(x => ({...x, s: puntos(x)})).sort((a, b) => b.s - a.s);
  const elegidas = [], familias = new Set();   // primero una de cada tipo, para que haya de dónde escoger
  for (const x of lista) if (!familias.has(x.f.id)){ familias.add(x.f.id); elegidas.push(x); }
  for (const x of lista) if (elegidas.length < 3 && !elegidas.includes(x)) elegidas.push(x);
  return {lista: elegidas.slice(0, 3), sinPresupuesto};
}
function iniciarGuia(){ medir("guia-inicio"); preguntarGuia(0); }
function preguntarGuia(i){
  const g = GUIA[i];
  agregarMensaje({rol: "mascota", texto: g.q});
  agregarMensaje({rol: "mascota", opciones: g.o.map(([t]) => t), guia: g.id});
}
// Las respuestas salen de la conversación (así también funciona después de recargar la página).
function respuestasGuia(){
  const r = {};
  for (const m of [...CHAT.mensajes].reverse()){
    if (!m.guia) continue;
    const o = GUIA.find(g => g.id === m.guia)?.o.find(([t]) => t === m.elegida);
    if (o && !(m.guia in r)) r[m.guia] = o[1];
    if (m.guia === "quien") break;
  }
  return r;
}
function responderGuia(m){
  agregarMensaje({rol: "usuario", texto: m.elegida});
  const i = GUIA.findIndex(g => g.id === m.guia);
  if (i < GUIA.length - 1) setTimeout(() => preguntarGuia(i + 1), 300);
  else setTimeout(resultadoGuia, 300);
}
function resultadoGuia(){
  const {lista, sinPresupuesto} = recomendarConsolas(respuestasGuia());
  if (!lista.length) return decir("Justo ahora no tenemos consolas disponibles 😔 Escríbenos por WhatsApp y te avisamos cuando lleguen.");
  const [x] = lista;
  const el = agregarMensaje({rol: "mascota", festejo: true, texto: sinPresupuesto
    ? "Con ese presupuesto no tenemos consolas ahora mismo 😅 Estas son las más económicas que hay:"
    : `🏆 ¡Tu consola ideal: **${x.f.nombre}**! ${x.f.por}`});
  if (el && !reduceMotion()) confeti(el);
  ACCIONES_CHAT.mostrar_productos({codigos: lista.map(y => y.p.code)});
  agregarMensaje({rol: "mascota", opciones: ["💬 Cuéntame más de la primera", "🔁 Repetir el test"]});
  medir("guia-consola", {familia: x.f.id});
}

// --- Cómo se ve ---
function formatoChat(t){
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^[ \t]*[-*•][ \t]+/gm, "• ").replace(/\n{3,}/g, "\n\n").trim();
}
function tarjetaChat(p){
  return `<div class="chat-prod" data-code="${esc(p.code)}">
    <button type="button" class="chat-prod-abrir" data-chat-abrir="${esc(p.code)}" aria-label="Ver ${esc(p.name)}">
      <img src="${esc(fotoDe(p))}" alt="" width="132" height="132" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)">
      <span>${esc(p.name)}</span>
    </button>
    <div class="chat-prod-pie"><b>${fmt(precio(p, "efectivo"))}</b><div class="card-add" data-q="${PEDIDO.items.get(p.code) || 0}">${controlTarjeta(p)}</div></div>
  </div>`;
}
function elementoMensaje(m){
  const d = document.createElement("div");
  if (m.productos){
    const ps = m.productos.map(buscar).filter(Boolean);
    if (!ps.length) return null;
    d.className = "chat-prods-caja";
    d.innerHTML = `<div class="chat-prods">${ps.map(tarjetaChat).join("")}</div>` +
      `<button type="button" class="chat-flecha izq" data-desplazar="-1" aria-label="Productos anteriores" hidden><svg aria-hidden="true"><use href="#i-left"/></svg></button>` +
      `<button type="button" class="chat-flecha der" data-desplazar="1" aria-label="Más productos" hidden><svg aria-hidden="true"><use href="#i-right"/></svg></button>`;
    d.firstChild.addEventListener("scroll", () => flechasChat(d), {passive: true});
    requestAnimationFrame(() => flechasChat(d));
    return d;
  }
  if (m.comparar){
    const ps = m.comparar.map(buscar).filter(Boolean);
    if (ps.length < 2) return null;
    const dinero = k => { const vs = ps.map(p => precio(p, k)), min = Math.min(...vs);
      return p => `<span${new Set(vs).size > 1 && precio(p, k) === min ? ' class="mejor"' : ""}>${fmt(precio(p, k))}</span>`; };
    const fila = (t, f) => `<tr><th scope="row">${t}</th>${ps.map(p => `<td>${f(p)}</td>`).join("")}</tr>`;
    d.className = "chat-comparar";
    d.innerHTML = `<table><thead><tr><td></td>${ps.map(p => `<th scope="col"><button type="button" data-chat-abrir="${esc(p.code)}">` +
        `<img src="${esc(fotoDe(p))}" alt="" width="64" height="64" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)">` +
        `<span>${esc(p.name)}</span></button></th>`).join("")}</tr></thead><tbody>` +
      fila("Efectivo", dinero("efectivo")) + fila("Tarjeta", dinero("tarjeta")) +
      fila("Consola", p => esc(consolaDe(p).txt || "—")) + fila("Tipo", p => esc(p.cat_label)) +
      Object.entries(CONFIG.locales).map(([k, L]) => fila(`📍 ${esc(corto(L.nombre))}`, p => p.digital ? "Digital" : p.stock?.[k] > 0 ? `${p.stock[k]} disp.` : "—")).join("") +
      fila("", p => `<div class="cmp-add" data-code="${esc(p.code)}"><div class="card-add" data-q="${PEDIDO.items.get(p.code) || 0}">${controlTarjeta(p)}</div></div>`) +
      `</tbody></table>`;
    return d;
  }
  if (m.opciones){
    d.className = "chat-opciones";
    d.innerHTML = m.opciones.map((o, i) => `<button type="button" data-opcion="${i}"${m.elegida ? " disabled" : ""}${m.elegida === o ? ' class="elegida"' : ""}>${esc(o)}</button>`).join("");
    return d;
  }
  if (m.pedidos){
    const ls = leerPedidos().filter(x => m.pedidos.includes(x.codigo));
    if (!ls.length) return null;
    d.className = "chat-pedidos";
    d.innerHTML = ls.map(pedidoHTML).join("");
    return d;
  }
  d.className = `chat-msj ${m.rol === "usuario" ? "mia" : "suya"}${m.error ? " error" : ""}`;
  if (m.botones){
    d.classList.add("con-enlace", "botones");
    d.innerHTML = m.botones.map(b => {
      const svg = b.icono === "wa" ? `<svg aria-hidden="true"><use href="#i-wa"/></svg>` : "";
      if (b.href) return /^https:\/\//.test(b.href) ? `<a class="chat-enlace${b.icono === "wa" ? " wa" : ""}" href="${esc(b.href)}" target="_blank" rel="noopener" data-tipo="${esc(b.tipo || "compartir")}">${svg}${esc(b.texto)}</a>` : "";
      const attr = BOTONES_CHAT[b.accion];
      return attr ? `<button type="button" class="chat-enlace" ${attr}="${esc(b.valor || "")}">${svg}${esc(b.texto)}</button>` : "";
    }).join("");
    return d.innerHTML ? d : null;
  }
  if (m.enlace){
    d.classList.add("con-enlace");
    d.innerHTML = `<a class="chat-enlace ${m.enlace.tipo === "wa" ? "wa" : ""}" href="${esc(m.enlace.href)}" target="_blank" rel="noopener"${m.enlace.tipo === "wa" ? ' data-tipo="chat"' : ""}>` +
      `<svg aria-hidden="true"><use href="#${m.enlace.tipo === "wa" ? "i-wa" : "i-pin"}"/></svg>${esc(m.enlace.texto)}</a>`;
    return d;
  }
  if (m.saludo) d.innerHTML = `<img class="chat-pose" src="mascota/poses/saludo.webp" alt="" width="390" height="560" decoding="async">`;
  if (m.festejo){ d.classList.add("festejo"); d.innerHTML = `<img class="chat-pose" src="mascota/poses/baila.webp" alt="" width="447" height="560" decoding="async">`; }
  if (m.error) d.innerHTML = `<img class="chat-pose" src="mascota/poses/triste.webp" alt="" width="371" height="560" decoding="async">`;
  d.insertAdjacentHTML("beforeend", `<span class="chat-cont"><span class="chat-txt">${formatoChat(m.texto || "")}</span>` +
    (m.error && m.reintentar ? `<button type="button" class="chat-reintentar" data-reintentar>Reintentar</button>` : "") +
    (m.deshacer?.length ? `<button type="button" class="chat-reintentar" data-chat-deshacer>Deshacer</button>` : "") + `</span>`);
  return d;
}
// Botones que el chat puede dejar (los atiende el manejador general de la página o el del chat).
const BOTONES_CHAT = {"abrir-favoritos": "data-abrir-favoritos", "ver-pedido": "data-ver-pedido", "abrir-pedidos": "data-abrir-pedidos", instalar: "data-instalar", copiar: "data-copiar",
  avisame: "data-avisame", "avisame-codigo": "data-avisame-codigo"};
const MSJ_DE = new WeakMap();   // elemento en pantalla -> su mensaje (para las opciones y "Deshacer")
// Con mouse no se puede deslizar de lado: las flechas aparecen solo si hay más productos hacia ese lado.
function flechasChat(caja){
  const f = caja.querySelector(".chat-prods"), max = f.scrollWidth - f.clientWidth;
  caja.querySelector(".izq").hidden = f.scrollLeft <= 4;
  caja.querySelector(".der").hidden = f.scrollLeft >= max - 4;
}
function bajarChat(){ const c = $("chatCuerpo"); c.scrollTop = c.scrollHeight; }
function agregarMensaje(m, guardar = true){
  CHAT.mensajes.push(m);
  const el = elementoMensaje(m);
  if (el){ MSJ_DE.set(el, m); $("chatCuerpo").append(el); }
  bajarChat();
  if (guardar && m.rol === "mascota" && m.texto && !m.saludo) leerEnVoz(m.texto);
  if (guardar) guardarChat();
  pintarChips();
  return el;
}
function guardarChat(){
  try { localStorage.setItem(CLAVE_CHAT, JSON.stringify({t: Date.now(), citados: CHAT.citados, mensajes: CHAT.mensajes.filter(m => !m.error).slice(-40)})); } catch(e) {}
}
function cargarChat(){
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_CHAT) || "null");
    if (!d || Date.now() - d.t > 3 * 86400000 || !Array.isArray(d.mensajes)) return false;
    CHAT.citados = Array.isArray(d.citados) ? d.citados.filter(c => typeof c === "string") : [];
    for (const m of d.mensajes) if (m && typeof m === "object") agregarMensaje(m, false);
    return CHAT.mensajes.length > 0;
  } catch(e) { return false; }
}
function saludarChat(){
  agregarMensaje({rol: "mascota", saludo: true, texto: `¡Hola! Soy el muñequito de ${CONFIG.storeName} 🎮 Te ayudo a encontrar juegos, consolas y accesorios, armar tu pedido o llegar a un local. ¿Qué buscas?`});
}
function nuevaConversacion(){
  CHAT.mensajes = []; CHAT.citados = [];
  $("chatCuerpo").innerHTML = "";
  try { localStorage.removeItem(CLAVE_CHAT); } catch(e) {}
  saludarChat();
  $("chatTexto").focus();
}
// Botones rápidos: al empezar la conversación (y "terminar mi pedido" si ya hay algo).
function pintarChips(){
  const chips = $("chatChips");
  if (CHAT.mensajes.some(m => m.rol === "usuario") || CHAT.enviando){ chips.hidden = true; return; }
  const visto = VISTOS.map(buscar).find(Boolean);
  const ls = [
    unidades() && ["🛒 Terminar mi pedido", "Quiero terminar mi pedido"],
    visto && ["👀 El que estaba viendo", `Cuéntame del ${visto.name}`],
    leerPedidos().length && ["📦 Mis pedidos", "Muéstrame mis pedidos"],
    ["🎮 ¿Qué consola me compro?", "¿Qué consola me compro?"],
    ["🆕 ¿Qué llegó nuevo?", "¿Qué productos nuevos llegaron?"],
    ["🔥 Lo más vendido", "¿Qué es lo más vendido?"],
    ["🎁 Ayúdame con un regalo", "Quiero regalar algo, ¿qué me recomiendas?"],
    ["📍 ¿Dónde están?", "¿Dónde están los locales y a qué hora abren?"],
    ["🔧 Servicio técnico", "Necesito servicio técnico"],
  ].filter(Boolean);
  chips.innerHTML = ls.map(([t, m]) => `<button type="button" data-chip="${esc(m)}">${esc(t)}</button>`).join("");
  chips.hidden = false;
}
function estadoChat(txt){ $("chatEstado").textContent = txt || "Te responde el muñequito"; }

// --- Voz: dictar (micrófono) y escuchar las respuestas ---
function leerEnVoz(texto){
  if (!("speechSynthesis" in window) || !(CHAT.voz || CHAT.leerProxima)) return;
  CHAT.leerProxima = false;
  const limpio = texto.replace(/\*\*/g, "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();
  if (!limpio) return;
  const u = new SpeechSynthesisUtterance(limpio);
  u.lang = "es-EC";
  const v = speechSynthesis.getVoices().find(v => /^es(-|_)(EC|419|MX|US|CO)/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^es/i.test(v.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function pintarVoz(){
  $("chatVoz").setAttribute("aria-pressed", CHAT.voz);
  $("chatVoz").title = CHAT.voz ? "Dejar de leer en voz alta" : "Leer las respuestas en voz alta";
}
const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictado = null;
function dictar(){
  if (dictado){ dictado.stop(); return; }
  const r = new Reconocer();
  r.lang = "es-EC"; r.interimResults = true; r.maxAlternatives = 1;
  let final = "";
  r.onresult = e => {
    let t = "";
    for (const res of e.results) t += res[0].transcript;
    $("chatTexto").value = t;
    if (e.results[e.results.length - 1].isFinal) final = t;
  };
  r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") decir("No tengo permiso para usar el micrófono 🎤 Actívalo en tu navegador o escríbeme."); };
  r.onend = () => {
    dictado = null; $("chatMic").classList.remove("escuchando");
    if (final.trim()){ CHAT.leerProxima = true; $("chatTexto").value = ""; enviarChat(final); }
  };
  dictado = r;
  $("chatMic").classList.add("escuchando");
  try { r.start(); } catch(e) { dictado = null; $("chatMic").classList.remove("escuchando"); }
}

// --- Conversar: la respuesta llega en vivo y las acciones se ejecutan al final ---
async function* leerEventos(resp){
  const lector = resp.body.getReader(), dec = new TextDecoder();
  let buf = "";
  const bloque = b => { const datos = b.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).join(""); try { return datos ? JSON.parse(datos) : null; } catch(e) { return null; } };
  for (;;){
    const {value, done} = await lector.read();
    if (done) break;
    buf += dec.decode(value, {stream: true});
    let m;
    while ((m = /\r?\n\r?\n/.exec(buf))){
      const ev = bloque(buf.slice(0, m.index));
      buf = buf.slice(m.index + m[0].length);
      if (ev) yield ev;
    }
  }
  const ev = bloque(buf);
  if (ev) yield ev;
}
function historialParaIA(){
  const nombres = cs => cs.map(buscar).filter(Boolean).map(p => p.name).join("; ");
  return CHAT.mensajes.filter(m => !m.error && !m.saludo).map(m =>
    m.productos ? {rol: "mascota", texto: `(Le mostré: ${nombres(m.productos)})`}
    : m.comparar ? {rol: "mascota", texto: `(Le mostré una tabla comparando: ${nombres(m.comparar)})`}
    : m.opciones ? {rol: "mascota", texto: `(Le di a elegir: ${m.opciones.join(" / ")})`}
    : m.pedidos ? {rol: "mascota", texto: `(Le mostré sus pedidos enviados: ${m.pedidos.join(", ")})`}
    : m.enlace ? {rol: "mascota", texto: `(Le dejé un botón: ${m.enlace.texto})`}
    : m.botones ? {rol: "mascota", texto: `(Le dejé botones: ${m.botones.map(b => b.texto).join(" / ")})`}
    : {rol: m.rol, texto: m.texto}).filter(m => m.texto).slice(-12);
}
// El modelo a veces cambia un dígito de un precio ($25.99 en vez de $25.90). Si un monto del texto no existe
// en el catálogo (ni es un total calculado por la página) pero está a centavos de un precio real de lo
// que se está hablando, se cambia por el real. Los demás montos (sumas, diferencias) no se tocan.
function corregirPrecios(texto){
  if (!texto || !PRODUCTS.length || !/\$\s*\d/.test(texto)) return texto;
  const c = x => Math.round(x * 100);
  const reales = new Set(), cercanos = new Set();
  for (const p of PRODUCTS) for (const pago of ["efectivo", "tarjeta"]) reales.add(c(precio(p, pago)));
  for (const m of CHAT.montos || []) reales.add(c(m));
  for (const {p, q} of lineas()) for (const pago of ["efectivo", "tarjeta"]){ reales.add(c(precio(p, pago) * q)); reales.add(c(totalPedido(pago))); }
  for (const code of [...(CHAT.candidatos || []), ...(CHAT.citados || [])]){
    const p = buscar(code); if (!p) continue;
    for (const pago of ["efectivo", "tarjeta"]) cercanos.add(c(precio(p, pago)));
  }
  return texto.replace(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(?!\d)/g, (m, ent, dec, pos) => {
    const v = c(Number(ent.replace(/,/g, "") + "." + (dec || "0")));
    if (reales.has(v) || /(ahorr|diferenc|total|suma|faltan?|cuotas?|descuento|extra|mas)\w*(\W+(es|son|de|sera|serian|queda|quedan|sale|salen|seria))*\W*$/i.test(norm(texto.slice(Math.max(0, pos - 24), pos)))) return m;
    const cerca = [...cercanos].filter(x => Math.abs(x - v) <= 10 && Math.floor(x / 100) === Math.floor(v / 100));
    return cerca.length === 1 ? fmt(cerca[0] / 100) : m;
  });
}
async function enviarChat(texto, reintento = false){
  texto = String(texto || "").trim();
  if (CHAT.enviando || !texto) return;
  const q = norm(texto);
  if (!reintento && PIDE_GUIA.test(q) && !/\b(control|palanca|mando|juego|accesorio|audifono)/.test(q)){ agregarMensaje({rol: "usuario", texto}); iniciarGuia(); return; }
  CHAT.enviando = true;
  $("chatEnviar").disabled = true;
  const historial = historialParaIA();
  // Al reintentar, la pregunta ya está en pantalla (y al final del historial): no se repite.
  if (reintento){ const u = historial[historial.length - 1]; if (u?.rol === "usuario" && u.texto === texto) historial.pop(); }
  else agregarMensaje({rol: "usuario", texto});
  medir("chat-mensaje");
  const pol = !reintento && (respuestaPolitica(texto) || respuestaTotal(texto) || respuestaServicio(texto) || respuestaStock(texto) || respuestaFoco(texto) || respuestaTienda(texto));
  CHAT.ultimoTema = pol ? pol.tema : (analizarConsulta(texto).servicio ? "servicio" : "");
  if (pol){   // respuesta fija, al instante y sin IA
    medir("chat-politica", {tema: pol.tema});
    agregarMensaje({rol: "mascota", texto: pol.texto});
    if (pol.acciones) for (const a of pol.acciones) ejecutarAccionChat(a);
    else if (pol.botones) agregarMensaje({rol: "mascota", botones: pol.botones});
    else if (!pol.sinBoton) agregarMensaje({rol: "mascota", enlace: {href: waLink(pol.wa || `Hola ${CONFIG.storeName}, ${texto}`), texto: pol.boton || "Preguntar por WhatsApp", tipo: "wa"}});
    CHAT.enviando = false; CHAT.desdeFicha = "";
    $("chatEnviar").disabled = false;
    estadoChat(); guardarChat();
    return;
  }
  const pensando = document.createElement("div");
  pensando.className = "chat-msj suya pensando";
  pensando.innerHTML = `<img class="chat-pose" src="mascota/poses/piensa.webp" alt="" width="381" height="560" decoding="async"><i></i><i></i><i></i>`;
  $("chatCuerpo").append(pensando);
  bajarChat();
  estadoChat("Pensando…");
  let corte = null, reloj = 0;
  let texto_ = "", burbuja = null;
  const acciones = [];
  const cuerpo = JSON.stringify({mensaje: texto, historial, contexto: contextoTienda(texto), herramientas: HERRAMIENTAS_CHAT, stream: true});
  // Gemini a veces se satura y tarda: si no empezó a contestar a tiempo (o respondió "saturado"), se reintenta
  // una vez sola antes de mostrarle un error al cliente.
  const pedir = async ms => {
    corte = new AbortController(); clearTimeout(reloj);
    const c = corte; reloj = setTimeout(() => c.abort(), ms);
    const r = await fetch(CONFIG.chatMascotaUrl, {method: "POST", headers: {"Content-Type": "application/json"}, signal: c.signal, body: cuerpo});
    if (!r.ok){
      let d = {}; try { d = await r.json(); } catch(e) {}
      throw Object.assign(new Error(d.error || "error"), {estado: d.estado || r.status, aviso: r.status === 429 ? d.error : ""});
    }
    return r;
  };
  // Arma lo que ve el cliente: el texto de la IA (o nada, si la IA no respondió) más lo que la página hace.
  const presentar = (textoIA, accs) => {
    let hacer = completarAcciones(textoIA, accs.map(a => normalizarAccion(a, texto)), texto);
    let limpio = sinSaludo(limpiarTexto(textoIA), texto);
    if (CHAT.textoForzado) limpio = CHAT.textoForzado;
    // Pidió "un control de PS4" y hay varios: no se agrega uno al azar, se le muestran para que elija.
    const yaVistos = new Set(CHAT.vistosAntes || []);
    if (CHAT.ambiguo && hacer.some(a => a.nombre === "agregar_al_pedido") && !hacer.filter(a => a.nombre === "agregar_al_pedido").every(a => yaVistos.has(a.args?.codigo))){
      hacer = [{nombre: "mostrar_productos", args: {codigos: CHAT.ambiguo}}, ...hacer.filter(a => a.nombre !== "agregar_al_pedido" && a.nombre !== "mostrar_productos")];
      limpio = "Hay varias opciones parecidas, ¿cuál quieres agregar? 👇";
    }
    // Dice que hizo algo en el pedido que no se hizo ("ya lo quité"): esa frase se quita. Lo que sí se hace,
    // lo confirma la página con su propio mensaje.
    {
      const hizo = ns => hacer.some(a => ns.includes(a.nombre));
      const falsas = [
        [/\b(agregu[eé]|añad[ií]|(he|ya) (agregado|añadido|puesto)|agregad[oa]s? (a|al) tu|añadid[oa]s? (a|al) tu|lo puse|la puse|los puse)\b/i, ["agregar_al_pedido", "cambiar_cantidad"]],
        [/\b(quit[eé]|elimin[eé]|borr[eé]|saqu[eé]|vaci[eé]|(he|ya) (quitado|eliminado|borrado|sacado|vaciado)|quitad[oa] (de|del) tu)\b/i, ["cambiar_cantidad", "vaciar_pedido"]],
        [/\b(anot[eé]|registr[eé]|(he|ya) (anotado|registrado|cambiado))\b/i, ["datos_del_pedido"]],
      ];
      const frases = limpio.match(/[^.!?\n]+[.!?]*[ \t]*|\n/g) || [];
      const sin = frases.filter(f => !falsas.some(([re, ns]) => re.test(f) && !hizo(ns))).join("").trim();
      if (sin !== limpio.trim()) limpio = sin || (hacer.length ? "" : "Perdona, no alcancé a hacerlo 😅 ¿Me dices otra vez qué producto es?");
    }
    // Dice "mira estas opciones 👇" pero no hay nada que mostrar: se quita esa frase.
    if (!hacer.some(a => VISUALES.includes(a.nombre) || ["preparar_whatsapp", "guardar_favorito", "ofrecer_opciones", "avisar_llegada", "como_llegar", "mis_pedidos", "ver_favoritos", "instalar_app"].includes(a.nombre))){
      const sin = limpio.split("\n").filter(l => !(l.includes("👇") && l.length < 70)).join("\n").trim();
      if (sin) limpio = sin;
      limpio = limpio.replace(/\s*👇/g, "");   // y la flecha sola, sin nada abajo, tampoco
    }
    // Las tarjetas incluyen también los productos que el texto nombra (dice "la digital y la de disco" y mostraba una sola).
    const nombrados = productosNombrados(limpio, CHAT.candidatos || []), mostrar = hacer.find(a => a.nombre === "mostrar_productos");
    if (mostrar && Array.isArray(mostrar.args?.codigos) && nombrados.length)
      for (const p of nombrados) if (!mostrar.args.codigos.includes(p.code) && mostrar.args.codigos.length < 6) mostrar.args.codigos.push(p.code);
    if (mostrar && Array.isArray(mostrar.args?.codigos)) mostrar.args.codigos = deLaConsola(mostrar.args.codigos);
    if (!limpio){   // mostró algo pero no dijo nada: una frase corta
      const ps = unicos(((hacer.find(a => a.nombre === "mostrar_productos") || {}).args?.codigos || []).map(buscar).filter(Boolean));
      const bonito = n => n.toLowerCase().split(/\s+/).map(w => /\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const q = norm(texto);
      if (CHAT.noEncontrado && !hacer.some(a => a.nombre === "agregar_al_pedido"))
        limpio = `Por ahora no tenemos «${CHAT.noEncontrado}» 😕` + (ps.length ? " Esto es lo más parecido que sí hay 👇" : " Si quieres, te aviso cuando llegue 👇");
      else if (ps.length && /\b(mas barat[oa]s?|mas economic[oa]s?|mas car[oa]s?)\b/.test(q)){
        const caro = /\bmas car[oa]s?\b/.test(q), p = ps.reduce((a, b) => (precio(b, "efectivo") < precio(a, "efectivo")) !== caro ? b : a);
        limpio = `${caro ? "El más caro" : "El más barato"} es **${nombreBonito(p)}**: ${fmt(precio(p, "efectivo"))} en efectivo o transferencia` + (precio(p, "tarjeta") > precio(p, "efectivo") ? ` (${fmt(precio(p, "tarjeta"))} con tarjeta)` : "") + " 👇";
        mostrarPrimero(hacer, p.code);
      }
      else if (ps.length && ps.length <= 3 && /\b(cuesta|cuestan|precios?|cuanto|vale|valen|sale|salen|a como|a cuanto)\b/.test(q))
        limpio = ps.map(p => `${bonito(p.name)} cuesta ${fmt(precio(p, "efectivo"))} en efectivo o transferencia` + (precio(p, "tarjeta") > precio(p, "efectivo") ? ` (${fmt(precio(p, "tarjeta"))} con tarjeta)` : "") + ".").join(" ") + " 👇";
      else if (ps.length === 1 && ps[0].incluye?.length && /\b(incluye|trae|viene|contiene)\b/.test(q))
        limpio = `${bonito(ps[0].name)} incluye ${ps[0].incluye.length > 1 ? ps[0].incluye.slice(0, -1).join(", ") + " y " + ps[0].incluye.at(-1) : ps[0].incluye[0]}. 👇`;
      else if (CHAT.ambiguo && hacer.some(a => a.nombre === "mostrar_productos")) limpio = "Hay varias opciones parecidas, ¿cuál quieres agregar? 👇";
      else if (hacer.some(a => a.nombre === "comparar_productos")) limpio = "Te los comparo 👇";
      else if (hacer.some(a => a.nombre === "mostrar_productos")) limpio = /\b(hay|tienen|tienes|venden|consigo)\b/.test(q) && !CHAT.desconocidas?.length ? "¡Sí! Mira lo que tenemos 👇" : "Mira lo que encontré 👇";
      else if (hacer.some(a => a.nombre === "como_llegar")) limpio = "Te dejo cómo llegar 👇";
      else if (hacer.some(a => a.nombre === "avisar_llegada")) limpio = "Si quieres, te aviso cuando llegue 👇";
      else if (hacer.some(a => a.nombre === "preparar_whatsapp")) limpio = analizarConsulta(texto).servicio ? "Sí, lo revisamos en el servicio técnico. Te dejo el botón para cotizar por WhatsApp 👇" : "Te dejo el botón para escribirnos 👇";
      else if (hacer.some(a => a.nombre === "ofrecer_opciones")) limpio = "¿Cuál prefieres? 👇";
    }
    // Preguntó cuánto cuesta y el texto no trae ningún precio: se agrega.
    const pcards = unicos(((hacer.find(a => a.nombre === "mostrar_productos") || {}).args?.codigos || []).map(buscar).filter(Boolean));
    if (pcards.length && /\b(cuesta|cuestan|precios?|cuanto|vale|valen|sale|salen|a como|a cuanto)\b/.test(norm(texto)) && limpio && !/\$\s*\d/.test(limpio)){
      const ef = pcards.map(p => precio(p, "efectivo"));
      limpio = limpio.replace(/\s*👇\s*$/, "") + (pcards.length === 1 ? ` Cuesta ${fmt(ef[0])} en efectivo o transferencia.` : ` Los precios van desde ${fmt(Math.min(...ef))} hasta ${fmt(Math.max(...ef))} en efectivo o transferencia.`) + " 👇";
    }
    limpio = corregirPrecios(limpio);
    burbuja?.remove(); burbuja = null;
    if (limpio) agregarMensaje({rol: "mascota", texto: limpio});
    for (const a of hacer) ejecutarAccionChat(a);
    return !!(limpio || hacer.length);
  };
  try {
    let r;
    try { r = await pedir(22000); }
    catch(e1){
      if (e1.aviso || [400, 403, 413].includes(e1.estado)) throw e1;
      estadoChat("Pensando un poquito más…");
      r = await pedir(35000);
    }
    clearTimeout(reloj); reloj = setTimeout(() => corte.abort(), 40000);   // ya empezó a contestar: tiempo para terminar
    const pintar = () => {
      if (!burbuja){ pensando.remove(); estadoChat("Escribiendo…"); burbuja = document.createElement("div"); burbuja.className = "chat-msj suya"; $("chatCuerpo").append(burbuja); }
      burbuja.innerHTML = `<span class="chat-txt">${formatoChat(sinSaludo(limpiarTexto(texto_), texto))}</span>`;
      bajarChat();
    };
    if ((r.headers.get("Content-Type") || "").includes("event-stream")){
      for await (const ev of leerEventos(r)){
        for (const part of ev.candidates?.[0]?.content?.parts || []){
          if (part.text){ texto_ += part.text; pintar(); }
          if (part.functionCall) acciones.push({nombre: part.functionCall.name, args: part.functionCall.args || {}});
        }
      }
    } else {   // Worker anterior: todo junto
      const d = await r.json();
      if (d.error) throw Object.assign(new Error(d.error), {estado: d.estado});
      texto_ = d.respuesta || "";
      acciones.push(...(d.acciones || (d.accion ? [d.accion] : [])));
      if (texto_) pintar();
    }
    pensando.remove();
    if (!presentar(texto_, acciones)) throw new Error("vacío");
  } catch(e) {
    pensando.remove();
    if (burbuja && limpiarTexto(texto_)){ burbuja.remove(); agregarMensaje({rol: "mascota", texto: sinSaludo(limpiarTexto(texto_), texto)}); }
    else {
      burbuja?.remove(); burbuja = null;
      // La IA no respondió (caída o saturada): la página contesta sola con lo que sabe (productos, precios, pedido, avísame).
      let solo = false;
      if (!e.aviso && e.message !== "vacío" && !limpiarTexto(texto_)) try { solo = presentar("", []); } catch(e2) {}
      const charla = !solo && !e.aviso && /^\s*(hola|buen[oa]s?( (dias|tardes|noches))?|gracias|muchas gracias|ok|okay|chao|adios|hasta luego)\b/.test(norm(texto));
      if (charla) agregarMensaje({rol: "mascota", texto: /^\s*(gracias|muchas|ok|okay|chao|adios|hasta)/.test(norm(texto)) ? "¡Con gusto! Aquí estoy si necesitas algo más 😊" : "¡Hola! ¿Qué estás buscando? Puedo mostrarte consolas, juegos y controles 🎮"});
      if (solo || charla) medir("chat-sin-ia");
      else agregarMensaje({rol: "mascota", error: true, reintentar: texto,
        texto: e.aviso || (e.name === "AbortError" ? "Me tardé demasiado 😅 ¿Lo intentamos otra vez?" : "No pude responder justo ahora 😅 Toca «Reintentar» o escríbenos por WhatsApp.")}, false);
    }
  } finally {
    clearTimeout(reloj);
    CHAT.desdeFicha = "";
    CHAT.enviando = false;
    $("chatEnviar").disabled = false;
    estadoChat();
    guardarChat();
  }
}
function abrirChat(pregunta){
  if (!CONFIG.chatMascotaUrl){ open($("chatWa").href, "_blank"); return; }
  const d = $("chatMascota");
  if (!d.open){
    d.show();
    document.body.classList.add("chat-abierto");
    if (!CHAT.mensajes.length && !cargarChat()) saludarChat();
    pintarChips();
    medir("chat-abierto");
    requestAnimationFrame(bajarChat);
  }
  if (typeof pregunta === "string" && pregunta) enviarChat(pregunta);
  // En celular no se abre el teclado solo (ni queda marcado el primer botón).
  if (enCelular()) $("chatCuerpo").focus({preventScroll: true}); else $("chatTexto").focus();
}
{
  const form = $("chatForm"), texto = $("chatTexto");
  $("chatWa").href = waLink(`Hola ${CONFIG.storeName}, ¿me ayudan a encontrar un producto?`);
  $("chatCerrar").onclick = () => { $("chatMascota").close(); try { speechSynthesis.cancel(); } catch(e) {} };
  $("chatMascota").addEventListener("close", () => document.body.classList.remove("chat-abierto"));
  $("chatNuevo").onclick = nuevaConversacion;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = texto.value; texto.value = ""; texto.style.height = "auto";
    enviarChat(v);
  });
  texto.addEventListener("input", () => { texto.style.height = "auto"; texto.style.height = Math.min(texto.scrollHeight, 90) + "px"; });
  texto.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); form.requestSubmit(); } });
  $("chatChips").addEventListener("click", e => { const b = e.target.closest("[data-chip]"); if (b) enviarChat(b.dataset.chip); });
  $("chatCuerpo").addEventListener("click", e => {
    const flecha = e.target.closest("[data-desplazar]");
    if (flecha){ flecha.parentElement.querySelector(".chat-prods").scrollBy({left: Number(flecha.dataset.desplazar) * 290, behavior: reduceMotion() ? "auto" : "smooth"}); return; }
    const ver = e.target.closest("[data-chat-abrir]");
    if (ver){ ACCIONES_CHAT.abrir_producto({codigo: ver.dataset.chatAbrir}); return; }
    const op = e.target.closest("[data-opcion]");
    if (op){
      const m = MSJ_DE.get(op.parentElement);
      if (!m || m.elegida || CHAT.enviando) return;
      m.elegida = m.opciones[op.dataset.opcion];
      for (const b of op.parentElement.children) b.disabled = true;
      op.classList.add("elegida");
      medir("chat-opcion");
      if (m.guia) responderGuia(m); else enviarChat(m.elegida);
      return;
    }
    const des = e.target.closest("[data-chat-deshacer]");
    if (des){
      const m = MSJ_DE.get(des.closest(".chat-msj"));
      if (!m?.deshacer) return;
      for (const [c, q] of m.deshacer){ const p = buscar(c), max = p ? maxQty(p) : 0; if (max) PEDIDO.items.set(p.code, Math.min(q, max)); }
      m.deshacer = null; des.remove();
      guardarPedido(); actualizarPedido();
      decir("Listo, tu pedido volvió como estaba ✅");
      return;
    }
    const cop = e.target.closest("[data-copiar]");
    if (cop){
      navigator.clipboard?.writeText(cop.dataset.copiar).then(() => { cop.textContent = "¡Enlace copiado! ✓"; $("aviso").textContent = "Enlace copiado"; }, () => {});
      medir("compartir", {via: "chat"});
      return;
    }
    const rep = e.target.closest("[data-repetir]");
    if (rep){ contarRepetido(repetirPedido(rep.dataset.repetir), rep.dataset.repetir); return; }
    const otra = e.target.closest("[data-reintentar]");
    if (otra && !CHAT.enviando){
      const t = CHAT.mensajes.find(x => x.error && x.reintentar)?.reintentar;
      CHAT.mensajes = CHAT.mensajes.filter(x => !x.error);
      otra.closest(".chat-msj").remove();
      if (t) enviarChat(t, true);
    }
  });
  if ("speechSynthesis" in window){
    $("chatVoz").hidden = false; pintarVoz();
    $("chatVoz").onclick = () => {
      CHAT.voz = !CHAT.voz; pintarVoz();
      try { localStorage.setItem(CLAVE_CHAT_VOZ, CHAT.voz ? "1" : "0"); } catch(e) {}
      if (!CHAT.voz) speechSynthesis.cancel();
    };
  }
  if (Reconocer){ $("chatMic").hidden = false; $("chatMic").onclick = dictar; }
  // Desde la ficha: "Preguntar" abre el chat hablando de ese producto.
  if (CONFIG.chatMascotaUrl) $("dChat").hidden = false;
  $("secGuia").hidden = !CONFIG.chatMascotaUrl || !!VITRINA_URL;
  $("dChat").onclick = () => {
    const p = D?.p; if (!p) return;
    $("dlg").close();
    citar([p]);
    CHAT.desdeFicha = p.code;
    abrirChat(`Cuéntame del ${p.name}`);
  };
}

// Ayudante: después de un rato mirando la tienda (ya fuera de la portada), el muñequito ofrece
// abrir el chat (o WhatsApp si no hay chat). Una sola vez por visita; no sale con una ventana
// abierta ni en el modo vitrina.
{
  const CLAVE = "eg_ayudante", ya = () => { try { return sessionStorage.getItem(CLAVE); } catch { return "1"; } };
  const marcar = () => { try { sessionStorage.setItem(CLAVE, "1"); } catch {} };
  const mostrarBoton = () => { if (CONFIG.chatMascotaUrl) $("chatBoton").hidden = false; };
  const ocultar = () => { const a = $("ayudante"); if (a.hidden) return; a.classList.add("sale"); setTimeout(()=>{ a.hidden = true; a.classList.remove("entra", "sale"); mostrarBoton(); }, 280); };
  const mostrar = () => {
    if (ya()) return;
    if (document.querySelector("dialog[open]") || scrollY < innerHeight * .8 || document.visibilityState !== "visible" || document.body.matches(".en-anillo, .en-portal")){ setTimeout(mostrar, 6000); return; }
    marcar();
    const a = $("ayudante");
    a.hidden = false; a.classList.add("entra");
    medir("ayudante");
    setTimeout(ocultar, 12000);
  };
  if (!VITRINA_URL && !ya()) setTimeout(mostrar, 16000);
  else setTimeout(mostrarBoton, 4000);
  $("ayudanteCerrar").onclick = ocultar;
  $("ayudanteLink").addEventListener("click", ()=>{ medir("ayudante-chat"); ocultar(); abrirChat(); });
  $("ayudanteCara").addEventListener("click", ()=>{ medir("ayudante-chat"); ocultar(); abrirChat(); });
  $("chatBoton").addEventListener("click", () => abrirChat());
  $("waFloat").addEventListener("click", marcar);
}

// Sin internet: el muñequito avisa (triste); cuando vuelve la conexión, levanta el pulgar.
{
  const avisar = ok => {
    const a = $("avisoRed");
    a.querySelector("img").src = `mascota/poses/${ok ? "pulgar" : "triste"}.webp`;
    $("avisoRedTxt").textContent = ok ? "¡Volvió el internet!" : "Sin internet: ves lo último que guardamos";
    a.hidden = false;
    clearTimeout(avisar.t);
    if (ok) avisar.t = setTimeout(()=>{ a.hidden = true; }, 2600);
  };
  addEventListener("offline", ()=>avisar(false));
  addEventListener("online", ()=>{ if (!$("avisoRed").hidden) avisar(true); });
  if (navigator.onLine === false) avisar(false);
}

// Código secreto en computadora (↑ ↑ ↓ ↓ ← → ← → B A): modo fiesta.
{
  const CODIGO = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  addEventListener("keydown", e=>{
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === CODIGO[pos] ? pos + 1 : (k === CODIGO[0] ? 1 : 0);
    if (pos < CODIGO.length) return;
    pos = 0;
    scrollTo({top: 0, behavior: reduceMotion() ? "auto" : "smooth"});
    setTimeout(()=>{
      if (MASCOTA.api) MASCOTA.api.fiesta();
      else { decirMascota("¡Modo fiesta activado!", 3400); fiestaMascota(); }
    }, 500);
  });
}

$("mascotaArriba").onclick = ()=>{
  scrollTo({top: 0, behavior: reduceMotion() ? "auto" : "smooth"});
  setTimeout(()=>MASCOTA.api ? MASCOTA.api.saludar("¡Aquí estoy! ¿Qué buscamos hoy?") : decirMascota("¡Aquí estoy! ¿Qué buscamos hoy?"), reduceMotion() ? 100 : 900);
};

// Encabezado con sombra apenas se baja de la parte de arriba.
{
  const cabecera = document.querySelector("header.top");
  addEventListener("scroll", ()=>cabecera.classList.toggle("con-sombra", scrollY > 8), {passive: true});
}

// ===== Pastilla de la categoría elegida =====
function moverIndicador(){
  const ind = $("chipInd"), chip = $("chips").querySelector('.chip[aria-pressed="true"]');
  if (!ind || !chip) return;
  ind.style.width = chip.offsetWidth + "px";
  ind.style.height = chip.offsetHeight + "px";
  ind.style.translate = `${chip.offsetLeft}px ${chip.offsetTop}px`;
  if (ind.classList.contains("quieto")) requestAnimationFrame(()=>requestAnimationFrame(()=>ind.classList.remove("quieto")));
}
addEventListener("resize", ()=>{ $("chipInd")?.classList.add("quieto"); moverIndicador(); }, {passive: true});
document.fonts?.ready.then(()=>{ $("chipInd")?.classList.add("quieto"); moverIndicador(); });

// ===== Vitrina 3D de la portada: sigue al mouse o la inclinación del celular =====
if (!reduceMotion()){
  let cuadro3d = 0;
  const inclinar = (rx, ry) => {
    cancelAnimationFrame(cuadro3d);
    cuadro3d = requestAnimationFrame(()=>{ $("stream").style.setProperty("--rx", `${rx.toFixed(1)}deg`); $("stream").style.setProperty("--ry", `${ry.toFixed(1)}deg`); });
  };
  const angosto = matchMedia("(max-width: 960px)");
  if (matchMedia("(hover: hover) and (pointer: fine)").matches){
    $("hero").addEventListener("pointermove", e=>{
      if (angosto.matches) return;
      const r = $("hero").getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      inclinar(9 - y * 8, -14 + x * 10);
    }, {passive: true});
    $("hero").addEventListener("pointerleave", ()=>{ if (!angosto.matches) inclinar(9, -14); });
  }
  // Celular: al inclinar el teléfono, la pared de fotos se inclina con él. No se pide permiso:
  // en Android llega solo; en iPhone (que exige permiso) simplemente no llega y queda quieta.
  if ("DeviceOrientationEvent" in window){
    addEventListener("deviceorientation", e=>{
      if (e.gamma == null || $("hero").classList.contains("quieto") || !angosto.matches) return;
      const g = Math.max(-25, Math.min(25, e.gamma)), b = Math.max(10, Math.min(80, e.beta || 45));
      inclinar(14 + (b - 45) / 7, g / 4);
    }, {passive: true});
  }
}

// ===== Portal de los mundos: logos en 3D que giran con el scroll =====
// Cada marca ocupa la pantalla con su color y su logo en relieve; el texto, las cifras y el botón
// de entrar cambian con ella. Sin WebGL 2, con "reducir movimiento" o ahorro de datos, quedan las tarjetas.
const PORTAL = {mundos: [], i: -1, pista: true};
function prepararPortal(){
  const puede = "WebGL2RenderingContext" in window && "ResizeObserver" in window && "IntersectionObserver" in window && !navigator.connection?.saveData && !reduceMotion();
  const orden = {consolas: 0, palancas: 1, juegos: 2, accesorios: 3};
  PORTAL.mundos = Object.entries(CONFIG.mundos).map(([m, cfg])=>{
    const de = PRODUCTS.filter(p=>plataformasDe(p).includes(m));
    const fotos = de.filter(p=>p.photos.length).sort((a, b)=>(orden[a.cat] ?? 9) - (orden[b.cat] ?? 9)).slice(0, 3);
    const porCat = new Map();
    for (const p of de) porCat.set(p.cat_label || p.cat, (porCat.get(p.cat_label || p.cat) || 0) + 1);
    return {m, cfg, n: de.length, fotos, porCat: [...porCat].sort((a, b)=>b[1] - a[1])};
  }).filter(w=>w.n);
  if (!puede || PORTAL.mundos.length < 2) return;
  $("portal").hidden = false;
  $("portal").style.setProperty("--pasos", PORTAL.mundos.length - 1);
  new IntersectionObserver(([e])=>document.body.classList.toggle("en-portal", e.isIntersecting), {rootMargin: "-40% 0px -40% 0px"}).observe($("portal"));
  document.body.classList.add("con-portal");
  $("portalPuntos").innerHTML = PORTAL.mundos.map((w, k)=>`<button type="button" data-portal="${k}" aria-label="Ver el mundo ${esc(w.m)}" style="--c:${w.cfg.c}">
    <svg class="${w.m === "Nintendo" ? "ancho" : ""}" aria-hidden="true"><use href="#${w.cfg.logo}"/></svg></button>`).join("");
  pintarPortal(0);
  const io = new IntersectionObserver(([e])=>{ if (e.isIntersecting){ io.disconnect(); cargarPortal(); } }, {rootMargin: "900px 0px"});
  alInteractuar(()=>io.observe($("portal")));
}
async function cargarPortal(){
  try {
    const [{iniciar}, logos] = await Promise.all([import(`./portal3d.js?v=${VERSION}`), fetch(`logos3d.json?v=${VERSION}`).then(r=>r.json())]);
    iniciar({contenedor: $("portalEscena"), lienzo: $("portalCanvas"), seccion: $("portal"), logos, reducir: reduceMotion(),
      mundos: PORTAL.mundos.map(w=>({logo: w.cfg.logo3d, c: w.cfg.c, c2: w.cfg.c2})),
      alCambiar: pintarPortal,
      alElegir: k=>{ const w = PORTAL.mundos[k]; medir("mundo", {plataforma: w.m, desde: "portal"}); aplicarFiltro({plat: w.m, cat: "all", q: ""}); }});
    $("portalEscena").classList.add("listo");
  } catch(e) {
    $("portal").hidden = true;   // sin 3D: vuelven las tarjetas de los mundos
    document.body.classList.remove("con-portal");
  }
}
function pintarPortal(k){
  const w = PORTAL.mundos[k]; if (!w || PORTAL.i === k) return;
  if (PORTAL.i >= 0 && PORTAL.pista){ PORTAL.pista = false; $("portal").classList.add("sin-pista"); }
  PORTAL.i = k;
  const n = PORTAL.mundos.length, dos = x => String(x).padStart(2, "0");
  const cuenta = (c, t) => `${c} ${esc((c === 1 ? t.replace(/s$/i, "") : t).toLowerCase())}`;
  const e = $("portalEscena");
  e.style.setProperty("--pc", w.cfg.c);
  e.style.setProperty("--pc2", w.cfg.c2);
  $("portalTexto").innerHTML = `
    <p class="kicker">Elige tu consola · ${dos(k + 1)}/${dos(n)}</p>
    <p class="portal-nombre">${esc(w.m)}</p>
    <p class="portal-frase">${esc(w.cfg.frase)}</p>
    <p class="portal-cifras"><b>${w.n}</b> productos ${w.porCat.slice(0, 4).map(([c, x])=>`<span>${cuenta(x, c)}</span>`).join("")}</p>
    ${w.fotos.length ? `<div class="portal-fan" aria-hidden="true">${w.fotos.map((p, i)=>`<span style="--k:${i}"><img src="${esc(fotoMini(p.photos[0]))}" alt="" width="120" height="120" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></span>`).join("")}</div>` : ""}
    <a class="btn portal-cta" href="#catalogo" data-ir-plat="${esc(w.m)}">Entrar al mundo ${esc(w.m)}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></a>`;
  const t = $("portalTexto");
  t.classList.remove("entra"); void t.offsetWidth; t.classList.add("entra");
  $("portalPuntos").querySelectorAll("button").forEach((b, i)=>b.setAttribute("aria-current", i === k));
}
// Los botones de logos llevan la página hasta el mundo elegido (la tornamesa gira sola).
$("portalPuntos").addEventListener("click", e=>{
  const b = e.target.closest("[data-portal]"); if (!b) return;
  const s = $("portal"), k = Number(b.dataset.portal), recorrido = s.offsetHeight - innerHeight;
  scrollTo({top: s.getBoundingClientRect().top + scrollY + recorrido * k / (PORTAL.mundos.length - 1), behavior: reduceMotion() ? "auto" : "smooth"});
});

// ===== Visor de fotos a pantalla completa =====
// Muestra la copia de 2000 px: pellizcar o tocar dos veces acerca (hasta 5x), arrastrar recorre la
// foto, deslizar de lado cambia de foto y deslizar hacia abajo cierra. Con mouse: clic o rueda acercan.
const V = {p: null, i: 0, s: 1, x: 0, y: 0, dedos: new Map(), gesto: null, ultimoToque: 0};
function abrirVisor(p, i, {oscuro = false} = {}){
  if (!p.photos.length) return;
  V.p = p; V.i = i;
  $("visor").classList.toggle("oscuro", oscuro);   // fotos de los locales: fondo oscuro, no el blanco de los productos
  $("visor").showModal();
  pintarVisor();
  medir("zoom-foto", {codigo: p.code});
}
function pintarVisor(){
  const src = V.p.photos[V.i], img = $("visorImg");
  V.s = 1; V.x = V.y = 0;
  img.style.opacity = "";
  aplicarVisor(false);
  img.alt = `${V.p.name}, foto ${V.i + 1}`;
  img.src = src;   // la foto normal aparece al instante y se cambia por la de 2000 px cuando llega
  const grande = new Image();
  grande.onload = ()=>{ if (V.p?.photos[V.i] === src) img.src = grande.src; };
  grande.src = fotoZoom(src);
  const n = V.p.photos.length;
  $("visorN").textContent = n > 1 ? `${V.i + 1} / ${n}` : "";
  $("visorAnt").hidden = $("visorSig").hidden = n < 2;
}
// Centro de la foto sin acercar y hasta dónde se puede mover: acercada, sus bordes nunca se despegan de los de la pantalla.
function limitesVisor(){
  const img = $("visorImg"), L = $("visorLienzo").getBoundingClientRect();
  const cx = L.left + img.offsetLeft + img.clientWidth / 2, cy = L.top + img.offsetTop + img.clientHeight / 2;
  const eje = (c, tam, ini, vista) => tam <= vista ? [0, 0] : [ini + vista - c - tam / 2, ini - c + tam / 2];
  return {cx, cy, x: eje(cx, img.clientWidth * V.s, L.left, L.width), y: eje(cy, img.clientHeight * V.s, L.top, L.height)};
}
function aplicarVisor(anim = true){
  const {x, y} = limitesVisor();
  V.x = Math.max(x[0], Math.min(x[1], V.x));
  V.y = Math.max(y[0], Math.min(y[1], V.y));
  const img = $("visorImg");
  img.style.transition = anim && !reduceMotion() ? "transform 280ms cubic-bezier(.2,.8,.2,1)" : "none";
  img.style.transform = `translate(${V.x.toFixed(1)}px, ${V.y.toFixed(1)}px) scale(${V.s.toFixed(3)})`;
  $("visor").classList.toggle("acercado", V.s > 1.02);
}
// Acerca a la escala s dejando quieto el punto (cx, cy) de la pantalla.
function zoomVisor(s, cx, cy, anim){
  const c = limitesVisor();
  const ox = cx - c.cx, oy = cy - c.cy;
  const s1 = Math.max(1, Math.min(5, s));
  V.x = ox - (ox - V.x) * s1 / V.s;
  V.y = oy - (oy - V.y) * s1 / V.s;
  V.s = s1;
  aplicarVisor(anim);
}
function cambiarFotoVisor(d){
  const n = V.p.photos.length; if (n < 2) return;
  V.i = (V.i + d + n) % n;
  pintarVisor();
  if (!reduceMotion()) $("visorImg").animate?.([{opacity: 0, translate: `${d * 40}px 0`}, {opacity: 1, translate: "0 0"}], {duration: 260, easing: "cubic-bezier(.2,.8,.2,1)"});
}
{
  const L = $("visorLienzo"), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  L.addEventListener("pointerdown", e=>{
    L.setPointerCapture(e.pointerId);
    V.dedos.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const d = [...V.dedos.values()];
    if (d.length === 1) V.gesto = {tipo: "uno", x: e.clientX, y: e.clientY, vx: V.x, vy: V.y, movio: false};
    else if (d.length === 2) V.gesto = {tipo: "pinza", d: dist(d[0], d[1]), s: V.s, mx: (d[0].x + d[1].x) / 2, my: (d[0].y + d[1].y) / 2, vx: V.x, vy: V.y};
  });
  L.addEventListener("pointermove", e=>{
    if (!V.dedos.has(e.pointerId) || !V.gesto) return;
    V.dedos.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const d = [...V.dedos.values()], g = V.gesto;
    if (g.tipo === "pinza" && d.length === 2){
      const mx = (d[0].x + d[1].x) / 2, my = (d[0].y + d[1].y) / 2;
      V.s = g.s; V.x = g.vx + (mx - g.mx); V.y = g.vy + (my - g.my);
      zoomVisor(g.s * dist(d[0], d[1]) / g.d, mx, my, false);
    } else if (g.tipo === "uno"){
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) > 8) g.movio = true;
      if (V.s > 1.02){ V.x = g.vx + dx; V.y = g.vy + dy; aplicarVisor(false); }
      else if (g.movio && e.pointerType !== "mouse"){   // sin acercar: la foto sigue al dedo (cambiar o cerrar)
        const img = $("visorImg");
        img.style.transition = "none";
        img.style.transform = Math.abs(dx) > Math.abs(dy) ? `translate(${dx}px, 0)` : `translate(0, ${Math.max(0, dy)}px) scale(${1 - Math.max(0, dy) / 1400})`;
        img.style.opacity = Math.abs(dy) > Math.abs(dx) ? String(1 - Math.max(0, dy) / 500) : "";
      }
    }
  });
  const soltar = e=>{
    if (!V.dedos.has(e.pointerId)) return;
    V.dedos.delete(e.pointerId);
    const g = V.gesto;
    if (V.dedos.size === 1 && g?.tipo === "pinza"){   // levantó un dedo: sigue arrastrando con el otro
      const [q] = V.dedos.values();
      V.gesto = {tipo: "uno", x: q.x, y: q.y, vx: V.x, vy: V.y, movio: true};
      return;
    }
    if (V.dedos.size) return;
    V.gesto = null;
    if (!g || g.tipo !== "uno") return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.movio){
      // Toque: con mouse, un clic acerca/aleja; con el dedo, dos toques seguidos.
      const ahora = performance.now(), doble = ahora - V.ultimoToque < 320;
      V.ultimoToque = doble ? 0 : ahora;
      if (e.pointerType === "mouse" || doble){
        if (V.s > 1.02){ V.s = 1; V.x = V.y = 0; aplicarVisor(); }
        else zoomVisor(2.6, e.clientX, e.clientY, true);
      }
      return;
    }
    if (V.s <= 1.02 && e.pointerType !== "mouse"){
      $("visorImg").style.opacity = "";
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) cambiarFotoVisor(dx < 0 ? 1 : -1);
      else if (dy > 120) $("visor").close();
      else aplicarVisor();
    }
  };
  L.addEventListener("pointerup", soltar);
  L.addEventListener("pointercancel", soltar);
  L.addEventListener("wheel", e=>{ e.preventDefault(); zoomVisor(V.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY, false); }, {passive: false});
  $("visorCerrar").onclick = ()=>$("visor").close();
  $("visorAnt").onclick = ()=>cambiarFotoVisor(-1);
  $("visorSig").onclick = ()=>cambiarFotoVisor(1);
  $("visor").addEventListener("keydown", e=>{
    if (e.key === "ArrowRight") cambiarFotoVisor(1);
    else if (e.key === "ArrowLeft") cambiarFotoVisor(-1);
    else if (e.key === "+" || e.key === "=") zoomVisor(V.s * 1.4, innerWidth / 2, innerHeight / 2, true);
    else if (e.key === "-") zoomVisor(V.s / 1.4, innerWidth / 2, innerHeight / 2, true);
  });
  $("visor").addEventListener("close", ()=>{ V.dedos.clear(); V.gesto = null; });
  addEventListener("resize", ()=>{ if ($("visor").open) aplicarVisor(false); }, {passive: true});
}

// ===== Vitrina 360°: anillo 3D de productos alrededor del logo en relieve =====
// La sección aparece cuando cargan los productos; el 3D (escena3d.js + three.js, ~150 KB) se
// descarga recién cuando la persona se acerca a ella. Sin WebGL 2 o con "ahorro de datos", no se muestra.
const A3D = {lista: [], i: 0, api: null, anunciar: false};
function prepararAnillo(){
  const conFoto = PRODUCTS.filter(p=>p.photos.length && maxQty(p) > 0);
  // Se alternan consolas, palancas y juegos (lo más vendido de cada una), para que se sienta como una vitrina.
  const grupos = ["consolas", "palancas", "juegos", "accesorios"].map(c=>conFoto.filter(p=>p.cat === c)).filter(g=>g.length);
  const lista = [];
  for (let k = 0; lista.length < 14 && grupos.some(g=>g[k]); k++) for (const g of grupos) if (g[k] && lista.length < 14) lista.push(g[k]);
  const puede = "WebGL2RenderingContext" in window && "ResizeObserver" in window && "IntersectionObserver" in window && !navigator.connection?.saveData;
  if (lista.length < 6 || !puede) return;
  A3D.lista = lista;
  $("secAnillo").hidden = false;
  pintarInfoAnillo(0);
  new IntersectionObserver(([e])=>document.body.classList.toggle("en-anillo", e.isIntersecting), {rootMargin: "-40% 0px -40% 0px"}).observe($("secAnillo"));
  let pedido = false;
  const cargar = () => { if (pedido) return; pedido = true; io.disconnect(); cargarAnillo(); };
  const io = new IntersectionObserver(([e])=>{ if (e.isIntersecting) cargar(); }, {rootMargin: "900px 0px"});
  // Se arma en un momento libre (mientras se mira la portada) y no justo al llegar a ella con el scroll,
  // que es cuando más se nota una pausa; siempre después de la primera interacción.
  alInteractuar(()=>{
    io.observe($("secAnillo"));
    if ("requestIdleCallback" in window) setTimeout(()=>requestIdleCallback(cargar), 2500);
  });
}
async function cargarAnillo(){
  try {
    // La versión evita usar una copia vieja tras publicar. El muñequito del centro es el mismo módulo de la portada.
    const [{iniciar}, mascota] = await Promise.all([import(`./escena3d.js?v=${VERSION}`), import(`./mascota3d.js?v=${VERSION}`).catch(()=>null)]);
    A3D.api = iniciar({
      contenedor: $("anilloLienzo"), lienzo: $("anilloCanvas"), seccion: $("secAnillo"), reducir: reduceMotion(), crearMascota: mascota?.crearMascota,
      productos: A3D.lista.map(p=>{
        const {txt, m} = consolaDe(p);
        return {code: p.code, foto: fotoMini(p.photos[0]), respaldo: p.photos[0], precio: precio(p, "efectivo"), tag: txt, tagColor: colorMundo(m), tagInk: m === "Retro" ? "#140900" : "#fff"};
      }),
      alCambiar: pintarInfoAnillo,
      alElegir: code=>{ medir("vitrina-360", {codigo: code}); openProduct(code); }
    });
    $("anilloLienzo").classList.add("listo");
  } catch(e) {
    $("secAnillo").hidden = true;   // navegador sin WebGL o sin memoria para 3D: la tienda sigue igual
  }
}
function pintarInfoAnillo(i){
  const p = A3D.lista[i]; if (!p) return;
  const cambio = A3D.i !== i;
  A3D.i = i;
  const b = $("anilloVer"), pr = fmt(precio(p, "efectivo"));
  b.dataset.code = p.code;
  b.setAttribute("aria-label", `Ver ${p.name}, ${pr}`);
  b.innerHTML = `<span class="cat-row"><span class="cat">${esc(p.cat_label || "")}</span>${etiquetaPlat(p)}</span><strong>${esc(p.name)}</strong><span class="ir">${pr}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>`;
  if (cambio && !reduceMotion()) b.animate?.([{opacity: 0.35, translate: "0 6px"}, {opacity: 1, translate: "0 0"}], {duration: 320, easing: "cubic-bezier(0.23,1,0.32,1)"});
  if (A3D.anunciar){ A3D.anunciar = false; $("aviso").textContent = `${p.name}, ${pr}`; }
}
function girarAnillo(d){
  A3D.anunciar = true;
  if (A3D.api) A3D.api.girar(d);
  else pintarInfoAnillo((A3D.i + d + A3D.lista.length) % A3D.lista.length);
}
$("anilloAnt").onclick = ()=>girarAnillo(-1);
$("anilloSig").onclick = ()=>girarAnillo(1);
$("anilloVer").onclick = ()=>{ const code = $("anilloVer").dataset.code; if (code){ medir("vitrina-360", {codigo: code}); openProduct(code); } };
$("anilloPie").addEventListener("keydown", e=>{
  if (e.key === "ArrowLeft" || e.key === "ArrowRight"){ e.preventDefault(); girarAnillo(e.key === "ArrowRight" ? 1 : -1); }
});

// ===== Cintas cruzadas: corren solas y se aceleran (y cambian de sentido) con el scroll =====
{
  const zona = document.querySelector(".cintas"), cintas = [...document.querySelectorAll(".cinta")];
  if (zona && !reduceMotion() && "IntersectionObserver" in window){
    let visible = false, cuadro = 0, t0 = 0, x = 0, dir = 1, extra = 0, yAntes = scrollY;
    let anchos = [];
    const medirCintas = () => { anchos = cintas.map(c=>c.firstElementChild.offsetWidth); };
    addEventListener("resize", medirCintas, {passive: true});
    document.fonts?.ready.then(medirCintas);
    addEventListener("scroll", ()=>{
      const dy = scrollY - yAntes; yAntes = scrollY;
      if (!visible || !dy) return;
      dir = Math.sign(dy);
      extra = Math.min(700, extra + Math.abs(dy) * 9);
    }, {passive: true});
    const mover = t=>{
      if (!visible){ cuadro = 0; return; }
      const dt = Math.min(0.05, (t - (t0 || t)) / 1000); t0 = t;
      extra *= Math.exp(-dt * 2.6);
      x += (48 + extra) * dt * dir;
      cintas.forEach((c, k)=>{
        const w = anchos[k]; if (!w) return;
        const d = ((((k ? -x : x) % w) + w) % w).toFixed(1);
        for (const pista of c.children) pista.style.transform = `translate3d(${-d}px,0,0)`;
      });
      cuadro = requestAnimationFrame(mover);
    };
    medirCintas();
    new IntersectionObserver(([e])=>{
      visible = e.isIntersecting;
      if (visible && !cuadro){ t0 = 0; cuadro = requestAnimationFrame(mover); }
    }).observe(zona);
  }
}

// Solo mientras la sección está en pantalla se escucha el scroll (y se dibuja una vez por cuadro).
function alPasar(el, pintar){
  let cuadro = 0;
  const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(()=>{ cuadro = 0; pintar(); }); };
  new IntersectionObserver(([e])=>{
    if (e.isIntersecting){ addEventListener("scroll", pedir, {passive: true}); addEventListener("resize", pedir, {passive: true}); pintar(); }
    else { removeEventListener("scroll", pedir); removeEventListener("resize", pedir); }
  }).observe(el);
}

// ===== Manifiesto: cada palabra se enciende a medida que se lee =====
{
  const m = $("mani");
  if (m && !reduceMotion() && "IntersectionObserver" in window){
    const envolver = nodo=>{
      for (const n of [...nodo.childNodes]){
        if (n.nodeType === 1){ envolver(n); continue; }
        if (n.nodeType !== 3) continue;
        const f = document.createDocumentFragment();
        for (const t of n.textContent.split(/(\s+)/)) if (t) f.append(/^\s+$/.test(t) ? t : Object.assign(document.createElement("span"), {className: "pal", textContent: t}));
        n.replaceWith(f);
      }
    };
    envolver(m);
    const pals = [...m.querySelectorAll(".pal")], antes = pals.map(()=>"");
    m.classList.add("activo");
    alPasar(m, ()=>{
      const r = m.getBoundingClientRect(), vh = innerHeight;
      const k = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (r.height * 0.9 + vh * 0.3)));
      const n = k * (pals.length + 1);
      // Solo se tocan las palabras que cambian (en cada cuadro son una o dos): así no se recalcula todo el texto.
      pals.forEach((w, i)=>{
        const o = (0.6 + 0.4 * Math.min(1, Math.max(0, n - i))).toFixed(2);
        if (o !== antes[i]){ antes[i] = o; w.style.setProperty("--o", o); }
      });
    });
  }
}

// ===== Cómo comprar: cada paso se achica y oscurece cuando el siguiente lo tapa =====
{
  const pasos = [...document.querySelectorAll("#pasos li")];
  const antes = pasos.map(()=>"");
  if (pasos.length > 1 && !reduceMotion() && "IntersectionObserver" in window)
    alPasar($("pasos"), ()=>{
      // Primero se mide todo y después se escribe: medir entre escrituras obliga al navegador a recalcular.
      const cajas = pasos.map(li=>li.getBoundingClientRect()), altos = pasos.map(li=>li.offsetHeight);
      pasos.forEach((li, i)=>{
        if (i === pasos.length - 1) return;
        const alto = altos[i];
        const k = Math.min(1, Math.max(0, (cajas[i].top + alto - cajas[i + 1].top) / Math.max(1, alto - 18))).toFixed(2);
        if (k !== antes[i]){ antes[i] = k; li.style.setProperty("--k", k); }
      });
    });
}

// ===== Con mouse: cursor de marca, botones magnéticos, texto que rueda y luz en la portada =====
if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion()){
  // Cursor: un aro naranja que sigue al mouse con un poco de retraso. Sobre un producto dice "Ver";
  // sobre la vitrina 360°, "Arrastra". El cursor normal del sistema se mantiene.
  const cur = $("cursor"), txt = $("cursorTxt");
  let x = -100, y = -100, cx = x, cy = y, cuadro = 0, dentro = false;
  const seguir = ()=>{
    cx += (x - cx) * 0.24; cy += (y - cy) * 0.24;
    cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    cuadro = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(seguir) : 0;
  };
  const estado = t=>{
    // Las ventanas (ficha, pedido, buscador) quedan por encima de todo: ahí el aro sobra.
    if (document.querySelector("dialog[open]") || t.closest?.("input, textarea, select")){ cur.classList.remove("on"); return; }
    cur.classList.add("on");
    const conTexto = t.closest?.("[data-cursor], .card-open, .stream-item");
    const etiqueta = conTexto ? (conTexto.dataset.cursor || "Ver") : "";
    cur.classList.toggle("txt", !!etiqueta);
    cur.classList.toggle("link", !etiqueta && !!t.closest?.("a, button, summary, label, [role=option]"));
    if (etiqueta && txt.textContent !== etiqueta) txt.textContent = etiqueta;
  };
  document.addEventListener("pointermove", e=>{
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    if (!dentro){ cx = x; cy = y; dentro = true; }
    estado(e.target);
    if (!cuadro) cuadro = requestAnimationFrame(seguir);
  }, {passive: true});
  document.documentElement.addEventListener("pointerleave", ()=>{ cur.classList.remove("on"); dentro = false; });
  document.addEventListener("pointerdown", ()=>cur.classList.add("abajo"), {passive: true});
  document.addEventListener("pointerup", ()=>cur.classList.remove("abajo"), {passive: true});

  // Botones magnéticos: se acercan al mouse y vuelven con un pequeño rebote al salir.
  const MAGNETICOS = ".btn, .icon-btn, .cart-btn, .wa-top, .rail-nav button, .more button, .anillo-flecha";
  let iman = null;
  const soltarIman = el=>{ if (!el) return; el.classList.remove("imanta"); el.style.translate = ""; };
  document.addEventListener("pointermove", e=>{
    const el = e.target.closest?.(MAGNETICOS);
    if (el !== iman){ soltarIman(iman); iman = el; if (el) el.classList.add("magnet", "imanta"); }
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
  }, {passive: true});
  document.addEventListener("pointerout", e=>{ if (iman && !iman.contains(e.relatedTarget)){ soltarIman(iman); iman = null; } }, {passive: true});

  // El texto de los botones principales "rueda" al pasar el mouse (se envuelve una sola vez).
  for (const b of document.querySelectorAll(".btn, .more button"))
    for (const n of [...b.childNodes]) if (n.nodeType === 3 && n.textContent.trim()){
      const s = document.createElement("span");
      s.className = "rodar";
      s.innerHTML = `<span>${esc(n.textContent.trim())}</span>`;
      n.replaceWith(s);
    }

  // Portada: una luz cálida sigue al mouse por detrás del titular.
  const hero = $("hero");
  hero.addEventListener("pointermove", e=>{
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--hx", `${(e.clientX - r.left).toFixed(0)}px`);
    hero.style.setProperty("--hy", `${(e.clientY - r.top).toFixed(0)}px`);
    hero.classList.add("luz");
  }, {passive: true});
  hero.addEventListener("pointerleave", ()=>hero.classList.remove("luz"));
}

// ===== Pedido enviado: celebración (el momento más importante de la tienda) =====
function esperarVisible(fn){
  const h = ()=>{ if (document.visibilityState === "visible"){ document.removeEventListener("visibilitychange", h); setTimeout(fn, 250); } };
  document.addEventListener("visibilitychange", h);
}
function confeti(cont){
  const colores = ["#FF7A00", "#FE8903", "#FFC61A", "#F7F4EF", "#25D366"];
  for (let i = 0; i < 30; i++){
    const c = document.createElement("span");
    c.className = "confeti";
    c.style.background = colores[i % colores.length];
    cont.appendChild(c);
    const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 150;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - 70;
    // Cada papelito gira en 3D mientras sale disparado y cae.
    c.animate([
      {transform: "translate(-50%, -50%) rotateX(0deg) rotateY(0deg)", opacity: 1},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotateX(${360 + Math.random() * 360}deg) rotateY(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55},
      {transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 180}px)) rotateX(720deg) rotateY(720deg)`, opacity: 0}
    ], {duration: 1200 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)"}).finished.then(()=>c.remove(), ()=>c.remove());
    setTimeout(()=>c.remove(), 2200);
  }
}
function celebrarPedido(){
  if (!$("cart").open) return;
  $("exitoCod").textContent = PEDIDO.codigo;
  $("exito").hidden = false;
  const animar = () => {
    if (reduceMotion() || !$("cart").open || $("exito").hidden) return;
    $("exitoCheck").animate([{transform: "perspective(500px) rotateY(180deg) scale(.6)", opacity: 0}, {transform: "perspective(500px) rotateY(0deg) scale(1)", opacity: 1}],
      {duration: 560, easing: "cubic-bezier(.34,1.56,.64,1)"});
    $("exitoCheck").querySelector("path").animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}], {duration: 420, delay: 280, easing: "cubic-bezier(0.23,1,0.32,1)", fill: "backwards"});
    $("exitoMascota").animate([{translate: "0 60%", scale: ".4", opacity: 0}, {translate: "0 -12%", scale: "1.06", opacity: 1, offset: .6}, {translate: "0 0", scale: "1", opacity: 1}],
      {duration: 700, easing: "cubic-bezier(.3,1.3,.5,1)"});
    confeti($("exito"));
  };
  // Si WhatsApp tapó la página, la celebración espera a que el cliente vuelva.
  if (document.visibilityState === "visible") setTimeout(()=>document.visibilityState === "visible" ? animar() : esperarVisible(animar), 300);
  else esperarVisible(animar);
}
$("exitoVaciar").onclick = ()=>{
  PEDIDO.items.clear(); PEDIDO.codigo = ""; guardarPedido();
  $("exito").hidden = true;
  $("cart").close();
  actualizarPedido();
  $("aviso").textContent = "Pedido vaciado. ¡Gracias por tu compra!";
};
$("exitoMantener").onclick = ()=>{ $("exito").hidden = true; };
$("cart").addEventListener("close", ()=>{ $("exito").hidden = true; });

// ===== Vitrina en pantalla completa (para una tablet en la tienda) =====
// Muestra en grande los productos con foto, uno por uno, con precio, stock y un QR para pedirlo.
// Se abre con "Ver en grande", desde el menú o con la dirección ?vitrina (o ?vitrina=playstation).
const K = {lista: [], i: 0, pausa: false, mundo: "todo", timer: 0, dur: 7000, wake: null, quieto: 0, refresco: 0, pantallaCompleta: false};
const QR_CACHE = new Map();
function listaVitrina(){
  const m = Object.keys(CONFIG.mundos).find(k=>k.toLowerCase() === K.mundo);
  return PRODUCTS.filter(p=>p.photos.length && maxQty(p) > 0 && (!m || plataformasDe(p).includes(m)));
}
function pintarControlesVitrina(){
  const mundos = Object.keys(CONFIG.mundos).filter(m=>PRODUCTS.some(p=>p.photos.length && maxQty(p) > 0 && plataformasDe(p).includes(m)));
  $("kMundos").innerHTML = [["todo", "Todo"], ...mundos.map(m=>[m.toLowerCase(), m])]
    .map(([k, n])=>`<button type="button" data-k-mundo="${esc(k)}" aria-pressed="${K.mundo === k}">${CONFIG.mundos[n] ? `<svg class="k-logo${n === "Nintendo" ? " ancho" : ""}" aria-hidden="true"><use href="#${CONFIG.mundos[n].logo}"/></svg>` : ""}${n === "Nintendo" ? `<span class="sr">${n}</span>` : esc(n)}</button>`).join("");
  $("kPausa").textContent = K.pausa ? "Reanudar" : "Pausar";
  $("kPausa").setAttribute("aria-pressed", K.pausa);
}
function cargarQR(){
  if (window.qrcode || K.qrCargando) return;
  K.qrCargando = true;
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
  s.onload = ()=>{ const p = K.lista[K.i]; if (p && $("kiosco").open) pintarQR(p); };
  document.head.appendChild(s);
}
function pintarQR(p){
  const caja = $("kQr"); if (!caja) return;
  const hayQR = typeof window.qrcode === "function";
  caja.hidden = !hayQR;
  $("kQrTxt").innerHTML = hayQR ? "Escanéalo para pedirlo<small>desde tu celular, por WhatsApp</small>" : "Pídelo por WhatsApp<small>096 967 8365</small>";
  if (!hayQR) return;
  let svg = QR_CACHE.get(p.code);
  if (!svg){
    const q = qrcode(0, "M");
    q.addData(paginaDe(p));
    q.make();
    svg = q.createSvgTag({cellSize: 4, margin: 0, scalable: true});
    QR_CACHE.set(p.code, svg);
  }
  caja.innerHTML = svg;
}
function mostrarSlide(){
  clearTimeout(K.timer);
  if (!K.lista.length) return;
  K.paso = (K.paso || 0) + 1;
  if (K.paso % 7 === 0 && !K.esMascota && K.lista.length > 3) return mostrarMascotaVitrina();
  K.i = (K.i + K.lista.length) % K.lista.length;
  const p = K.lista[K.i];
  const {m} = consolaDe(p);
  $("kiosco").style.setProperty("--kc", CONFIG.mundos[m]?.c || "#FF7A00");
  const ef = precio(p, "efectivo"), tj = precio(p, "tarjeta"), [e, d] = ef.toFixed(2).split(".");
  const total = maxQty(p), en = Object.values(p.stock || {}).filter(n=>n > 0).length;
  const [cls, st] = p.digital ? ["ok", "Código digital"] : total <= CONFIG.lowStockAt ? ["low", "Últimas unidades"]
    : ["ok", en === nLocales ? "Disponible en los 3 locales" : `Disponible en ${en} local${en > 1 ? "es" : ""}`];
  $("kSlide").innerHTML = `
    <div class="k-foto"><img src="${esc(p.photos[0])}" alt="${esc(p.name)}" decoding="async"></div>
    <div class="k-info">
      <div class="k-cat">${esc(p.cat_label || "")}${etiquetaPlat(p)}</div>
      <h2 class="k-nombre">${esc(p.name)}</h2>
      <div class="k-precio"><span>$</span>${e}<small>.${d}</small></div>
      <div class="k-tag">Efectivo o transferencia, IVA incluido${tj - ef >= 1 ? ` · <b class="k-ahorra">Ahorras ${fmt(tj - ef)}</b> (tarjeta ${fmt(tj)})` : tj > ef ? ` · Con tarjeta ${fmt(tj)}` : ""}</div>
      <div class="k-stock ${cls}"><span class="dot"></span>${st}</div>
      <div class="k-qr"><div class="qr" id="kQr" aria-hidden="true"></div><p id="kQrTxt"></p></div>
    </div>`;
  pintarQR(p);
  const slide = $("kSlide");
  slide.classList.remove("entra"); void slide.offsetWidth; slide.classList.add("entra");
  slide.style.setProperty("--dur", `${K.dur}ms`);
  const barra = $("kBarra");
  barra.style.setProperty("--dur", `${K.dur}ms`);
  barra.classList.remove("corre"); void barra.offsetWidth;
  if (!K.pausa){ barra.classList.add("corre"); K.timer = setTimeout(()=>siguienteVitrina(1), K.dur); }
  const sig = K.lista[(K.i + 1) % K.lista.length];
  if (sig) { const im = new Image(); im.src = sig.photos[0]; }   // la siguiente foto ya lista
}
function siguienteVitrina(d){ if (K.esMascota) K.esMascota = false; else K.i += d; mostrarSlide(); }
// En la pantalla del local, cada tanto aparece el muñequito invitando a preguntar en caja.
function mostrarMascotaVitrina(){
  K.esMascota = true;
  $("kiosco").style.setProperty("--kc", "#FF7A00");
  const frases = [["¿Te gustó algo?", "Pregúntanos en caja: te lo mostramos y te decimos el precio en efectivo."],
                  ["¡Llévatelo hoy!", "Paga en efectivo o transferencia y ahorras. Pregúntanos en caja."],
                  ["¿Buscas otra cosa?", "Tenemos más en los 3 locales. Pregúntanos en caja o por WhatsApp."]];
  const [t, d] = frases[Math.floor(K.paso / 7) % frases.length];
  $("kSlide").innerHTML = `
    <div class="k-foto k-mascota"><img src="mascota/poses/${K.paso % 14 ? "saludo" : "presenta"}.webp" alt="" decoding="async"></div>
    <div class="k-info">
      <div class="k-cat">Electronic Games</div>
      <h2 class="k-nombre">${t}</h2>
      <div class="k-tag">${d}</div>
    </div>`;
  const slide = $("kSlide");
  slide.classList.remove("entra"); void slide.offsetWidth; slide.classList.add("entra");
  const barra = $("kBarra");
  barra.style.setProperty("--dur", `${K.dur}ms`);
  barra.classList.remove("corre"); void barra.offsetWidth;
  if (!K.pausa){ barra.classList.add("corre"); K.timer = setTimeout(()=>siguienteVitrina(1), K.dur); }
}
function pausarVitrina(){
  K.pausa = !K.pausa;
  pintarControlesVitrina();
  if (K.pausa){ clearTimeout(K.timer); $("kBarra").classList.remove("corre"); }
  else mostrarSlide();
}
function despertarControles(){
  $("kiosco").classList.remove("quieto");
  clearTimeout(K.quieto);
  K.quieto = setTimeout(()=>$("kiosco").classList.add("quieto"), 3000);
}
async function pedirPantallaEncendida(){
  try { if (!K.wake || K.wake.released) K.wake = await navigator.wakeLock?.request("screen"); } catch(e) {}
}
async function refrescarVitrina(){
  // Todo el día en la tienda: precios y stock al día cada 15 minutos, sin salir de la vitrina.
  try {
    const r = await fetch("products.json", {cache: "no-cache"});
    if (!r.ok) return;
    PRODUCTS = await r.json();
    const actual = K.lista[K.i]?.code;
    K.lista = listaVitrina();
    K.i = Math.max(0, K.lista.findIndex(p=>p.code === actual));
  } catch(e) {}
}
function abrirVitrina(conInicio = false){
  K.lista = listaVitrina();
  if (!K.lista.length){ K.mundo = "todo"; K.lista = listaVitrina(); }
  if (!K.lista.length) return;
  for (const d of ["dlg", "menu", "cart", "cmdk", "favs"]) if ($(d).open) $(d).close();
  K.i = 0;
  K.pausa = false;
  pintarControlesVitrina();
  $("kiosco").showModal();
  $("kInicio").hidden = !conInicio;
  cargarQR();
  if (conInicio) $("kEmpezar").focus(); else empezarVitrina();
  medir("vitrina", {mundo: K.mundo});
}
async function empezarVitrina(){
  $("kInicio").hidden = true;
  // Pantalla completa SOLO para la vitrina: si se pide para toda la página, el navegador pone la
  // página encima de la vitrina y se ven las dos mezcladas.
  try { if (!document.fullscreenElement) await $("kMarco").requestFullscreen?.({navigationUI: "hide"}); } catch(e) {}
  pedirPantallaEncendida();
  mostrarSlide();
  clearInterval(K.refresco);
  K.refresco = setInterval(refrescarVitrina, 15 * 60 * 1000);
  despertarControles();
}
function cerrarVitrina(){
  if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  if ($("kiosco").open) $("kiosco").close();
}
$("kiosco").addEventListener("close", ()=>{
  clearTimeout(K.timer);
  clearInterval(K.refresco);
  try { K.wake?.release(); } catch(e) {}
  K.wake = null;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
});
$("kSalir").onclick = cerrarVitrina;
$("kAnt").onclick = ()=>siguienteVitrina(-1);
$("kSig").onclick = ()=>siguienteVitrina(1);
$("kPausa").onclick = pausarVitrina;
$("kEmpezar").onclick = empezarVitrina;
$("kMundos").addEventListener("click", e=>{
  const b = e.target.closest("[data-k-mundo]"); if (!b) return;
  K.mundo = b.dataset.kMundo;
  K.lista = listaVitrina();
  K.i = 0;
  pintarControlesVitrina();
  mostrarSlide();
});
$("kiosco").addEventListener("keydown", e=>{
  if (e.key === "ArrowRight") siguienteVitrina(1);
  else if (e.key === "ArrowLeft") siguienteVitrina(-1);
  else if (e.key === " " && e.target === $("kiosco")) { e.preventDefault(); pausarVitrina(); }
});
// Deslizar con el dedo para pasar de producto.
{
  let x0 = null;
  $("kSlide").addEventListener("pointerdown", e=>{ x0 = e.clientX; });
  $("kSlide").addEventListener("pointerup", e=>{
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) siguienteVitrina(dx < 0 ? 1 : -1);
  });
}
// Los botones se esconden solos (y el cursor) cuando nadie toca la tablet.
for (const t of ["pointermove", "pointerdown", "keydown"]) $("kiosco").addEventListener(t, despertarControles, {passive: true});
// Si sale de pantalla completa (tecla Esc), también sale de la vitrina.
document.addEventListener("fullscreenchange", ()=>{
  if (!document.fullscreenElement && K.pantallaCompleta && $("kiosco").open) cerrarVitrina();
  K.pantallaCompleta = !!document.fullscreenElement;
});
// Si la tablet se bloquea y vuelve, la pantalla sigue sin apagarse.
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState === "visible" && $("kiosco").open) pedirPantallaEncendida(); });

async function compartir(){
  // Se comparte la página propia del producto: la vista previa en WhatsApp muestra su foto y precio.
  const p = D.p, url = paginaDe(p);
  medir("compartir", {via: "ficha"});
  const datos = {title: p.name, text: `${p.name} a ${fmt(p.price_efectivo ?? p.price)} en ${CONFIG.storeName}`, url};
  try {
    if (navigator.share) { await navigator.share(datos); return; }
    await navigator.clipboard.writeText(url);
    $("dShareTxt").textContent = "Enlace copiado";
    $("aviso").textContent = "Enlace del producto copiado";
    setTimeout(()=>{ $("dShareTxt").textContent = "Compartir"; }, 2500);
  } catch(e) {}
}

// ===== Pedido (se guarda en el navegador del cliente) =====
const CLAVE_PEDIDO = "eg_pedido_v1";
const PEDIDO = {items: new Map(), retiro: null, pago: "efectivo", nombre: "", codigo: ""};
let D = null;  // producto abierto en la ficha
const corto = nombre => nombre.replace(/ Shopping$/, "");
const maxQty = p => p.digital ? 20 : Object.values(p.stock || {}).reduce((a,b)=>a+b, 0);
const precio = (p, pago = PEDIDO.pago) => pago === "tarjeta" ? (p.price_tarjeta ?? p.price) : (p.price_efectivo ?? p.price);
const lineas = () => [...PEDIDO.items].map(([code,q])=>({p: buscar(code), q})).filter(l=>l.p);
const totalPedido = (pago = PEDIDO.pago) => lineas().reduce((s,l)=>s + precio(l.p, pago) * l.q, 0);
const unidades = () => lineas().reduce((s,l)=>s + l.q, 0);

function guardarPedido(){
  try { localStorage.setItem(CLAVE_PEDIDO, JSON.stringify({items: [...PEDIDO.items], retiro: PEDIDO.retiro, pago: PEDIDO.pago, nombre: PEDIDO.nombre, codigo: PEDIDO.codigo})); } catch(e) {}
}
function cargarPedido(){
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_PEDIDO) || "null");
    if (!d) return;
    // El stock cambia: se descartan productos que ya no están y se ajusta a lo disponible.
    for (const [code, q] of d.items || []){
      const p = buscar(code);
      if (p && maxQty(p) > 0) PEDIDO.items.set(code, Math.min(q, maxQty(p)));
    }
    if (CONFIG.locales[d.retiro]) PEDIDO.retiro = d.retiro;
    if (d.pago === "tarjeta") PEDIDO.pago = "tarjeta";
    if (typeof d.nombre === "string") PEDIDO.nombre = d.nombre.slice(0, 60);
    if (typeof d.codigo === "string") PEDIDO.codigo = d.codigo;
  } catch(e) {}
  $("nombre").value = PEDIDO.nombre;
}
function setCantidad(code, q){
  const p = buscar(code); if (!p) return;
  q = Math.max(0, Math.min(q, maxQty(p)));
  if (q) PEDIDO.items.set(code, q); else PEDIDO.items.delete(code);
  guardarPedido();
  actualizarPedido();
}

// Confirmación al agregar: el contador rebota, el celular vibra un instante y se anuncia a lectores de pantalla.
function confirmarAgregado(p, n, retraso = 0){
  $("aviso").textContent = `Agregado al pedido: ${n > 1 ? n + " x " : ""}${p.name}`;
  try { navigator.vibrate?.(10); } catch(e) {}
  setTimeout(popAgregado, retraso);
  if (reduceMotion()) return;
  // El contador rebota cuando llega la miniatura que vuela (o al instante si no hay vuelo).
  setTimeout(()=>{
    for (const el of [$("cartCount"), $("cartBarN")])
      el.animate?.([{scale: 1}, {scale: 1.35}, {scale: 1}], {duration: 300, easing: "cubic-bezier(0.23,1,0.32,1)"});
  }, retraso);
}

// El muñequito levanta el pulgar: "¡Agregado!" (en la capa de arriba, visible también sobre la ficha).
function popAgregado(){
  const pop = $("popMascota");
  clearTimeout(popAgregado.t);
  // Sin "popover" (iOS 16 o anterior) se muestra con la clase .ver, igual por encima de todo.
  if (pop.showPopover){ try { if (pop.matches(":popover-open")) pop.hidePopover(); pop.showPopover(); } catch(e) { return; } }
  else pop.classList.add("ver");
  pop.classList.remove("anima"); void pop.offsetWidth; pop.classList.add("anima");
  popAgregado.t = setTimeout(()=>{ try { pop.hidePopover(); } catch(e) {} pop.classList.remove("ver"); }, reduceMotion() ? 1400 : 1750);
}

// Quitar y vaciar se pueden deshacer, en vez de pedir confirmación.
let DESHACER = null, deshacerTimer = 0;
function guardarDeshacer(texto){
  DESHACER = {items: new Map(PEDIDO.items), texto};
  clearTimeout(deshacerTimer);
  deshacerTimer = setTimeout(()=>{ DESHACER = null; pintarUndo(); }, 8000);
}
function pintarUndo(){
  $("undo").hidden = !DESHACER;
  if (DESHACER) $("undoTxt").textContent = DESHACER.texto;
}

function controlTarjeta(p){
  const q = PEDIDO.items.get(p.code) || 0;
  if (q) return `<button class="add in" type="button" data-ver-pedido aria-label="${q} en tu pedido. Ver pedido">${q}</button>`;
  const max = maxQty(p);
  return `<button class="add" type="button" data-add="${esc(p.code)}" ${max ? "" : "disabled"} aria-label="${max ? "Agregar al pedido: " : "Agotado: "}${esc(p.name)}">+</button>`;
}
function mejorLocal(){
  let mejor = Object.keys(CONFIG.locales)[0], puntos = -1;
  const fisicos = lineas().filter(l=>!l.p.digital);
  for (const k of Object.keys(CONFIG.locales)){
    const pts = fisicos.filter(l=>(l.p.stock[k] || 0) >= l.q).length;
    if (pts > puntos){ puntos = pts; mejor = k; }
  }
  return mejor;
}
function actualizarPedido(){
  const n = unidades();
  $("cartCount").textContent = n;
  $("cartCount").classList.toggle("on", n > 0);
  $("cartBarN").textContent = n;
  $("cartBarT").textContent = fmt(totalPedido());
  $("cartBar").hidden = n === 0 || $("cart").open;
  document.body.classList.toggle("con-pedido", n > 0);
  refrescarControles();
  if ($("cart").open) pintarCarrito();
  if ($("dlg").open && D) pintarCompra();
}

function pintarCompra(){
  const p = D.p, max = maxQty(p), enPedido = PEDIDO.items.get(p.code) || 0, libre = max - enPedido;
  D.q = Math.max(1, Math.min(D.q, Math.max(1, libre)));
  $("dQtyN").textContent = D.q;
  $("dMenos").disabled = D.q <= 1;
  $("dMas").disabled = D.q >= libre;
  $("dQtyInfo").textContent = p.digital ? "Código digital"
    : !max ? "Agotado en los 3 locales"
    : `${disponibles(max)} en total` + (enPedido ? `, ${enPedido} en tu pedido` : "");
  $("dAdd").disabled = !D.agregado && libre <= 0;
  const textoAdd = D.agregado ? "✓ Agregado, ver pedido" : !max ? "Agotado" : libre <= 0 ? "Ya está todo en tu pedido" : "Agregar al pedido";
  if ($("dAdd").textContent !== textoAdd){
    const cambio = $("dAdd").textContent !== "";
    $("dAdd").textContent = textoAdd;
    if (cambio && D.agregado && !reduceMotion())
      $("dAdd").animate?.([{opacity: 0.2, filter: "blur(4px)", scale: 0.96}, {opacity: 1, filter: "blur(0)", scale: 1}], {duration: 200, easing: "cubic-bezier(0.23,1,0.32,1)"});
  }
  const ef = precio(p, "efectivo"), tj = precio(p, "tarjeta");
  // Agotado en los 3 locales: en vez de "pedir", la persona deja el aviso para cuando llegue.
  const agotado = !p.digital && !max;
  $("dAgotado").hidden = !agotado;
  $("dWa").dataset.tipo = agotado ? "aviso" : "consulta";
  $("dWa").innerHTML = `<svg aria-hidden="true"><use href="#i-wa"/></svg>${agotado ? "Avísame cuando llegue" : "Pedir por WhatsApp"}`;
  const que = D.q > 1 ? `${D.q} x ${p.name} (${p.code}), a ${fmt(ef)} c/u` : `${p.name} (${p.code}), a ${fmt(ef)}`;
  $("dWa").href = waLink(agotado
    ? `Hola ${CONFIG.storeName}, avísenme cuando llegue: ${p.name} (${p.code}). (Código ${D.wcodigo})`
    : `Hola ${CONFIG.storeName}, me interesa: ${que} en efectivo${tj > ef ? ` (${fmt(tj)} con tarjeta)` : ""}. ¿Está disponible? (Código ${D.wcodigo})`);
}

function abrirCarrito(){
  if ($("dlg").open) $("dlg").close();
  if (!PEDIDO.retiro) PEDIDO.retiro = mejorLocal();
  pintarCarrito();
  $("cart").showModal();
  $("cartBar").hidden = true;
}
function mensajePedido(){
  if (!PEDIDO.codigo) { PEDIDO.codigo = nuevoCodigo(); guardarPedido(); }
  const L = CONFIG.locales[PEDIDO.retiro];
  const detalle = lineas().map(({p,q})=>`- ${q} x ${p.name} (${p.code}): ${fmt(precio(p) * q)}`).join("\n");
  const nombre = PEDIDO.nombre.trim();
  return `Hola ${CONFIG.storeName}, quiero hacer este pedido (Código ${PEDIDO.codigo}):\n\n${detalle}\n\n` +
    (nombre ? `Nombre: ${nombre}\n` : "") +
    `Retiro en: ${L.nombre} (${L.zona}, ${L.detalle})\n` +
    `Forma de pago: ${PEDIDO.pago === "tarjeta" ? "Tarjeta" : "Efectivo / transferencia"}\n` +
    `Total: ${fmt(totalPedido())}\n\n¿Me confirman disponibilidad?`;
}
function pintarCarrito(){
  pintarUndo();
  const ls = lineas();
  $("cartVacio").hidden = ls.length > 0;
  $("cartFoot").hidden = ls.length === 0;
  $("cartItems").hidden = ls.length === 0;
  $("cartOpciones").hidden = ls.length === 0;
  pintarSugerencias();
  if (!ls.length) return;
  if (!PEDIDO.retiro) PEDIDO.retiro = mejorLocal();
  const R = PEDIDO.retiro, L = CONFIG.locales[R];

  $("cartItems").innerHTML = ls.map(({p,q})=>{
    const u = precio(p), hay = p.stock ? (p.stock[R] || 0) : 0;
    const aviso = p.digital ? ""
      : !hay ? `<div class="aviso out">Agotado en ${esc(L.nombre)}</div>`
      : hay < q ? `<div class="aviso low">En ${esc(L.nombre)} solo hay ${hay}</div>` : "";
    return `<div class="item" data-code="${esc(p.code)}">
      <img src="${esc(fotoDe(p))}" alt="" width="58" height="58" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)">
      <div>
        <div class="nm">${esc(p.name)}</div>
        <div class="pu">${fmt(u)} c/u</div>
        <div class="ctl">
          <div class="qty sm" role="group" aria-label="Cantidad">
            <button type="button" data-d="-1" aria-label="Quitar uno">−</button><output>${q}</output><button type="button" data-d="1" ${q >= maxQty(p) ? "disabled" : ""} aria-label="Agregar uno">+</button>
          </div>
          <button type="button" class="quitar" data-quitar>Quitar</button>
        </div>
      </div>
      <div class="lt">${fmt(u * q)}</div>
      ${aviso}
    </div>`;
  }).join("");

  $("retiro").innerHTML = Object.entries(CONFIG.locales).map(([k,Lc])=>
    `<button type="button" data-retiro="${k}" aria-pressed="${k === R}">${esc(corto(Lc.nombre))}</button>`).join("");
  const faltan = ls.filter(l=>!l.p.digital && (l.p.stock[R] || 0) < l.q).length;
  $("retiroMsg").className = "retiro-msg " + (faltan ? "low" : "ok");
  $("retiroMsg").textContent = faltan
    ? `${faltan === 1 ? "1 producto no alcanza" : faltan + " productos no alcanzan"} en ${L.nombre}. Te confirmamos por chat si lo traemos de otro local.`
    : `Todo disponible en ${L.nombre}, ${L.zona}, ${L.detalle}`;

  $("pago").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.pago === PEDIDO.pago));
  const t = totalPedido(), te = totalPedido("efectivo");
  if ($("cartTotal").textContent !== fmt(t)){
    const antes = $("cartTotal").textContent;
    $("cartTotal").textContent = fmt(t);
    if (antes !== "$0.00" && !reduceMotion()) $("cartTotal").animate?.([{translate: "0 -5px", opacity: 0.5}, {translate: "0 0", opacity: 1}], {duration: 180, easing: "cubic-bezier(0.23,1,0.32,1)"});
  }
  $("ahorro").textContent = PEDIDO.pago === "tarjeta" && t - te > 0.009 ? `En efectivo o transferencia: ${fmt(te)}` : "";
  $("cartSend").href = waLink(mensajePedido());
}

// ===== "Te puede faltar": sugerencias en el pedido =====
// Se sugiere lo que complementa lo que ya lleva, para su misma consola: con una PS5, palancas y
// juegos de PS5; con un juego de Mario, cosas de Mario. Nunca otra consola.
const COMPLEMENTOS = {consolas: ["palancas", "juegos", "accesorios"], juegos: ["palancas", "juegos"], palancas: ["juegos", "accesorios"], accesorios: ["juegos", "palancas"]};
const FRANQUICIAS = ["POKEMON", "MARIO", "ZELDA", "MINECRAFT", "SONIC", "SPIDER", "KIRBY", "DRAGON BALL", "NARUTO", "HARRY POTTER", "STAR WARS", "CRASH", "HALO", "GOD OF WAR", "RESIDENT EVIL", "CALL OF DUTY", "FIFA", "FC 2"];
function sugerencias(max = 6){
  const ls = lineas(); if (!ls.length) return [];
  const exactas = new Set(), familias = new Set(), franquicias = new Set();
  for (const {p} of ls){
    for (const n of plataformasDe(p)) (CONFIG.mundos[n] ? familias : exactas).add(n);
    const nombre = norm(p.name).toUpperCase();
    for (const f of FRANQUICIAS) if (nombre.includes(f)) franquicias.add(f);
  }
  const quiero = new Set(ls.flatMap(({p})=>COMPLEMENTOS[p.cat] || []));
  const puntos = (p, i) => {
    const pl = plataformasDe(p), nombre = norm(p.name).toUpperCase();
    let s = 0;
    if (pl.some(n=>exactas.has(n))) s += 4; else if (pl.some(n=>familias.has(n))) s += 2;
    if (FRANQUICIAS.some(f=>franquicias.has(f) && nombre.includes(f))) s += 3;
    if (quiero.has(p.cat)) s += 2;
    if (p.photos.length) s += 1;
    return s - i / PRODUCTS.length;   // en empate, lo más vendido primero
  };
  // Si el pedido es de una consola, nada de otra marca (sí lo universal: cables, fundas…).
  const deOtraConsola = p => { const f = plataformasDe(p).filter(n=>CONFIG.mundos[n]); return familias.size > 0 && f.length > 0 && !f.some(n=>familias.has(n)); };
  const orden = PRODUCTS
    .map((p, i)=>[p, i])
    .filter(([p])=>p.cat !== "consolas" && !PEDIDO.items.has(p.code) && maxQty(p) > 0 && !deOtraConsola(p))
    .map(([p, i])=>[p, puntos(p, i)])
    .filter(([, s])=>s >= 3)
    .sort((a, b)=>b[1] - a[1]);
  const porCat = {}, res = [];
  for (const [p] of orden){
    if ((porCat[p.cat] = (porCat[p.cat] || 0) + 1) > 3) continue;   // variedad: máximo 3 por categoría
    res.push(p);
    if (res.length === max) break;
  }
  return res;
}
function pintarSugerencias(){
  const sug = sugerencias();
  $("sugeridos").hidden = !sug.length;
  $("sugRail").innerHTML = sug.map(p=>`<div class="sug" role="listitem">
    <button type="button" class="sug-ver" data-ver-sug="${esc(p.code)}"><span class="th"><img src="${esc(fotoDe(p))}" alt="" width="136" height="136" loading="lazy" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></span><span class="nm">${esc(p.name)}</span><span class="pr">${fmt(precio(p))}</span></button>
    <button type="button" class="sug-add" data-sug-add="${esc(p.code)}" aria-label="Agregar al pedido: ${esc(p.name)}">+</button>
  </div>`).join("");
}
$("sugRail").addEventListener("click", e=>{
  const add = e.target.closest("[data-sug-add]");
  if (add){
    const p = buscar(add.dataset.sugAdd); if (!p) return;
    const pos = [...$("sugRail").querySelectorAll(".sug-add")].indexOf(add);
    setCantidad(p.code, 1);   // el pedido se vuelve a dibujar: el foco pasa a la siguiente sugerencia
    confirmarAgregado(p, 1);
    medir("sugerencia-agregada", {codigo: p.code});
    const botones = $("sugRail").querySelectorAll(".sug-add");
    (botones[Math.min(pos, botones.length - 1)] || $("cartSend")).focus({preventScroll: true});
    return;
  }
  const ver = e.target.closest("[data-ver-sug]");
  if (ver){ $("cart").close(); openProduct(ver.dataset.verSug); }
});

// ===== Favoritos y vistos recientemente (se guardan solo en este dispositivo) =====
const CLAVE_FAV = "eg_favoritos_v1", CLAVE_VISTOS = "eg_vistos_v1";
function leerLista(k){
  try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v.filter(x=>typeof x === "string").slice(0, 100) : []; }
  catch(e) { return []; }
}
function guardarLista(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
const FAVS = new Set(leerLista(CLAVE_FAV));
let VISTOS = leerLista(CLAVE_VISTOS);
const favoritosVigentes = () => [...FAVS].map(buscar).filter(Boolean);

function alternarFavorito(code){
  const p = buscar(code); if (!p) return;
  const on = !FAVS.has(code);
  if (on) FAVS.add(code); else FAVS.delete(code);
  guardarLista(CLAVE_FAV, [...FAVS]);
  document.querySelectorAll(".fav, #dFav").forEach(b=>{
    if (b.dataset.fav !== code) return;
    b.setAttribute("aria-pressed", on);
    if (on && !reduceMotion()) b.animate?.([{scale: 1}, {scale: 1.3}, {scale: 1}], {duration: 300, easing: "cubic-bezier(0.23,1,0.32,1)"});
  });
  $("aviso").textContent = on ? `Guardado en favoritos: ${p.name}` : `Quitado de favoritos: ${p.name}`;
  medir("favorito", {codigo: code, accion: on ? "guardar" : "quitar"});
  pintarFavoritos();
}
function mensajeLista(ls){
  return `Mi lista de ${CONFIG.storeName}:\n\n` +
    ls.slice(0, 15).map(p=>`- ${p.name}: ${fmt(precio(p, "efectivo"))}\n  ${paginaDe(p)}`).join("\n") +
    `\n\nCatálogo completo: ${BASE}`;
}
function pintarFavoritos(){
  const ls = favoritosVigentes(), n = ls.length;
  $("favN").textContent = n;
  $("favN").hidden = !n;
  $("favBtn").classList.toggle("on", n > 0);
  $("favBtn").setAttribute("aria-label", n ? `Mis favoritos (${n})` : "Mis favoritos");
  $("menuFavN").textContent = n ? ` (${n})` : "";
  if (D) $("dFavTxt").textContent = FAVS.has(D.p.code) ? "Guardado" : "Guardar";
  if (!$("favs").open) return;
  $("favsVacio").hidden = n > 0;
  $("favsFoot").hidden = $("favsItems").hidden = n === 0;
  $("favsItems").innerHTML = ls.map(p=>{
    const [cls, txt] = status(p);
    return `<div class="item" data-code="${esc(p.code)}">
      <img src="${esc(fotoDe(p))}" alt="" width="58" height="58" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)">
      <div>
        <div class="nm">${esc(p.name)}</div>
        <div class="stock ${cls}" style="margin-top:4px"><span class="dot"></span>${txt}</div>
        <div class="ctl"><button type="button" class="quitar" data-ver-fav>Ver producto</button><button type="button" class="quitar" data-quitar-fav>Quitar</button></div>
      </div>
      <div class="lt">${fmt(precio(p, "efectivo"))}</div>
    </div>`;
  }).join("");
  $("favsCompartir").href = `https://wa.me/?text=${encodeURIComponent(mensajeLista(ls))}`;
  $("favsTodo").disabled = !ls.some(p=>maxQty(p) > 0 && !PEDIDO.items.get(p.code));
}
function abrirFavoritos(){
  for (const d of ["dlg", "menu", "cart", "cmdk"]) if ($(d).open) $(d).close();
  $("favs").showModal();
  pintarFavoritos();
}
$("favsClose").onclick = ()=>$("favs").close();
$("favs").addEventListener("click", e=>{ if (e.target === $("favs")) $("favs").close(); });
$("favsSeguir").onclick = ()=>{ $("favs").close(); $("catalogo").scrollIntoView(); };
$("favsItems").addEventListener("click", e=>{
  const code = e.target.closest(".item")?.dataset.code; if (!code) return;
  if (e.target.closest("[data-ver-fav]")){ $("favs").close(); openProduct(code); }
  else if (e.target.closest("[data-quitar-fav]")) alternarFavorito(code);
});
// Agrega al pedido los favoritos disponibles que todavía no están en él.
$("favsTodo").onclick = ()=>{
  const nuevos = favoritosVigentes().filter(p=>maxQty(p) > 0 && !PEDIDO.items.get(p.code));
  for (const p of nuevos) PEDIDO.items.set(p.code, 1);
  guardarPedido();
  $("favs").close();
  actualizarPedido();
  if (nuevos.length) $("aviso").textContent = `${nuevos.length} producto${nuevos.length > 1 ? "s" : ""} de tus favoritos agregado${nuevos.length > 1 ? "s" : ""} al pedido`;
  abrirCarrito();
};

function registrarVisto(code){
  VISTOS = [code, ...VISTOS.filter(c=>c !== code)].slice(0, 12);
  guardarLista(CLAVE_VISTOS, VISTOS);
}
function pintarVistos(){
  const ls = VISTOS.map(buscar).filter(Boolean);
  $("secVistos").hidden = ls.length < 2;
  $("railVistos").innerHTML = ls.map(p=>cardHTML(p)).join("");
  actualizarFlechas(document.querySelector('.rail-nav[data-rail="railVistos"]'));
}
$("vistosBorrar").onclick = ()=>{ VISTOS = []; guardarLista(CLAVE_VISTOS, VISTOS); pintarVistos(); };
// El carrusel se actualiza al cerrar la ficha (no mientras se mira un producto). Se vigila el
// atributo "open" en vez del evento "close", que algunos navegadores en segundo plano retrasan.
new MutationObserver(()=>{ if (!$("dlg").open) pintarVistos(); }).observe($("dlg"), {attributes: true, attributeFilter: ["open"]});

// ===== Buscador rápido (Ctrl+K, "/" o la lupa) =====
function irAlBuscador(){
  $("catalogo").scrollIntoView();
  $("q").focus({preventScroll: true});
}
const CMD = {sel: 0, lista: [], total: 0};
function abrirBuscador(){
  if (!PRODUCTS.length) { irAlBuscador(); return; }   // el catálogo todavía no cargó
  for (const d of ["dlg", "menu", "cart"]) if ($(d).open) $(d).close();
  $("cmdkQ").value = "";
  pintarBuscador();
  $("cmdk").showModal();
  $("cmdkQ").focus();
}
function pintarBuscador(){
  const q = $("cmdkQ").value.trim();
  if (!q){
    // Sin texto: atajos y lo que más se vende con foto.
    const conFoto = PRODUCTS.filter(p=>p.photos.length && maxQty(p) > 0);
    CMD.lista = conFoto.concat(PRODUCTS.filter(p=>!p.photos.length)).slice(0, 6);
    CMD.total = 0;
    $("cmdkArriba").innerHTML = `<div class="cmdk-grupo">Lo más buscado</div><div class="cmdk-atajos">${CONFIG.atajos.map(t=>`<button type="button" data-cmdk-atajo="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
    $("cmdkGrupo").textContent = "Populares";
  } else {
    const todos = porRelevancia(PRODUCTS.filter(p=>coincide(p, q)), q);
    CMD.lista = todos.slice(0, 8);
    CMD.total = todos.length;
    $("cmdkArriba").innerHTML = todos.length ? "" : `<div class="cmdk-vacio"><img class="mascota-mini" src="mascota/mascota-chica.webp" alt="" width="243" height="360" loading="lazy" decoding="async"><strong>No hay resultados para “${esc(q)}”.</strong>Prueba con otra palabra, o pregúntanos: te decimos si lo tenemos o si nos llega.<br>${pideloHTML(q)}${avisameHTML(q)}</div>`;
    if (!todos.length) medirSinResultados(q);
    $("cmdkGrupo").textContent = todos.length ? `${todos.length} resultado${todos.length === 1 ? "" : "s"}` : "";
  }
  CMD.sel = 0;
  $("cmdkOps").innerHTML = CMD.lista.map((p, i)=>{
    const [cls, txt] = status(p);
    return `<div class="cmdk-op" role="option" id="cmdk-op-${i}" data-i="${i}" aria-selected="${i === 0}">
      <span class="th"><img src="${esc(fotoDe(p))}" alt="" width="52" height="52" decoding="async" data-code="${esc(p.code)}" data-i="0" onerror="onPhotoError(this)"></span>
      <span><span class="nm">${esc(p.name)}</span><span class="stock ${cls}"><span class="dot"></span>${txt}</span></span>
      <span class="pr">${fmt(precio(p, "efectivo"))}</span>
    </div>`;
  }).join("");
  $("cmdkTodo").hidden = CMD.total <= CMD.lista.length;
  $("cmdkTodo").textContent = `Ver los ${CMD.total} en el catálogo`;
  marcarOpcion(false);
}
function marcarOpcion(desplazar = true){
  const ops = $("cmdkOps").querySelectorAll(".cmdk-op");
  ops.forEach((o, i)=>o.setAttribute("aria-selected", i === CMD.sel));
  const actual = ops[CMD.sel];
  if (actual) $("cmdkQ").setAttribute("aria-activedescendant", actual.id);
  else $("cmdkQ").removeAttribute("aria-activedescendant");
  if (desplazar) actual?.scrollIntoView({block: "nearest"});
}
function elegirOpcion(i){
  const p = CMD.lista[i]; if (!p) return;
  $("cmdk").close();
  openProduct(p.code);
}
function verEnCatalogo(){
  const q = $("cmdkQ").value.trim();
  $("cmdk").close();
  aplicarFiltro({q, cat: "all", plat: "all"});
}
$("cmdkQ").addEventListener("input", pintarBuscador);
$("cmdkQ").addEventListener("keydown", e=>{
  if (e.key === "ArrowDown" || e.key === "ArrowUp"){
    e.preventDefault();
    if (!CMD.lista.length) return;
    CMD.sel = (CMD.sel + (e.key === "ArrowDown" ? 1 : -1) + CMD.lista.length) % CMD.lista.length;
    marcarOpcion();
  } else if (e.key === "Enter"){
    e.preventDefault();
    if (CMD.lista.length) elegirOpcion(CMD.sel);
  }
});
$("cmdkOps").addEventListener("pointermove", e=>{
  const o = e.target.closest(".cmdk-op");
  if (o && Number(o.dataset.i) !== CMD.sel){ CMD.sel = Number(o.dataset.i); marcarOpcion(false); }
});
$("cmdkOps").addEventListener("click", e=>{
  const o = e.target.closest(".cmdk-op");
  if (o) elegirOpcion(Number(o.dataset.i));
});
$("cmdkArriba").addEventListener("click", e=>{
  const b = e.target.closest("[data-cmdk-atajo]"); if (!b) return;
  $("cmdkQ").value = b.dataset.cmdkAtajo;
  pintarBuscador();
  $("cmdkQ").focus();
});
$("cmdkTodo").onclick = verEnCatalogo;
$("cmdkCerrar").onclick = ()=>$("cmdk").close();
$("cmdk").addEventListener("click", e=>{ if (e.target === $("cmdk")) $("cmdk").close(); });

// ===== Eventos =====
$("chips").addEventListener("click", e=>{
  const b = e.target.closest(".chip"); if (!b) return;
  aplicarFiltro({cat: b.dataset.cat}, false);
});
$("q").addEventListener("input", e=>{ S.q = e.target.value; S.visibles = CONFIG.porPagina; render(); });
$("q").addEventListener("keydown", e=>{ if (e.key === "Enter") { e.preventDefault(); $("grid").scrollIntoView({behavior: reduceMotion() ? "auto" : "smooth", block: "start"}); } });
$("plat").addEventListener("change", e=>{ S.plat = e.target.value; S.visibles = CONFIG.porPagina; S.animar = 0; render(); });
$("local").addEventListener("change", e=>{ S.local = e.target.value; S.animar = 0; render(); });
$("sort").addEventListener("change", e=>{ S.sort = e.target.value; S.animar = 0; render(); });
$("onlyStock").addEventListener("change", e=>{ S.only = e.target.checked; S.visibles = CONFIG.porPagina; S.animar = 0; render(); });
for (const id of ["estado", "precio"])
  $(id).addEventListener("change", e=>{ S[id] = e.target.value; S.visibles = CONFIG.porPagina; S.animar = 0; render(); medir("filtro", {[id]: e.target.value}); });
$("limpiar").addEventListener("click", resetAll);
$("moreBtn").addEventListener("click", ()=>{ S.animar = S.visibles; S.visibles += CONFIG.porPagina; render(); });

// Clics en tarjetas, carruseles, categorías y atajos (en cualquier parte de la página).
document.addEventListener("click", e=>{
  // Todos los botones de WhatsApp se cuentan (sin detener el enlace).
  const wa = e.target.closest('a[href*="wa.me/"]');
  if (wa) medir("whatsapp", {tipo: wa.dataset.tipo || "general"});
  const fav = e.target.closest("[data-fav]");
  if (fav){ alternarFavorito(fav.dataset.fav); return; }
  const add = e.target.closest("[data-add]");
  if (add){
    const origen = add.closest(".card")?.querySelector(".img");
    setCantidad(add.dataset.add, 1);
    confirmarAgregado(buscar(add.dataset.add), 1, volarAlPedido(origen));
    medir("agregar-al-pedido", {codigo: add.dataset.add});
    return;
  }
  if (e.target.closest("[data-ver-pedido]")){ abrirCarrito(); return; }
  if (e.target.closest("[data-abrir-buscador]")){ e.preventDefault(); abrirBuscador(); return; }
  if (e.target.closest("[data-abrir-favoritos]")){ e.preventDefault(); abrirFavoritos(); return; }
  if (e.target.closest("[data-abrir-pedidos]")){ e.preventDefault(); abrirPedidos(); return; }
  if (e.target.closest("[data-abrir-logros]")){ e.preventDefault(); abrirLogros(); return; }
  if (e.target.closest("[data-guia]")){ abrirChat("¿Qué consola me compro?"); return; }
  const av = e.target.closest("[data-avisame], [data-avisame-codigo]");
  if (av){
    guardarAviso(av.dataset.avisameCodigo ? {codigo: av.dataset.avisameCodigo} : {q: av.dataset.avisame});
    av.textContent = "✓ Listo: te aviso aquí cuando llegue 🔔"; av.disabled = true;
    return;
  }
  const pod = e.target.closest("[data-podio]");
  if (pod){ abrirProducto(pod.dataset.podio, pod.querySelector(".podio-foto")); return; }
  const podc = e.target.closest("[data-podio-cat]");
  if (podc){ podioCat = podc.dataset.podioCat; pintarPodio(); return; }
  const inst = e.target.closest("[data-instalar]");
  if (inst){ e.preventDefault(); instalarApp().then(ok => { if (inst.closest("#chatMascota")) decir(ok ? "¡Listo! Ya la tienes como app 🎉" : "Cuando quieras, me pides instalarla otra vez 🙂"); }); return; }
  const rep = e.target.closest("[data-repetir]");
  if (rep && !rep.closest("#chatMascota")){
    const r = repetirPedido(rep.dataset.repetir);
    if (r){ $("pedidos").close(); abrirCarrito(); $("aviso").textContent = r.faltan.length ? `Ya no hay: ${r.faltan.join(", ")}` : "Pedido anterior agregado"; }
    return;
  }
  if (e.target.closest("[data-abrir-vitrina]")){ e.preventDefault(); abrirVitrina(); return; }
  const open = e.target.closest(".card-open, .stream-item");
  if (open){ abrirProducto(open.dataset.code, open.classList.contains("stream-item") ? open : open.querySelector(".img")); return; }
  const cat = e.target.closest("[data-ir-cat]");
  if (cat){ e.preventDefault(); aplicarFiltro({cat: cat.dataset.irCat, q: "", plat: "all"}); return; }
  const plat = e.target.closest("[data-ir-plat]");
  if (plat){
    e.preventDefault();
    // Dentro del encabezado del mundo (PS5 / PS4 / salir) se conserva la categoría y no se mueve la página.
    const enBanner = !!plat.closest("#mundoBanner");
    aplicarFiltro({plat: plat.dataset.irPlat, cat: enBanner ? S.cat : "all", q: enBanner ? S.q : ""}, !enBanner);
    medir("mundo", {plataforma: plat.dataset.irPlat});
    return;
  }
  const atajo = e.target.closest("[data-atajo]");
  if (atajo){ aplicarFiltro({q: atajo.dataset.atajo, cat: "all", plat: "all"}); return; }
  if (e.target.closest("[data-reset]")) resetAll();
});

// Atajos de teclado: Ctrl+K (⌘K en Mac) o "/" abren el buscador rápido.
document.addEventListener("keydown", e=>{
  const cmdK = e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey) && !e.altKey;
  const barra = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (!cmdK && !barra) return;
  if ($("cmdk").open){ if (cmdK){ e.preventDefault(); $("cmdk").close(); } return; }
  if (barra && (e.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]"))) return;
  e.preventDefault();
  abrirBuscador();
});

$("dClose").onclick = ()=>$("dlg").close();
$("dlg").addEventListener("click", e=>{ if (e.target === $("dlg")) $("dlg").close(); });
$("dlg").addEventListener("close", escribirURL);
$("dMigaTodo").onclick = ()=>aplicarFiltro({cat: "all"});
$("dMigaCat").onclick = e=>aplicarFiltro({cat: e.currentTarget.dataset.cat, plat: "all"});
$("dShare").onclick = compartir;

// Ficha: cantidad y agregar
$("dMenos").onclick = ()=>{ D.q--; D.agregado = false; pintarCompra(); };
$("dMas").onclick = ()=>{ D.q++; D.agregado = false; pintarCompra(); };
$("dAdd").onclick = ()=>{
  if (D.agregado){ abrirCarrito(); return; }
  const n = D.q;
  setCantidad(D.p.code, (PEDIDO.items.get(D.p.code) || 0) + n);
  confirmarAgregado(D.p, n);
  D.agregado = true; D.q = 1;
  medir("agregar-al-pedido", {codigo: D.p.code});
  pintarCompra();
};

// Pedido
$("cartBtn").onclick = abrirCarrito;
$("cartBar").onclick = abrirCarrito;
$("cartClose").onclick = ()=>$("cart").close();
$("cartSeguir").onclick = ()=>{ $("cart").close(); $("catalogo").scrollIntoView(); };
$("cart").addEventListener("click", e=>{ if (e.target === $("cart")) $("cart").close(); });
$("cart").addEventListener("close", ()=>{ DESHACER = null; actualizarPedido(); });
$("cartItems").addEventListener("click", e=>{
  const item = e.target.closest(".item"); if (!item) return;
  const code = item.dataset.code, q = PEDIDO.items.get(code) || 0;
  const d = e.target.closest("[data-d]");
  const nuevo = d ? q + Number(d.dataset.d) : e.target.closest("[data-quitar]") ? 0 : q;
  if (nuevo === q) return;
  if (nuevo <= 0){
    guardarDeshacer(`Quitaste ${buscar(code).name}`);
    if (!reduceMotion() && item.animate){
      item.style.overflow = "hidden";
      item.animate([{opacity: 1, height: item.offsetHeight + "px"}, {opacity: 0, height: "0px", paddingTop: "0px", paddingBottom: "0px"}],
        {duration: 200, easing: "cubic-bezier(0.23,1,0.32,1)"}).finished.then(()=>setCantidad(code, 0), ()=>setCantidad(code, 0));
      return;
    }
  }
  setCantidad(code, nuevo);
});
$("undoBtn").onclick = ()=>{
  if (!DESHACER) return;
  PEDIDO.items = new Map(DESHACER.items);
  DESHACER = null;
  guardarPedido();
  actualizarPedido();
};
$("retiro").addEventListener("click", e=>{
  const b = e.target.closest("[data-retiro]"); if (!b) return;
  PEDIDO.retiro = b.dataset.retiro; guardarPedido(); pintarCarrito();
});
$("pago").addEventListener("click", e=>{
  const b = e.target.closest("[data-pago]"); if (!b) return;
  PEDIDO.pago = b.dataset.pago; guardarPedido(); actualizarPedido();
});
$("nombre").addEventListener("input", e=>{
  PEDIDO.nombre = e.target.value.slice(0, 60); guardarPedido();
  $("cartSend").href = waLink(mensajePedido());
});
$("cartVaciar").onclick = ()=>{
  const n = unidades();
  guardarDeshacer(`Vaciaste tu pedido (${n} producto${n === 1 ? "" : "s"})`);
  PEDIDO.items.clear(); PEDIDO.codigo = ""; guardarPedido(); actualizarPedido();
};

// Registro propio de pedidos (independiente del negocio), para control de comisión.
$("cartSend").addEventListener("click", ()=>{
  guardarEnHistorial();
  setTimeout(celebrarPedido, 0);
  registrarPedido("pedido", {
    codigo: PEDIDO.codigo,
    tienda: PEDIDO.retiro || "",
    productos: lineas().map(({p,q})=>`${q}x ${p.code}`).join(" | "),
    total: totalPedido().toFixed(2),
    pago: PEDIDO.pago
  });
});
$("dWa").addEventListener("click", ()=>{
  if (!D) return;
  registrarPedido($("dWa").dataset.tipo || "consulta", {
    codigo: D.wcodigo,
    tienda: PEDIDO.retiro || "",
    productos: `${D.q}x ${D.p.code}`,
    total: (precio(D.p, "efectivo") * D.q).toFixed(2),
    pago: "efectivo"
  });
});

// Menú en celular
$("menuBtn").onclick = ()=>$("menu").showModal();
$("menuClose").onclick = ()=>$("menu").close();
$("menu").addEventListener("click", e=>{
  if (e.target === $("menu") || e.target.closest(".menu-nav a")) $("menu").close();
});

loadProducts();

// Actualización instantánea de la app instalada y funcionamiento sin conexión (sw.js).
if ("serviceWorker" in navigator && location.protocol === "https:")
  (document.readyState === "complete" ? f=>f() : f=>addEventListener("load", f))(()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
