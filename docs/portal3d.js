/* Portal de los mundos: los logos de PlayStation, Nintendo, Xbox y el de Electronic Games
   (Retro), en relieve 3D sobre una tornamesa que gira con el scroll. Mientras un logo se va
   de lado entra el siguiente y el fondo se tiñe del color de su marca.
   index.html lo carga solo cuando la sección está por verse; la geometría de los logos
   (vectorizados de los originales) viene de logos3d.json. Sin WebGL 2, la sección no aparece
   y quedan las tarjetas de siempre. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, ExtrudeGeometry, PlaneGeometry, BoxGeometry,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, MeshPhysicalMaterial, MeshBasicMaterial,
  SpriteMaterial, Sprite, CanvasTexture, Color, Fog, DirectionalLight, PointLight, PMREMGenerator,
  Raycaster, Vector2, SRGBColorSpace, NeutralToneMapping, BackSide, DoubleSide, AdditiveBlending
} from "./vendor/three.js";

const R = 3.4;   // radio de la tornamesa

// Logo de Electronic Games (mismo trazo que index.html y escena3d.js), en unidades del SVG.
function formasEG(){
  const inclinar = ([x, y]) => [x - 0.7 * y + 51.8 - 76, 74.5 - y];
  const curva = [];
  for (let k = 1; k <= 12; k++){ const a = k / 12 * Math.PI / 2; curva.push([113 + 12 * Math.cos(a), 92.3 + 12 * Math.sin(a)]); }
  const piezas = [
    [[27.5, 44.8], [125, 44.8], [125, 56], [27.5, 56]],
    [[27.5, 60.7], [125, 60.7], [125, 72], [56, 72], [56, 88], [27.5, 88]],
    [[65, 77.6], [125, 77.6], [125, 92.3], ...curva, [27.5, 104.3], [27.5, 93], [97, 93], [97, 88], [65, 88]]];
  return {formas: piezas.map(p=>{ const s = new Shape(); p.map(inclinar).forEach(([x, y], i)=>i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }), ancho: 139, alto: 60};
}
// Logos vectorizados: contornos y agujeros (coordenadas de SVG, y hacia abajo).
function formasDe(d){
  const cx = d.ancho / 2, cy = d.alto / 2;
  const forma = pts => { const s = new Shape(); pts.forEach(([x, y], i)=>i ? s.lineTo(x - cx, cy - y) : s.moveTo(x - cx, cy - y)); return s; };
  return {formas: d.formas.map(f=>{ const s = forma(f.c); s.holes = f.h.map(forma); return s; }), ancho: d.ancho, alto: d.alto};
}

function entorno(renderer){
  const s = new Scene();
  s.add(new Mesh(new BoxGeometry(30, 30, 30), new MeshBasicMaterial({color: 0x121114, side: BackSide})));
  const luz = (w, h, color, [x, y, z]) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({color, side: DoubleSide}));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  luz(14, 5, new Color(7, 7, 7), [0, 10, 5]);
  luz(4, 12, new Color(3, 3, 3.3), [-11, 1, 4]);
  luz(4, 12, new Color(3.3, 3.1, 3), [11, 2, 2]);
  luz(12, 2.5, new Color(2.5, 2.5, 2.5), [0, -2, 12]);
  const pm = new PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return t;
}
function degradado(tam, paradas){
  const c = Object.assign(document.createElement("canvas"), {width: tam, height: tam}), ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [k, col] of paradas) g.addColorStop(k, col);
  ctx.fillStyle = g; ctx.fillRect(0, 0, tam, tam);
  return new CanvasTexture(c);
}
// Scroll -> mundo: se queda un rato en cada logo (meseta) y gira entre uno y otro.
const suave = x => x * x * (3 - 2 * x);
function mundoDe(p, n){
  const f = p * (n - 1), i = Math.min(n - 2, Math.floor(f)), r = f - i;
  return i + suave(Math.min(1, Math.max(0, (r - 0.28) / 0.44)));
}

export function iniciar({contenedor, lienzo, seccion, mundos, logos, reducir = false, alCambiar, alElegir}){
  // Calidad según el equipo: en celulares, menos píxeles y sin tornasol (el efecto más caro del material);
  // y si aun así los cuadros tardan, la resolución baja sola (ver vigilar()).
  const tactil = matchMedia("(pointer: coarse)").matches;
  let pr = Math.min(devicePixelRatio || 1, tactil ? 1.5 : 1.75);
  const renderer = new WebGLRenderer({canvas: lienzo, antialias: true, alpha: false, powerPreference: "high-performance"});
  renderer.setPixelRatio(pr);
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const N = mundos.length, PASO = Math.PI * 2 / N;
  const escena = new Scene();
  escena.environment = entorno(renderer);
  escena.fog = new Fog(0x000000, 8, 16);
  const camara = new PerspectiveCamera(34, 2, .1, 60);
  const sol = new DirectionalLight(0xffffff, 1.6);
  sol.position.set(4, 6, 9);
  escena.add(sol);

  // Resplandor del color de la marca detrás del logo, sombra bajo él y chispas que suben.
  const resplandor = new Sprite(new SpriteMaterial({map: degradado(256, [[0, "rgba(255,255,255,1)"], [.35, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]),
    blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: .55, fog: false, toneMapped: false}));
  resplandor.scale.set(11, 11, 1);
  escena.add(resplandor);
  const sombra = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({map: degradado(128, [[0, "rgba(0,0,0,.55)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false, fog: false}));
  sombra.rotation.x = -Math.PI / 2;
  sombra.scale.set(4.2, 1.5, 1);
  escena.add(sombra);
  const N_CH = reducir ? 0 : 140, chispas = new Float32Array(N_CH * 3), vel = new Float32Array(N_CH);
  for (let i = 0; i < N_CH; i++){
    chispas.set([(Math.random() - .5) * 16, -3 + Math.random() * 7, R - 5 + Math.random() * 7], i * 3);
    vel[i] = .15 + Math.random() * .35;
  }
  const geoCh = new BufferGeometry();
  geoCh.setAttribute("position", new Float32BufferAttribute(chispas, 3));
  const puntos = new Points(geoCh, new PointsMaterial({size: .06, map: degradado(64, [[0, "rgba(255,255,255,1)"], [.4, "rgba(255,255,255,.45)"], [1, "rgba(255,255,255,0)"]]),
    transparent: true, opacity: .8, depthWrite: false, blending: AdditiveBlending, toneMapped: false, fog: false}));
  if (N_CH) escena.add(puntos);

  // Tornamesa con los logos: cara blanca lacada (como los logos originales) y canto del color de la marca.
  const mesa = new Group();
  escena.add(mesa);
  const piezas = mundos.map((m, i)=>{
    const {formas, ancho, alto} = m.logo === "eg" ? formasEG() : formasDe(logos[m.logo]);
    const k = Math.min(3 / ancho, 2.3 / alto);   // todos del mismo tamaño aparente
    const prof = m.logo === "nintendo" ? .22 : .34;
    const geo = new ExtrudeGeometry(formas, {depth: prof / k, bevelEnabled: true, bevelThickness: .045 / k, bevelSize: (m.logo === "nintendo" ? .014 : .03) / k, bevelSegments: 4, curveSegments: 6});
    geo.center();
    const cara = m.logo === "eg"
      ? new MeshPhysicalMaterial({color: 0xFF7A00, metalness: .3, roughness: .24, clearcoat: 1, clearcoatRoughness: .06})
      : new MeshPhysicalMaterial({color: 0xffffff, metalness: 0, roughness: .16, clearcoat: 1, clearcoatRoughness: .04, iridescence: tactil ? 0 : .35, iridescenceIOR: 1.4});
    const canto = new MeshPhysicalMaterial({color: new Color(m.c).multiplyScalar(m.logo === "eg" ? .55 : .9), metalness: .55, roughness: .3, clearcoat: .6});
    const malla = new Mesh(geo, [cara, canto]);
    malla.scale.setScalar(k);
    malla.userData.i = i;
    const soporte = new Group();
    soporte.add(malla);
    mesa.add(soporte);
    return {soporte, malla, c1: new Color(m.c), c2: new Color(m.c2)};
  });
  const mallas = piezas.map(p=>p.malla);
  // Luz del color de la marca que roza el logo desde atrás (el canto brilla con su color). Solo dos luces
  // (la del logo que se va y la del que llega) en vez de una por logo: cada luz encarece cada píxel.
  const rims = [0, 1].map(()=>{ const l = new PointLight(0xffffff, 0, 7, 1.5); escena.add(l); return l; });

  // ---------- Estado ----------
  let f = 0, fS = 0, actual = -1, px = 0, py = 0, pxS = 0, pyS = 0, reloj = 0;
  let dx = 0, dy = 0, esc = 1, camZ = 11;
  const fondo = new Color(), brillo = new Color(), tmp = new Color();
  const rayo = new Raycaster(), p2 = new Vector2();
  const progreso = () => {
    const r = seccion.getBoundingClientRect(), recorrido = r.height - innerHeight;
    return recorrido > 0 ? Math.min(1, Math.max(0, -r.top / recorrido)) : 0;
  };

  lienzo.addEventListener("pointermove", e=>{
    if (e.pointerType !== "mouse") return;
    const r = lienzo.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5;
  }, {passive: true});
  lienzo.addEventListener("pointerleave", ()=>{ px = py = 0; });
  // Tocar el logo del frente entra a ese mundo.
  lienzo.addEventListener("click", e=>{
    const r = lienzo.getBoundingClientRect();
    p2.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(p2, camara);
    const hit = rayo.intersectObjects(mallas, false)[0];
    if (hit && hit.object.userData.i === actual) alElegir?.(actual);
  });

  function medir(){
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const a = w / h;
    camara.aspect = a;
    // Horizontal: el logo va a la derecha, sin tocar el texto de la izquierda ni los botones.
    // Vertical: arriba (el texto va abajo). Se calcula con lo que la cámara ve a esa distancia.
    camZ = a >= 1.05 ? 11 : 11 + (1.05 - a) * 5;
    const medioAlto = Math.tan(17 * Math.PI / 180) * (camZ - R), medioAncho = medioAlto * a;
    if (a >= 1.05){ dx = medioAncho * .43; dy = .05; esc = Math.min(.84, medioAncho * .22); }
    else { dx = 0; dy = medioAlto * .46; esc = Math.min(.85, medioAncho * .42); }
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(contenedor);
  medir();

  let t0 = performance.now();
  function actualizar(dt){
    reloj += reducir ? 0 : dt;
    f = mundoDe(progreso(), N);
    fS = reducir ? f : fS + (f - fS) * (1 - Math.exp(-dt * 8));
    const i = Math.min(N - 1, Math.max(0, Math.round(fS)));
    if (i !== actual){ actual = i; alCambiar?.(i); }

    // Color de fondo y del resplandor: mezcla entre la marca que se va y la que llega.
    const a = Math.min(N - 2, Math.floor(fS)), b = a + 1, t = fS - a;
    // A mitad del giro todo se oscurece (como un corte de cine): así no aparecen mezclas feas como rojo + verde = café.
    const apagado = 1 - .7 * Math.sin(Math.PI * t);
    fondo.copy(t < .5 ? piezas[a].c2 : piezas[b].c2).multiplyScalar(apagado);
    brillo.copy(t < .5 ? piezas[a].c1 : piezas[b].c1).multiplyScalar(apagado);
    renderer.setClearColor(tmp.copy(fondo).multiplyScalar(.9));
    escena.fog.color.copy(fondo);
    resplandor.material.color.copy(brillo);
    resplandor.material.opacity = .5 + Math.sin(reloj * 1.2) * .06;

    pxS += (px - pxS) * (1 - Math.exp(-dt * 4));
    pyS += (py - pyS) * (1 - Math.exp(-dt * 4));
    mesa.position.set(dx, dy, 0);
    mesa.rotation.y = -fS * PASO;
    piezas.forEach((p, k)=>{
      const ang = k * PASO;
      const frente = Math.max(0, Math.cos(ang - fS * PASO));
      p.soporte.position.set(Math.sin(ang) * R, Math.sin(reloj * 1.1 + k) * .08, Math.cos(ang) * R);
      p.soporte.rotation.y = ang;
      p.soporte.scale.setScalar(esc * (.55 + .45 * frente * frente));
      // El del frente se inclina hacia el mouse y se mece un poco; los demás quedan quietos.
      p.malla.rotation.set(frente * (-pyS * .45 + Math.sin(reloj * .7 + k) * .05), frente * (pxS * .7 + Math.sin(reloj * .5 + k) * .18), 0);
      p.frente = frente;
    });
    mesa.updateMatrixWorld();
    [a, b].forEach((k, j)=>{
      const p = piezas[k];
      p.soporte.localToWorld(rims[j].position.set(-1.6, 1.4, -1.2));   // arriba, a la izquierda y detrás del logo
      rims[j].color.copy(p.c1);
      rims[j].intensity = 14 * p.frente;
    });
    resplandor.position.set(dx, dy + .1, R - 2.2);
    sombra.position.set(dx, dy - 1.55 * esc, R);
    sombra.material.opacity = .9;

    if (N_CH){
      const arr = geoCh.attributes.position.array;
      for (let k = 0; k < N_CH; k++){ arr[k * 3 + 1] += vel[k] * dt; if (arr[k * 3 + 1] > 4.5) arr[k * 3 + 1] = -3; }
      geoCh.attributes.position.needsUpdate = true;
    }
    camara.position.set(pxS * .8 + Math.sin(reloj * .25) * .25, .45 - pyS * .4, camZ);
    camara.lookAt(0, .05, R);
  }

  // Si más de un tercio de los cuadros tarda (menos de ~38 por segundo), se baja la resolución un paso.
  let lentos = 0, cuenta = 0;
  function vigilar(ms){
    cuenta++; if (ms > 26) lentos++;
    if (cuenta < 90) return;
    if (lentos > 30 && pr > 1){ pr = Math.max(1, pr - .25); renderer.setPixelRatio(pr); medir(); }
    cuenta = lentos = 0;
  }

  let visible = false, corriendo = false, listo = false;
  function cuadro(ahora){
    if (!corriendo) return;
    requestAnimationFrame(cuadro);
    vigilar(ahora - t0);
    const dt = Math.min(.05, Math.max(0, (ahora - t0) / 1000));
    t0 = ahora;
    actualizar(dt);
    renderer.render(escena, camara);
  }
  const revisar = () => {
    const debe = listo && visible && document.visibilityState === "visible";
    if (debe && !corriendo){ corriendo = true; t0 = performance.now(); requestAnimationFrame(cuadro); }
    else if (!debe) corriendo = false;
  };
  new IntersectionObserver(([e])=>{ visible = e.isIntersecting; revisar(); }).observe(contenedor);
  document.addEventListener("visibilitychange", revisar);
  actualizar(0);
  // Los shaders se compilan en paralelo (sin congelar la página) antes del primer cuadro.
  const empezar = () => { listo = true; renderer.render(escena, camara); revisar(); };
  (renderer.compileAsync ? renderer.compileAsync(escena, camara) : Promise.resolve()).then(empezar, empezar);
  return {mundoDe: p=>mundoDe(p, N)};
}
