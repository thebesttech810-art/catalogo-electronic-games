// Dibuja las poses del muñequito (docs/mascota/poses/*.webp) con el mismo modelo 3D de la portada.
// Se corre desde la carpeta del repositorio:  node herramientas/poses-mascota.mjs [pose ...]
// Necesita Playwright (npm i -D playwright) y Python con Pillow para recortar y guardar en WebP.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const TODAS = ["pulgar", "saludo", "baila", "triste", "presenta", "funda", "tarjeta", "celular", "retira", "llave", "lupa", "piensa"];
const poses = process.argv.slice(2).length ? process.argv.slice(2) : TODAS;
const RAIZ = process.cwd(), SALIDA = path.join(RAIZ, "docs/mascota/poses"), TMP = path.join(RAIZ, ".poses-tmp");
await mkdir(SALIDA, {recursive: true}); await mkdir(TMP, {recursive: true});
const TIPOS = {".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2"};

const nav = await chromium.launch({args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]});
const pagina = await nav.newPage({viewport: {width: 900, height: 1100}});
// Los archivos se sirven directo del repositorio; la letra Rubik, de Google Fonts si hay internet.
await pagina.route("http://poses.local/**", async r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  try { await r.fulfill({body: await readFile(path.join(RAIZ, p)), contentType: TIPOS[path.extname(p)] || "application/octet-stream"}); }
  catch { await r.fulfill({status: 404, body: ""}); }
});
// Sin internet: RUBIK_WOFF2=/ruta/rubik-italic.woff2 usa esa letra en vez de la de Google Fonts.
if (process.env.RUBIK_WOFF2) await pagina.route(/fonts\.googleapis\.com/, r => r.fulfill({contentType: "text/css",
  body: `@font-face{font-family:Rubik;font-style:italic;font-weight:300 900;src:url(http://poses.local/rubik.woff2) format('woff2')}`}));
if (process.env.RUBIK_WOFF2) await pagina.route("http://poses.local/rubik.woff2", async r => r.fulfill({body: await readFile(process.env.RUBIK_WOFF2), contentType: "font/woff2"}));
for (const pose of poses){
  await pagina.goto(`http://poses.local/herramientas/poses-mascota.html?pose=${pose}&w=900&h=1100`);
  await pagina.waitForFunction(() => document.title === "listo", null, {timeout: 120000});
  const png = path.join(TMP, pose + ".png");
  await writeFile(png, Buffer.from((await pagina.evaluate(() => document.getElementById("c").toDataURL("image/png"))).split(",")[1], "base64"));
  // Recorta el aire transparente y guarda en WebP de 560 px de alto.
  execFileSync("python3", ["-c", `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert("RGBA")
im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())
alto = 560; im = im.resize((round(im.width * alto / im.height), alto), Image.LANCZOS)
im.save(${JSON.stringify(path.join(SALIDA, pose + ".webp"))}, "WEBP", quality=86, method=6)
print(${JSON.stringify(pose)}, im.size)`], {stdio: "inherit"});
}
await nav.close();
