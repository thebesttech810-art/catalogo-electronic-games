/* El muñequito de Electronic Games en 3D: da la bienvenida en la portada.
   Está armado con piezas simples (esferas y cápsulas con contorno negro, como el dibujo) para que
   pese poco: casco naranja con visor negro y ojos que parpadean, audífonos, el logo en el pecho y
   brazos articulados. Llega de un salto, saluda, hace "pulgar arriba" y se queda bailando con la
   música; si lo tocan, salta y dice algo. index.html lo carga apenas se pinta la página; sin WebGL 2
   o con "reducir movimiento" se muestra el dibujo plano (mascota/mascota.webp). */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Shape, ShapeGeometry, PlaneGeometry, CircleGeometry,
  SphereGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, RingGeometry, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, MeshPhongMaterial, MeshBasicMaterial, SpriteMaterial, Sprite, CanvasTexture, Color,
  DirectionalLight, HemisphereLight, Raycaster, Vector2, Vector3, SRGBColorSpace, BackSide, AdditiveBlending
} from "./vendor/three.js";

const NARANJA = 0xFF8A1A, NEGRO = 0x19181c, GRIS = 0x3a383f, CONTORNO = 0x050506, BRILLO = 0xFFB066;
const R = .72;   // radio del casco

// ---------- Ayudas de dibujo ----------
function lienzo2d(w, h){ const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function textura(c){ const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }
function rrect(g, x, y, w, h, r){
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Contorno de dibujo animado: una copia inflada hacia afuera, negra y vista por dentro.
function inflar(geo, g){
  const c = geo.clone(), p = c.attributes.position, n = c.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * g, p.getY(i) + n.getY(i) * g, p.getZ(i) + n.getZ(i) * g);
  return c;
}
const matContorno = new MeshBasicMaterial({color: CONTORNO, side: BackSide});
function pieza(geo, mat, grosor = .032){
  const grupo = new Group();
  grupo.add(new Mesh(geo, mat));
  if (grosor) grupo.add(new Mesh(inflar(geo, grosor), matContorno));
  return grupo;
}
function redondeado(w, h, r){
  const s = new Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new ShapeGeometry(s, 6);
}
// Ojos felices: un arco grueso (^), para cuando saluda.
function arco(w, grosor){
  const s = new Shape(), r = w / 2, r2 = r - grosor;
  s.absarc(0, -r * .35, r, 0, Math.PI, false);
  s.absarc(0, -r * .35, r2, Math.PI, 0, true);
  return new ShapeGeometry(s, 12);
}

// Casco: naranja con el visor negro. Se dibuja en la textura de la esfera (proyección equirectangular)
// convirtiendo cada punto de la forma vista de frente a latitud y longitud: así el visor se ve recto.
function texturaCasco(){
  const W = 1024, H = 512, [c, g] = lienzo2d(W, H);
  g.fillStyle = "#FF8A1A"; g.fillRect(0, 0, W, H);
  const aCanvas = (x, y) => {
    const fi = Math.asin(Math.max(-1, Math.min(1, y))), cf = Math.cos(fi);
    const la = Math.asin(Math.max(-1, Math.min(1, x / Math.max(.05, cf))));
    return [(0.25 + la / (2 * Math.PI)) * W, (Math.PI / 2 - fi) / Math.PI * H];
  };
  const forma = (x0, y0, x1, y1, r, pasos = 14) => {
    // Rectángulo redondeado de frente (en radios del casco), recorrido punto a punto.
    const pts = [], esq = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, Math.PI * 1.5]];
    for (const [cx, cy, a0] of esq) for (let k = 0; k <= pasos; k++){ const a = a0 + k / pasos * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    g.beginPath();
    pts.forEach(([x, y], i)=>{ const [px, py] = aCanvas(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.closePath();
  };
  // Borde naranja más oscuro alrededor del visor (como el dibujo) y el visor negro brillante.
  forma(-.8, -.7, .8, .44, .32); g.fillStyle = "#D9600A"; g.fill();
  forma(-.76, -.66, .76, .40, .29);
  const vid = g.createLinearGradient(0, H * .25, 0, H * .78);
  vid.addColorStop(0, "#26242a"); vid.addColorStop(.35, "#0c0b0e"); vid.addColorStop(1, "#050506");
  g.fillStyle = vid; g.fill();
  // Reflejo en la parte alta del visor.
  forma(-.62, .22, .5, .34, .06); g.fillStyle = "rgba(255,255,255,.10)"; g.fill();
  return textura(c);
}

// Logo del pecho: el de la tienda (no el del dibujo, que tenía la letra cambiada).
async function texturaEmblema(){
  const S = 512, [c, g] = lienzo2d(S, S);
  try { await document.fonts?.load("italic 900 60px Rubik"); } catch {}
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  const f = g.createRadialGradient(S * .42, S * .3, 10, S / 2, S / 2, S / 2);
  f.addColorStop(0, "#2a282d"); f.addColorStop(1, "#0d0c0e");
  g.fillStyle = f; g.fill();
  g.lineWidth = 16; g.strokeStyle = "#FF8A1A"; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2); g.stroke();
  // Logo EG (las mismas tres piezas del ícono, inclinadas)
  g.save(); g.translate(S / 2 - 150, 110); g.scale(2.35, 2.35); g.transform(1, 0, -.7, 1, 51.8 - 6, -44.5);
  g.fillStyle = "#FF8A1A";
  g.fill(new Path2D("M27.5 44.8H125V56H27.5zM27.5 60.7H125V72H56v16H27.5zM65 77.6h60v14.7a12 12 0 0 1-12 12H27.5V93H97v-5H65z"));
  g.restore();
  g.fillStyle = "#FF8A1A"; g.textAlign = "center"; g.font = "italic 900 58px Rubik, system-ui, sans-serif";
  g.fillText("ELECTRONIC", S / 2, 338); g.fillText("GAMES", S / 2, 398);
  return textura(c);
}
function texturaNota(txt){
  const [c, g] = lienzo2d(128, 128);
  g.font = "900 96px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = "#050506"; g.strokeText(txt, 64, 70);
  g.fillStyle = "#FF8A1A"; g.fillText(txt, 64, 70);
  return textura(c);
}
function texturaDegradado(tam, paradas){
  const [c, g] = lienzo2d(tam, tam), d = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [p, col] of paradas) d.addColorStop(p, col);
  g.fillStyle = d; g.fillRect(0, 0, tam, tam);
  return textura(c);
}
function texturaEstrella(){
  const [c, g] = lienzo2d(128, 128);
  g.translate(64, 64); g.fillStyle = "#fff";
  g.beginPath();
  for (let k = 0; k < 8; k++){ const r = k % 2 ? 12 : 60, a = k * Math.PI / 4 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill();
  return textura(c);
}

// ---------- El muñequito ----------
function armar(mat){
  const raiz = new Group();         // posición en el piso, saltos y aplastones
  const cuerpo = new Group();       // se mece con la música (las piernas quedan firmes)
  raiz.add(cuerpo);

  // Piernas y zapatos
  const geoPierna = new CapsuleGeometry(.19, .22, 6, 16);
  const geoZapato = new SphereGeometry(.3, 24, 16); geoZapato.scale(.92, .56, 1.25);
  for (const lado of [-1, 1]){
    const pierna = pieza(geoPierna, mat.negro); pierna.position.set(lado * .25, .44, 0); raiz.add(pierna);
    const zapato = pieza(geoZapato, mat.naranja); zapato.position.set(lado * .28, .16, .08); zapato.rotation.y = lado * .12; raiz.add(zapato);
  }

  // Torso con el logo
  const geoTorso = new CapsuleGeometry(.55, .3, 8, 28); geoTorso.scale(1, 1, .82);
  const torso = pieza(geoTorso, mat.negro); torso.position.y = 1.12; cuerpo.add(torso);
  const geoLogo = new CylinderGeometry(.556, .556, .5, 24, 1, true, -.45, .9); geoLogo.scale(1, 1, .82);
  const logo = new Mesh(geoLogo, mat.emblema); logo.position.y = 1.14; cuerpo.add(logo);

  // Brazos: hombro -> codo -> mano (con el pulgar), para poder saludar y hacer "pulgar arriba".
  const geoBrazo = new CapsuleGeometry(.14, .24, 6, 14); geoBrazo.translate(0, -.24, 0);
  const geoAnte = new CapsuleGeometry(.13, .18, 6, 14); geoAnte.translate(0, -.2, 0);
  const geoPuno = new TorusGeometry(.14, .055, 10, 24); geoPuno.rotateX(Math.PI / 2);
  const geoMano = new SphereGeometry(.2, 20, 14); geoMano.scale(1, 1.08, .88);
  const geoPulgar = new CapsuleGeometry(.068, .12, 5, 10); geoPulgar.translate(0, -.1, 0);
  const brazos = [-1, 1].map(lado=>{
    const hombro = new Group(); hombro.position.set(lado * .52, 1.5, 0); cuerpo.add(hombro);
    hombro.add(pieza(geoBrazo, mat.negro));
    const codo = new Group(); codo.position.y = -.42; hombro.add(codo);
    codo.add(pieza(geoAnte, mat.negro));
    const puno = pieza(geoPuno, mat.naranja, .02); puno.position.y = -.3; codo.add(puno);
    const mano = new Group(); mano.position.y = -.46; codo.add(mano);
    mano.add(pieza(geoMano, mat.negro));
    const pulgar = new Group(); pulgar.position.set(-lado * .1, -.12, .08); mano.add(pulgar);
    pulgar.add(pieza(geoPulgar, mat.negro, .025));
    return {lado, hombro, codo, mano, pulgar};
  });

  // Cabeza: casco, visor, ojos y audífonos
  const cabeza = new Group(); cabeza.position.y = 1.62; cuerpo.add(cabeza);   // pivote en el cuello
  const geoCasco = new SphereGeometry(R, 48, 32); geoCasco.scale(1.06, .96, 1);
  const casco = pieza(geoCasco, mat.casco, .036); casco.position.y = .66; cabeza.add(casco);
  const ojos = new Group(); ojos.position.y = .66; cabeza.add(ojos);
  const geoOjo = redondeado(.2, .33, .085), geoFeliz = arco(.25, .08);
  const matOjo = new MeshBasicMaterial({color: 0xFF9A2E, toneMapped: false});
  const listaOjos = [-1, 1].map(lado=>{
    // Sobre la superficie del casco (que está un poco achatado), mirando hacia afuera.
    const x = lado * .3, y = -.13, z = Math.sqrt(1 - x * x - y * y), a = R * 1.06, b = R * .96;
    const nx = x / a, ny = y / b, nz = z / R, nl = Math.hypot(nx, ny, nz);
    const ojo = new Group();
    ojo.position.set(x * a + nx / nl * .03, y * b + ny / nl * .03, z * R + nz / nl * .03);
    ojo.rotation.order = "YXZ"; ojo.rotation.y = Math.atan2(nx, nz); ojo.rotation.x = -Math.asin(ny / nl);
    const abierto = new Mesh(geoOjo, matOjo), feliz = new Mesh(geoFeliz, matOjo);
    feliz.visible = false; ojo.add(abierto, feliz); ojos.add(ojo);
    return {ojo, abierto, feliz, x0: ojo.position.x};
  });
  // Audífonos: vincha sobre el casco y dos parlantes con un aro que se enciende con la música.
  const geoVincha = new TorusGeometry(.84, .075, 12, 48, Math.PI);
  geoVincha.scale(1, .92, 1);
  const vincha = pieza(geoVincha, mat.negro, .028); vincha.position.set(0, .66, -.06); vincha.rotation.x = -.12; cabeza.add(vincha);
  const geoParlante = new SphereGeometry(.3, 24, 18); geoParlante.scale(.55, 1, 1);
  const geoTapa = new CircleGeometry(.2, 28), geoAro = new TorusGeometry(.2, .028, 8, 32);
  const matAro = new MeshBasicMaterial({color: 0xFF7A00, toneMapped: false, transparent: true, opacity: .9});
  const parlantes = [-1, 1].map(lado=>{
    const p = new Group(); p.position.set(lado * .84, .6, -.02); cabeza.add(p);
    p.add(pieza(geoParlante, mat.negro, .03));
    const tapa = new Mesh(geoTapa, mat.gris); tapa.position.x = lado * .166; tapa.rotation.y = lado * Math.PI / 2; p.add(tapa);
    const aro = new Mesh(geoAro, matAro); aro.position.x = lado * .17; aro.rotation.y = lado * Math.PI / 2; p.add(aro);
    return p;
  });

  // Zona para tocarlo (invisible)
  const zona = new Mesh(new CylinderGeometry(1, 1, 3.2, 12), new MeshBasicMaterial({visible: false}));
  zona.position.y = 1.55; raiz.add(zona);
  return {raiz, cuerpo, cabeza, brazos, ojos: listaOjos, parlantes, zona, logo, matAro};
}

// Poses de los brazos: [hombro z, hombro x, codo z, mano z] para el brazo izquierdo de la pantalla
// (el derecho es el espejo). Todo gira en el plano de frente, como en el dibujo.
const POSES = {
  reposo:  {izq: [-.32, 0, -.18, 0], der: [.9, .2, -1.52, .3]},     // la mano derecha en la cadera, como el dibujo
  saludo:  {izq: [-2.2, .45, -.6, 0], der: [.9, .2, -1.52, .3]},
  pulgar:  {izq: [-1.1, .45, -1.72, .15], der: [.9, .2, -1.52, .3]},
  brazos:  {izq: [-2.2, .1, -.5, 0], der: [2.2, .1, .5, 0]},          // festejo: los dos arriba
};

export function iniciar({contenedor, lienzo, reducir = false, bienvenida = true, frases = [], alDecir, alTocar}){
  const tactil = matchMedia("(pointer: coarse)").matches;
  let pr = Math.min(devicePixelRatio || 1, tactil ? 1.75 : 2);
  const renderer = new WebGLRenderer({canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const escena = new Scene();
  const camara = new PerspectiveCamera(26, 1, .1, 60);
  // Luz principal arriba a la izquierda (el brillo cae en el casco, como en el dibujo), relleno sin
  // brillos (hemisférica) y un contraluz naranja que marca los bordes.
  escena.add(new HemisphereLight(0xfff4e8, 0x4a1c00, 2.1));
  const sol = new DirectionalLight(0xffffff, 2.5); sol.position.set(-5.5, 6.5, 2.6); escena.add(sol);
  const contraluz = new DirectionalLight(0xFF7A00, 3.2); contraluz.position.set(4, 3, -4); escena.add(contraluz);

  const mat = {
    naranja: new MeshPhongMaterial({color: NARANJA, specular: 0x6a5a4a, shininess: 70}),
    casco: new MeshPhongMaterial({color: 0xffffff, specular: 0x7a6e62, shininess: 110, map: texturaCasco()}),
    negro: new MeshPhongMaterial({color: NEGRO, specular: 0x4a4a52, shininess: 60}),
    gris: new MeshPhongMaterial({color: GRIS, specular: 0x555555, shininess: 40}),
    emblema: new MeshPhongMaterial({color: 0xffffff, specular: 0x333333, shininess: 40, alphaTest: .4, visible: false}),
  };
  texturaEmblema().then(t=>{ mat.emblema.map = t; mat.emblema.visible = true; mat.emblema.needsUpdate = true; });
  const m = armar(mat);
  escena.add(m.raiz);

  // Piso: aro de luz, sombra y la onda al caer.
  const aro = new Mesh(new RingGeometry(.95, 1.25, 64), new MeshBasicMaterial({color: 0xFF7A00, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false}));
  aro.rotation.x = -Math.PI / 2; aro.position.y = .005; aro.scale.setScalar(.92); escena.add(aro);
  const luzPiso = new Mesh(new PlaneGeometry(3.4, 3.4), new MeshBasicMaterial({map: texturaDegradado(128, [[0, "rgba(255,122,0,.55)"], [1, "rgba(255,122,0,0)"]]), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false}));
  luzPiso.rotation.x = -Math.PI / 2; luzPiso.position.y = .002; escena.add(luzPiso);
  const sombra = new Mesh(new PlaneGeometry(1.9, 1.9), new MeshBasicMaterial({map: texturaDegradado(128, [[0, "rgba(0,0,0,.7)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false}));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = .01; escena.add(sombra);
  const onda = new Mesh(new RingGeometry(.9, 1, 64), new MeshBasicMaterial({color: 0xFFB066, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false}));
  onda.rotation.x = -Math.PI / 2; onda.position.y = .02; escena.add(onda);

  // Chispas al caer
  const N_CH = reducir ? 0 : 40, posCh = new Float32Array(N_CH * 3), velCh = new Float32Array(N_CH * 3);
  const geoCh = new BufferGeometry(); geoCh.setAttribute("position", new Float32BufferAttribute(posCh, 3));
  const chispas = new Points(geoCh, new PointsMaterial({size: .09, map: texturaDegradado(64, [[0, "rgba(255,255,255,1)"], [.4, "rgba(255,190,110,.6)"], [1, "rgba(255,122,0,0)"]]),
    transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false}));
  if (N_CH) escena.add(chispas);
  let vidaCh = 0;
  const lanzarChispas = () => {
    for (let i = 0; i < N_CH; i++){
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5;
      posCh.set([Math.cos(a) * .7, .1, Math.sin(a) * .7], i * 3);
      velCh.set([Math.cos(a) * v, 1.5 + Math.random() * 3, Math.sin(a) * v], i * 3);
    }
    vidaCh = 1;
  };

  // Notas musicales que salen de los audífonos
  const texNotas = [texturaNota("♪"), texturaNota("♫")];
  const notas = Array.from({length: 6}, (_, i)=>{
    const s = new Sprite(new SpriteMaterial({map: texNotas[i % 2], transparent: true, opacity: 0, depthWrite: false}));
    s.scale.setScalar(.34); escena.add(s);
    return {s, vida: 0, lado: i % 2 ? 1 : -1, vx: 0};
  });
  let proxNota = 1.2;
  // Destello en el pulgar
  const estrella = new Sprite(new SpriteMaterial({map: texturaEstrella(), color: 0xFFD08A, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false}));
  escena.add(estrella);
  let vidaEstrella = 0;

  // ---------- Medidas: el muñequito entra completo en cualquier lienzo ----------
  let ancho = 1, alto = 1, gesto = 0;
  function medir(){
    ancho = contenedor.clientWidth; alto = contenedor.clientHeight;
    if (!ancho || !alto) return;
    renderer.setSize(ancho, alto, false);
    // La página decide dónde va (--mascota-x: corrido a la derecha, en fracción del ancho) y cuánto
    // aire deja arriba y abajo (--mascota-alto: media altura a encuadrar, en metros del muñequito).
    const css = getComputedStyle(contenedor);
    const dx = parseFloat(css.getPropertyValue("--mascota-x")) || 0, medio = parseFloat(css.getPropertyValue("--mascota-alto")) || 1.85;
    gesto = css.getPropertyValue("--mascota-mano").trim() === "der" ? 1 : 0;   // con qué mano saluda
    const a = ancho / alto, t = Math.tan(camara.fov * Math.PI / 360);
    // Caja a encuadrar: del piso a la punta de la mano levantada, con los brazos abiertos.
    const d = Math.max(medio / t, 1.45 / (t * a * (1 - 2 * Math.abs(dx)))) + .6;
    camara.aspect = a;
    camara.position.set(0, 1.9, d);
    camara.lookAt(0, 1.55, 0);
    if (dx) camara.setViewOffset(ancho, alto, -dx * ancho, 0, ancho, alto); else camara.clearViewOffset();
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(contenedor);
  medir();

  // ---------- Interacción ----------
  let px = 0, py = 0, pxS = 0, pyS = 0, sobre = false, listo = false;
  const rayo = new Raycaster(), p2 = new Vector2();
  const tocaMuneco = (x, y) => {
    const r = lienzo.getBoundingClientRect();
    p2.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(p2, camara);
    return rayo.intersectObject(m.zona, false).length > 0;
  };
  // Mira hacia el mouse en toda la portada (no solo sobre el lienzo).
  const portada = contenedor.closest("section") || contenedor;
  portada.addEventListener("pointermove", e=>{
    if (e.pointerType !== "mouse") return;
    const r = lienzo.getBoundingClientRect();
    px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * .9)));
    py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * .3)) / (r.height * .9)));
    const s = listo && tocaMuneco(e.clientX, e.clientY);
    if (s !== sobre){ sobre = s; portada.classList.toggle("sobre-mascota", s); }
  }, {passive: true});
  portada.addEventListener("pointerleave", ()=>{ px = py = 0; });
  // El lienzo deja pasar el mouse (debajo están los productos de la vitrina): el toque se revisa en la
  // portada y, si cae sobre el muñequito, no abre lo que está detrás.
  portada.addEventListener("click", e=>{
    if (!listo || accion.nombre === "espera" || accion.nombre === "cae" || !tocaMuneco(e.clientX, e.clientY)) return;
    e.preventDefault(); e.stopPropagation();
    alTocar?.();
    saltar();
  }, true);

  // ---------- Animación ----------
  // Pose actual (suavizada) y la que se busca; encima se suman los movimientos de cada acción.
  const actual = {izq: [...POSES.reposo.izq], der: [...POSES.reposo.der]};
  let pose = "reposo", felices = false;
  let accion = {nombre: bienvenida && !reducir ? "espera" : "baila", t: 0};
  let alturaY = accion.nombre === "espera" ? 6 : 0, velY = 0, aplaste = 0, velAplaste = 0, giro = 0, cabezaRy = 0;
  let parpadeo = 0, proxParpadeo = 2, reloj = 0, luz = accion.nombre === "espera" ? 0 : 1;
  let fraseI = 0, cola = [];

  const decir = (texto, ms = 3200) => alDecir?.(texto, ms);
  function secuencia(pasos){ cola = pasos.slice(); siguiente(); }
  function siguiente(){
    const p = cola.shift();
    if (!p){ accion = {nombre: "baila", t: 0}; pose = "reposo"; felices = false; return; }
    accion = {nombre: p.nombre, t: 0, dur: p.dur};
    pose = p.pose || "reposo"; felices = !!p.felices;
    const texto = typeof p.decir === "function" ? p.decir() : p.decir;
    if (texto) decir(texto, p.ms);
    p.alEmpezar?.();
  }
  function saltar(){
    if (accion.nombre === "salta") return;
    velY = 5.2; alturaY = Math.max(alturaY, .001);
    const f = frases.length ? frases[fraseI++ % frases.length] : "";
    secuencia([{nombre: "salta", dur: 1.1, pose: "brazos", felices: true, decir: f, ms: 3000},
               {nombre: "pulgar", dur: 1.4, pose: "pulgar", felices: true, alEmpezar: ()=>{ vidaEstrella = 1; }}]);
  }
  function empezarBienvenida(){
    if (accion.nombre !== "espera") return;
    velY = 0; alturaY = 6;
    secuencia([
      {nombre: "cae", dur: 1.25},
      {nombre: "mira", dur: .9},
      {nombre: "saluda", dur: 2.2, pose: "saludo", felices: true, decir: "¡Hola! Bienvenidos a Electronic Games", ms: 2600},
      {nombre: "pulgar", dur: 2.4, pose: "pulgar", felices: true, decir: ()=>frases[0] || "¡Arma tu pedido y envíalo por WhatsApp!", ms: 2800,
        alEmpezar: ()=>{ vidaEstrella = 1; }},
    ]);
    fraseI = 1;
  }

  const suave = (a, b, k) => a + (b - a) * k;
  const tmp = new Vector3();
  function actualizar(dt){
    reloj += dt;
    accion.t += dt;
    if (accion.dur && accion.t >= accion.dur) siguiente();
    const pulso = reducir ? 0 : Math.sin(reloj * Math.PI * 2 * 1.7);   // ~100 golpes por minuto
    const baila = accion.nombre === "baila" && !reducir;

    // Caída y saltos: gravedad con rebote aplastado al tocar el piso.
    if (accion.nombre !== "espera" && (accion.nombre === "cae" || alturaY > 0 || velY > 0)){
      velY -= 22 * dt; alturaY += velY * dt;
      if (alturaY <= 0){
        if (velY < -3){ velAplaste = velY * .12; if (accion.nombre === "cae"){ onda.userData.t = 0; lanzarChispas(); } }
        alturaY = 0; velY = 0;
      }
    }
    // Resorte del aplastón (sube y baja hasta quedar quieto)
    velAplaste += (-aplaste * 180 - velAplaste * 11) * dt; aplaste += velAplaste * dt;
    const baile = baila ? Math.abs(pulso) * .035 : 0;
    m.raiz.position.y = alturaY + baile;
    m.raiz.scale.set(1 - aplaste * .6, 1 + aplaste, 1 - aplaste * .6);
    giro = accion.nombre === "salta" ? Math.min(1, accion.t / .8) * Math.PI * 2 : 0;
    m.raiz.rotation.y = giro;

    // Brazos hacia su pose (más la ola del saludo y el vaivén del baile)
    const k = 1 - Math.exp(-dt * 9), objetivo = POSES[pose];
    for (const lado of ["izq", "der"]) for (let i = 0; i < 4; i++) actual[lado][i] = suave(actual[lado][i], objetivo[lado][i], k);
    // Las poses están escritas para saludar con el brazo izquierdo de la pantalla; si la página pide el
    // derecho (en celular, el de afuera, para que el globo no tape la mano), se usan en espejo.
    const espejo = ([z, x, c, h]) => [-z, x, -c, -h];
    m.brazos.forEach((b, j)=>{
      const esGesto = j === gesto;
      const p = esGesto ? actual.izq : actual.der;
      const [hz, hx, cz, mz] = (j === 1) === esGesto ? espejo(p) : p;
      let ola = 0, vaiven = 0;
      if (esGesto && accion.nombre === "saluda") ola = Math.sin(accion.t * 11) * .45;
      if (baila) vaiven = pulso * (esGesto ? .08 : .04);
      b.hombro.rotation.set(hx, 0, hz + vaiven);
      b.codo.rotation.set(0, 0, cz + ola);
      b.mano.rotation.set(0, 0, mz + ola * .4);
      b.pulgar.rotation.set(0, 0, b.lado * (pose === "pulgar" && esGesto ? 0 : .9));
    });

    // Cuerpo y cabeza: baile, mirar alrededor y seguir al mouse.
    pxS += (px - pxS) * (1 - Math.exp(-dt * 5)); pyS += (py - pyS) * (1 - Math.exp(-dt * 5));
    let ry = pxS * .55, rx = pyS * .25, rz = 0;
    if (accion.nombre === "mira") ry += Math.sin(accion.t / .9 * Math.PI * 2) * .55;
    if (baila){ rx += pulso * .07; rz = Math.sin(reloj * Math.PI * 1.7) * .08; }
    const s = gesto ? -1 : 1;
    if (accion.nombre === "saluda") rz = .12 * s;
    if (accion.nombre === "pulgar") rz = -.08 * s;
    cabezaRy = suave(cabezaRy, ry, 1 - Math.exp(-dt * 8));
    m.cabeza.rotation.set(rx, cabezaRy, rz);
    m.cuerpo.rotation.z = baila ? Math.sin(reloj * Math.PI * 1.7) * .035 : 0;
    m.cuerpo.rotation.y = pxS * .15;

    // Ojos: parpadeo cada tanto; felices (^ ^) cuando saluda.
    proxParpadeo -= dt;
    if (proxParpadeo <= 0){ parpadeo = .16; proxParpadeo = 2.2 + Math.random() * 3.5; }
    parpadeo = Math.max(0, parpadeo - dt);
    const cierre = parpadeo > 0 ? Math.sin((1 - parpadeo / .16) * Math.PI) : 0;
    for (const o of m.ojos){
      o.abierto.visible = !felices; o.feliz.visible = felices;
      o.ojo.scale.y = felices ? 1 : Math.max(.08, 1 - cierre);
      o.ojo.position.x = o.x0 + pxS * .03;
    }

    // Luz de los audífonos y del piso con la música
    m.matAro.opacity = .45 + .5 * Math.abs(pulso) * (baila ? 1 : .3);
    luz = Math.min(1, luz + dt * 1.5);
    aro.material.opacity = luz * (.22 + (baila ? Math.abs(pulso) * .16 : 0));
    luzPiso.material.opacity = luz * .8;
    const lejos = Math.min(1, alturaY / 3);
    sombra.material.opacity = 1 - lejos * .8;
    sombra.scale.setScalar(1 - lejos * .45);

    // Onda al caer
    if (onda.userData.t !== undefined){
      onda.userData.t += dt;
      const t = onda.userData.t / .7;
      onda.scale.setScalar(1 + t * 1.6); onda.material.opacity = Math.max(0, .9 * (1 - t));
      if (t >= 1) delete onda.userData.t;
    }
    // Chispas
    if (vidaCh > 0){
      vidaCh = Math.max(0, vidaCh - dt * 1.1);
      for (let i = 0; i < N_CH; i++){
        velCh[i * 3 + 1] -= 9 * dt;
        posCh[i * 3] += velCh[i * 3] * dt; posCh[i * 3 + 1] = Math.max(0, posCh[i * 3 + 1] + velCh[i * 3 + 1] * dt); posCh[i * 3 + 2] += velCh[i * 3 + 2] * dt;
      }
      geoCh.attributes.position.needsUpdate = true;
      chispas.material.opacity = vidaCh;
    }
    // Notas musicales mientras baila
    if (baila){
      proxNota -= dt;
      if (proxNota <= 0){
        const n = notas.find(x=>x.vida <= 0);
        if (n){ n.vida = 1; n.vx = n.lado * (.25 + Math.random() * .25); m.parlantes[n.lado < 0 ? 0 : 1].getWorldPosition(n.s.position); }
        proxNota = .9 + Math.random() * .8;
      }
    }
    for (const n of notas){
      if (n.vida <= 0){ n.s.material.opacity = 0; continue; }
      n.vida -= dt * .55;
      n.s.position.x += n.vx * dt; n.s.position.y += .75 * dt;
      n.s.material.opacity = Math.min(1, n.vida * 2.2) * Math.min(1, (1 - n.vida) * 6);
      n.s.material.rotation = Math.sin(reloj * 3 + n.lado) * .3;
    }
    // Destello en el pulgar
    if (vidaEstrella > 0){
      vidaEstrella = Math.max(0, vidaEstrella - dt * 1.2);
      m.brazos[gesto].mano.getWorldPosition(estrella.position);
      estrella.position.add(tmp.set(gesto ? .12 : -.12, .32, .25));
      const t = 1 - vidaEstrella;
      estrella.scale.setScalar(.2 + Math.sin(Math.min(1, t * 1.6) * Math.PI) * .55);
      estrella.material.opacity = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      estrella.material.rotation = t * 2;
    }
    avisarCabeza();
  }

  // Posición de la cabeza en el lienzo (para el globo de diálogo), solo si se movió.
  const cab = new Vector3(), antes = {x: -1, y: -1};
  function avisarCabeza(){
    m.cabeza.getWorldPosition(cab); cab.y += .66;
    cab.project(camara);
    const x = Math.round((cab.x + 1) / 2 * ancho), y = Math.round((1 - cab.y) / 2 * alto);
    if (Math.abs(x - antes.x) + Math.abs(y - antes.y) < 2) return;
    antes.x = x; antes.y = y;
    contenedor.style.setProperty("--cx", x + "px");
    contenedor.style.setProperty("--cy", y + "px");
  }

  // ---------- Bucle: solo mientras se ve ----------
  let lentos = 0, cuenta = 0;
  function vigilar(ms){
    cuenta++; if (ms > 26) lentos++;
    if (cuenta < 90) return;
    if (lentos > 30 && pr > 1){ pr = Math.max(1, pr - .25); renderer.setPixelRatio(pr); medir(); }
    cuenta = lentos = 0;
  }
  let visible = false, corriendo = false, pausado = false, t0 = performance.now();
  function cuadro(ahora){
    if (!corriendo) return;
    requestAnimationFrame(cuadro);
    vigilar(ahora - t0);
    const dt = Math.min(.05, Math.max(0, (ahora - t0) / 1000)); t0 = ahora;
    actualizar(dt);
    renderer.render(escena, camara);
  }
  const revisar = () => {
    const debe = listo && visible && !pausado && document.visibilityState === "visible";
    if (debe && !corriendo){ corriendo = true; t0 = performance.now(); requestAnimationFrame(cuadro); }
    else if (!debe) corriendo = false;
  };
  new IntersectionObserver(([e])=>{ visible = e.isIntersecting; revisar(); }).observe(contenedor);
  document.addEventListener("visibilitychange", revisar);
  actualizar(0);
  const empezar = () => { listo = true; renderer.render(escena, camara); contenedor.classList.add("listo"); revisar(); };
  (renderer.compileAsync ? renderer.compileAsync(escena, camara) : Promise.resolve()).then(empezar, empezar);

  return {
    // La portada avisa cuándo ya se ve (después de la intro de la marca) para que caiga en ese momento.
    empezar(){ if (accion.nombre === "espera") empezarBienvenida(); },
    saludar(texto){ if (accion.nombre === "baila") secuencia([{nombre: "saluda", dur: 2, pose: "saludo", felices: true, decir: texto}]); },
    // Con una ventana abierta encima (ficha, pedido, visor) no se dibuja: esa ventana va más fluida.
    pausar(v){ pausado = !!v; revisar(); },
  };
}
