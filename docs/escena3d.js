/* Vitrina 360°: los productos más vendidos giran en un anillo 3D alrededor del logo de
   Electronic Games en relieve, sobre un piso brillante que los refleja.
   index.html lo carga solo cuando la sección está por verse (import dinámico). Si el
   navegador no tiene WebGL 2, iniciar() falla y la sección simplemente no aparece.
   three.js va recortado a las piezas que se usan aquí en vendor/three.js. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, ExtrudeGeometry, PlaneGeometry,
  CircleGeometry, BoxGeometry, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  MeshPhysicalMaterial, MeshBasicMaterial, SpriteMaterial, Sprite, CanvasTexture, Color, Fog,
  DirectionalLight, PointLight, PMREMGenerator, Raycaster, Vector2, SRGBColorSpace,
  NeutralToneMapping, BackSide, DoubleSide, AdditiveBlending
} from "./vendor/three.js";

const FONDO = 0x0A0A0B, NARANJA = 0xFF7A00;
const ANCHO = 1.5, ALTO = 1.875;   // tarjetas 4:5, como las fotos de la vitrina de la portada
const PISO = -1.35;                // altura del piso brillante
const W = 512, H = 640;            // resolución de cada tarjeta
// Trazos del logo real (los mismos de index.html), con su inclinación de marca.
const LOGO = ["M27.5 44.8H125V56H27.5z", "M27.5 60.7H125V72H56v16H27.5z", "M65 77.6h60v14.7a12 12 0 0 1-12 12H27.5V93H97v-5H65z"];

// ---------- Logo en relieve ----------
function piezasLogo(){
  const inclinar = ([x, y]) => [x - 0.7 * y + 51.8, -y];
  const curva = [];
  for (let k = 1; k <= 12; k++){ const a = k / 12 * Math.PI / 2; curva.push([113 + 12 * Math.cos(a), 92.3 + 12 * Math.sin(a)]); }
  return [
    [[27.5, 44.8], [125, 44.8], [125, 56], [27.5, 56]],
    [[27.5, 60.7], [125, 60.7], [125, 72], [56, 72], [56, 88], [27.5, 88]],
    [[65, 77.6], [125, 77.6], [125, 92.3], ...curva, [27.5, 104.3], [27.5, 93], [97, 93], [97, 88], [65, 88]]
  ].map(puntos=>{
    const s = new Shape();
    puntos.map(inclinar).forEach(([x, y], i)=>i ? s.lineTo(x, y) : s.moveTo(x, y));
    return s;
  });
}

// Estudio de fotografía de mentira: cajas de luz que se reflejan en el logo brillante.
function entorno(renderer){
  const s = new Scene();
  s.add(new Mesh(new BoxGeometry(30, 30, 30), new MeshBasicMaterial({color: 0x0d0c0e, side: BackSide})));
  const luz = (w, h, color, [x, y, z]) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({color, side: DoubleSide}));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  luz(14, 5, new Color(6, 6, 6), [0, 10, 4]);          // caja de luz blanca arriba
  luz(4, 12, new Color(5, 1.9, .35), [-11, 1, 3]);      // luz cálida (naranja de la marca) a la izquierda
  luz(4, 12, new Color(2.4, 2.6, 3.2), [11, 2, -2]);    // luz fría a la derecha
  luz(12, 2.5, new Color(2.2, 2.2, 2.2), [0, -1, 12]);  // brillo de frente
  const pm = new PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return tex;
}

// ---------- Texturas dibujadas en un lienzo 2D ----------
const lienzo2d = (w = W, h = H) => Object.assign(document.createElement("canvas"), {width: w, height: h});
function textura(c, renderer){
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// Frente: la foto sobre el mismo escenario claro de la tienda, con su consola y su precio.
function pintarFrente(c, p, img){
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 44); ctx.clip();
  const g = ctx.createRadialGradient(W / 2, H * .06, 10, W / 2, H * .3, H);
  g.addColorStop(0, "#ffffff"); g.addColorStop(.58, "#F4F1EC"); g.addColorStop(1, "#E4DED4");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (img?.naturalWidth){
    const caja = W * .8, alto = H - 200, k = Math.min(caja / img.naturalWidth, alto / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.globalCompositeOperation = "multiply";   // el blanco de la foto se funde con el escenario
    ctx.drawImage(img, (W - w) / 2, 84 + (alto - h) / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.textBaseline = "middle";
  if (p.tag){
    ctx.font = "800 26px Rubik, Arial, sans-serif";
    const tw = ctx.measureText(p.tag).width;
    ctx.fillStyle = p.tagColor;
    ctx.beginPath(); ctx.roundRect(30, 30, tw + 28, 44, 10); ctx.fill();
    ctx.fillStyle = p.tagInk; ctx.fillText(p.tag, 44, 53);
  }
  ctx.font = "italic 800 48px Rubik, Arial, sans-serif";
  const [e, d] = p.precio.toFixed(2).split(".");
  const wd = ctx.measureText("$").width, we = ctx.measureText(e).width;
  ctx.font = "italic 800 30px Rubik, Arial, sans-serif";
  const wc = ctx.measureText("." + d).width;
  ctx.fillStyle = "rgba(10,10,11,.92)";
  ctx.beginPath(); ctx.roundRect(30, H - 104, wd + we + wc + 48, 74, 37); ctx.fill();
  ctx.font = "italic 800 48px Rubik, Arial, sans-serif";
  ctx.fillStyle = "#FF7A00"; ctx.fillText("$", 52, H - 66);
  ctx.fillStyle = "#F7F4EF"; ctx.fillText(e, 52 + wd, H - 66);
  ctx.font = "italic 800 30px Rubik, Arial, sans-serif";
  ctx.fillText("." + d, 52 + wd + we, H - 74);
  ctx.restore();
}
// Reverso: tarjeta oscura con el logo, como el empaque de la marca.
function pintarReverso(c){
  const ctx = c.getContext("2d");
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 44);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1F1D21"); g.addColorStop(1, "#121113");
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = "#34313a";
  ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, 42); ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(2.1, 2.1); ctx.translate(-76, -74.5);
  ctx.transform(1, 0, -.7, 1, 51.8, 0);
  ctx.fillStyle = "#FE8903";
  for (const d of LOGO) ctx.fill(new Path2D(d));
  ctx.restore();
}
function degradado(tam, paradas){
  const c = lienzo2d(tam, tam), ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [k, color] of paradas) g.addColorStop(k, color);
  ctx.fillStyle = g; ctx.fillRect(0, 0, tam, tam);
  return c;
}

// ---------- Escena ----------
export function iniciar({contenedor, lienzo, seccion, productos, reducir = false, alElegir, alCambiar}){
  const renderer = new WebGLRenderer({canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(FONDO, 0);
  renderer.toneMapping = NeutralToneMapping;   // respeta el naranja de la marca (otros lo vuelven café)
  renderer.outputColorSpace = SRGBColorSpace;

  const escena = new Scene();
  escena.environment = entorno(renderer);
  escena.fog = new Fog(FONDO, 9, 21);
  const camara = new PerspectiveCamera(36, 2, .1, 60);

  const sol = new DirectionalLight(0xffffff, 1.4);
  sol.position.set(3, 6, 8);
  escena.add(sol);
  // Luz naranja que da vueltas alrededor del logo: el brillo recorre sus bordes.
  const orbita = new PointLight(0xFF9A2E, 18, 9, 1.6);
  escena.add(orbita);

  // Resplandor detrás de todo y polvo de luz que sube.
  const halo = new Sprite(new SpriteMaterial({map: new CanvasTexture(degradado(256, [[0, "rgba(255,122,0,1)"], [.3, "rgba(255,122,0,.35)"], [1, "rgba(255,122,0,0)"]])),
    blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: .5, fog: false, toneMapped: false}));
  halo.scale.set(13, 13, 1);
  halo.position.set(0, 1.6, -7);
  escena.add(halo);

  const N_POLVO = reducir ? 0 : 170, polvo = new Float32Array(N_POLVO * 3), subida = new Float32Array(N_POLVO);
  for (let i = 0; i < N_POLVO; i++){
    const a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 7;
    polvo.set([Math.cos(a) * r, PISO + Math.random() * 6, Math.sin(a) * r - 1], i * 3);
    subida[i] = .1 + Math.random() * .28;
  }
  const geoPolvo = new BufferGeometry();
  geoPolvo.setAttribute("position", new Float32BufferAttribute(polvo, 3));
  const puntos = new Points(geoPolvo, new PointsMaterial({size: .07, map: new CanvasTexture(degradado(64, [[0, "rgba(255,255,255,1)"], [.4, "rgba(255,255,255,.5)"], [1, "rgba(255,255,255,0)"]])),
    color: 0xFFB36B, transparent: true, opacity: .85, depthWrite: false, blending: AdditiveBlending, toneMapped: false}));
  if (N_POLVO) escena.add(puntos);

  // Logo: las tres piezas del logo real, extruidas con bisel, en naranja lacado.
  const geoLogo = new ExtrudeGeometry(piezasLogo(), {depth: 18, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 1.5, bevelSegments: 5, curveSegments: 14});
  geoLogo.center();
  const matLogo = new MeshPhysicalMaterial({color: NARANJA, metalness: .3, roughness: .26, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.25});
  const logo = new Mesh(geoLogo, matLogo);
  logo.scale.setScalar(3.9 / 139);
  escena.add(logo);

  // Espejo: copia de todo, volteada bajo el piso y más tenue (un reflejo barato y convincente).
  const espejo = new Group();
  espejo.scale.y = -1;
  espejo.position.y = 2 * PISO;
  escena.add(espejo);
  const logoReflejo = new Mesh(geoLogo, matLogo.clone());
  Object.assign(logoReflejo.material, {transparent: true, opacity: .32, depthWrite: false});
  logoReflejo.scale.copy(logo.scale);
  espejo.add(logoReflejo);
  // El piso tapa el reflejo cada vez más lejos del centro.
  const piso = new Mesh(new CircleGeometry(11, 64), new MeshBasicMaterial({color: FONDO, transparent: true, depthWrite: false,
    alphaMap: new CanvasTexture(degradado(256, [[0, "#5a5a5a"], [.45, "#9a9a9a"], [.8, "#ffffff"]]))}));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = PISO;
  piso.renderOrder = 2;
  escena.add(piso);

  // Tarjetas del anillo.
  const N = productos.length, PASO = Math.PI * 2 / N;
  const R = Math.max(3.4, N * (ANCHO + .48) / (Math.PI * 2));
  const geoTarjeta = new PlaneGeometry(ANCHO, ALTO);
  const texReverso = textura((c=>{ pintarReverso(c); return c; })(lienzo2d()), renderer);
  const matReverso = new MeshBasicMaterial({map: texReverso, alphaTest: .5, toneMapped: false});
  const matReversoRef = new MeshBasicMaterial({map: texReverso, transparent: true, opacity: .22, depthWrite: false, toneMapped: false});
  const tarjetas = productos.map((p, i)=>{
    const c = lienzo2d();
    pintarFrente(c, p, null);
    const tex = textura(c, renderer);
    const frente = new Mesh(geoTarjeta, new MeshBasicMaterial({map: tex, alphaTest: .5, toneMapped: false}));
    frente.userData.i = i;
    const reverso = new Mesh(geoTarjeta, matReverso);
    reverso.rotation.y = Math.PI;
    const grupo = new Group();
    grupo.add(frente, reverso);
    escena.add(grupo);
    const refFrente = new Mesh(geoTarjeta, new MeshBasicMaterial({map: tex, transparent: true, opacity: .3, depthWrite: false, toneMapped: false}));
    const refReverso = new Mesh(geoTarjeta, matReversoRef);
    refReverso.rotation.y = Math.PI;
    const reflejo = new Group();
    reflejo.add(refFrente, refReverso);
    espejo.add(reflejo);
    const t = {p, c, tex, frente, grupo, reflejo, lev: 0, img: null};
    // La foto llega después: la tarjeta se vuelve a dibujar con ella (y con la letra de la marca ya cargada).
    const img = new Image();
    img.decoding = "async";
    img.onload = ()=>{ t.img = img; pintarFrente(c, p, img); tex.needsUpdate = true; };
    img.src = p.foto;
    return t;
  });
  document.fonts?.load("italic 800 48px Rubik").then(()=>{ for (const t of tarjetas){ pintarFrente(t.c, t.p, t.img); t.tex.needsUpdate = true; } }).catch(()=>{});
  const frentes = tarjetas.map(t=>t.frente);

  // ---------- Estado del giro ----------
  // Posición en "tarjetas": 0 = la primera al frente, 1 = la segunda… El scroll suma una parte
  // (la sección se queda fija mientras el anillo gira) y el dedo o el mouse, la otra.
  const GIRO_SCROLL = reducir ? 0 : N * .7;
  let usuario = 0, vel = 0, destino = null, mostrado = 0, frenteActual = -1;
  let arrastre = null, sobre = -1;
  const puntero = new Vector2(-1e4, -1e4), pAlto = new Vector2(), rayo = new Raycaster();   // puntero: el mouse, fuera hasta que entra
  let px = 0, py = 0, pxS = 0, pyS = 0, anchoPx = 1, camZ = 12, camY = 1.9;

  const progresoScroll = () => {
    const r = seccion.getBoundingClientRect(), recorrido = r.height - innerHeight;
    return recorrido > 0 ? Math.min(1, Math.max(0, -r.top / recorrido)) : 0;
  };
  const parteScroll = () => progresoScroll() * GIRO_SCROLL;

  function tarjetaEn(x, y){
    const r = lienzo.getBoundingClientRect();
    pAlto.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(pAlto, camara);
    const hit = rayo.intersectObjects(frentes, false)[0];
    return hit ? hit.object.userData.i : -1;
  }
  lienzo.addEventListener("pointerdown", e=>{
    if (e.button !== 0) return;
    arrastre = {x: e.clientX, x0: e.clientX, y0: e.clientY, t: performance.now(), movio: false};
    vel = 0; destino = null;
  });
  lienzo.addEventListener("pointermove", e=>{
    const r = lienzo.getBoundingClientRect();
    if (e.pointerType === "mouse"){ px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5; puntero.set(e.clientX, e.clientY); }
    if (!arrastre) return;
    if (!arrastre.movio && Math.abs(e.clientX - arrastre.x0) > 6){
      arrastre.movio = true;
      try { lienzo.setPointerCapture(e.pointerId); } catch(err) {}
      contenedor.classList.add("arrastrando");
    }
    if (!arrastre.movio) return;
    const ahora = performance.now(), dt = Math.max(8, ahora - arrastre.t) / 1000;
    const d = -(e.clientX - arrastre.x) / (anchoPx * .2);
    usuario += d;
    vel = vel * .5 + (d / dt) * .5;
    arrastre.x = e.clientX; arrastre.t = ahora;
  });
  const soltar = e=>{
    if (!arrastre) return;
    const toque = !arrastre.movio && e?.type === "pointerup";
    if (performance.now() - arrastre.t > 90) vel = 0;   // si se quedó quieto antes de soltar, no hay inercia
    arrastre = null;
    contenedor.classList.remove("arrastrando");
    if (toque){ const i = tarjetaEn(e.clientX, e.clientY); if (i >= 0) alElegir?.(productos[i].code, i); }
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);   // en celular, un gesto vertical es scroll de la página
  lienzo.addEventListener("pointerleave", e=>{ if (e.pointerType === "mouse"){ px = py = 0; puntero.set(-1e4, -1e4); } });

  function medir(){
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (!w || !h) return;
    anchoPx = w;
    renderer.setSize(w, h, false);
    const aspecto = w / h;
    camara.aspect = aspecto;
    // En vertical (celular) la cámara se aleja y sube: se ve el anillo como una vitrina redonda.
    camZ = Math.min(19.5, Math.max(14.6, 17.5 / aspecto));
    camY = aspecto < 1 ? 4.2 : 3.4;
    // La niebla empieza detrás del anillo, a la misma distancia vista desde cualquier pantalla.
    escena.fog.near = camZ - 3.5;
    escena.fog.far = camZ + 8.5;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(contenedor);
  medir();

  // ---------- Cada cuadro ----------
  let t0 = performance.now(), reloj = 0;
  function actualizar(dt){
    reloj += reducir ? 0 : dt;
    const sc = parteScroll();
    if (!arrastre){
      if (Math.abs(vel) > .06 && !reducir){ usuario += vel * dt; vel *= Math.exp(-dt * 3.4); }
      else if (destino === null){ destino = Math.round(usuario + sc) - sc; vel = 0; }
      if (destino !== null) usuario += (destino - usuario) * (reducir ? 1 : 1 - Math.exp(-dt * 7));
    }
    const pos = usuario + sc;
    mostrado = reducir ? pos : mostrado + (pos - mostrado) * (1 - Math.exp(-dt * 9));
    const f = ((Math.round(mostrado) % N) + N) % N;
    if (f !== frenteActual){ frenteActual = f; alCambiar?.(f); }

    // Tarjeta bajo el mouse: se levanta un poco.
    const hover = arrastre || puntero.x < -1e3 ? -1 : tarjetaEn(puntero.x, puntero.y);
    if (hover !== sobre){ sobre = hover; contenedor.dataset.cursor = hover >= 0 ? "Ver" : "Arrastra"; lienzo.style.cursor = hover >= 0 ? "pointer" : ""; }
    tarjetas.forEach((t, i)=>{
      t.lev += ((i === sobre ? 1 : 0) - t.lev) * (reducir ? 1 : 1 - Math.exp(-dt * 10));
      const a = (i - mostrado) * PASO;
      const alFrente = Math.pow(Math.max(0, Math.cos(a)), 8);
      const r = R + alFrente * .45 + t.lev * .2;
      const y = Math.sin(reloj * .9 + i * 1.7) * .05 + t.lev * .18 + alFrente * .08;
      const s = 1 + alFrente * .1 + t.lev * .05;
      for (const g of [t.grupo, t.reflejo]){
        g.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        g.rotation.y = a;
        g.scale.setScalar(s);
      }
    });

    // El logo flota, mira hacia el mouse y se inclina un poco con la velocidad del giro.
    pxS += (px - pxS) * (1 - Math.exp(-dt * 4));
    pyS += (py - pyS) * (1 - Math.exp(-dt * 4));
    const giroVel = Math.max(-1, Math.min(1, (pos - mostrado) * .6));
    logo.position.y = 1.75 + Math.sin(reloj * 1.2) * .1;
    logo.rotation.set(-pyS * .35 + .08, Math.sin(reloj * .45) * .32 + pxS * .7 - giroVel * .5, Math.sin(reloj * .6) * .03);
    logoReflejo.position.copy(logo.position);
    logoReflejo.rotation.copy(logo.rotation);
    orbita.position.set(Math.cos(reloj * .8) * 2.6, 2.4 + Math.sin(reloj * .5) * .6, Math.sin(reloj * .8) * 2.6 + .6);
    halo.material.opacity = .45 + Math.sin(reloj * 1.3) * .06;

    if (N_POLVO){
      const arr = geoPolvo.attributes.position.array;
      for (let i = 0; i < N_POLVO; i++){
        arr[i * 3 + 1] += subida[i] * dt;
        if (arr[i * 3 + 1] > 4.8) arr[i * 3 + 1] = PISO;
      }
      geoPolvo.attributes.position.needsUpdate = true;
    }

    camara.position.set(pxS * 1.1 + Math.sin(reloj * .25) * .35, camY - pyS * .5, camZ);
    camara.lookAt(0, .2, 0);
  }

  let visible = false, corriendo = false;
  function cuadro(ahora){
    if (!corriendo) return;
    requestAnimationFrame(cuadro);
    const dt = Math.min(.05, Math.max(0, (ahora - t0) / 1000));
    t0 = ahora;
    actualizar(dt);
    renderer.render(escena, camara);
  }
  const revisar = () => {
    const debe = visible && document.visibilityState === "visible";
    if (debe && !corriendo){ corriendo = true; t0 = performance.now(); requestAnimationFrame(cuadro); }
    else if (!debe) corriendo = false;
  };
  new IntersectionObserver(([e])=>{ visible = e.isIntersecting; revisar(); }).observe(contenedor);
  document.addEventListener("visibilitychange", revisar);
  actualizar(0);
  renderer.render(escena, camara);

  return {
    // Botones ‹ ›: gira de a una tarjeta y se detiene justo al frente.
    girar(d){ const sc = parteScroll(); vel = 0; destino = Math.round(usuario + sc) + d - sc; }
  };
}
