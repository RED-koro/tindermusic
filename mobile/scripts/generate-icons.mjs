/* Génère l'identité visuelle de Tune (icône, adaptive Android, splash, favicon)
   sans aucune dépendance : dessin par pixel + encodeur PNG maison (zlib Node).
   Usage : node scripts/generate-icons.mjs */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");
mkdirSync(OUT, { recursive: true });

/* ---------- encodeur PNG minimal (RGBA 8 bits) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function writePng(path, rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtre "None"
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log("✓", path.split("/assets/")[1], `(${w}×${h}, ${(png.length / 1024).toFixed(0)} Ko)`);
}

/* ---------- formes ---------- */
// cœur implicite classique : (x² + y² − 1)³ − x²·y³ ≤ 0  (y vers le haut)
const inHeart = (x, y) => {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
};
// triangle play (pointe à droite), coordonnées normalisées du glyphe
const inPlay = (x, y) => {
  const L = -0.22, R = 0.3, H = 0.30;
  if (x < L || x > R) return false;
  const half = H * (1 - (x - L) / (R - L));
  return Math.abs(y) <= half;
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/* ---------- rendu ---------- */
const BG_TOP = [16, 10, 28];      // violet très sombre
const BG_BOT = [8, 8, 13];        // C.bg
const HEART_TOP = [214, 116, 255]; // violet clair
const HEART_BOT = [124, 77, 255];  // violet profond
const SS = 3; // super-échantillonnage anti-aliasing

/**
 * Rend une image carrée.
 * mode: "full"  → fond + halo + anneaux + cœur + play (icône complète)
 *       "glyph" → cœur + play sur fond transparent (splash / foreground)
 *       "mono"  → glyphe blanc sur transparent (Android monochrome)
 * scale: taille du cœur relative à l'image
 */
function render(size, mode, scale) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // coordonnées normalisées [-1,1], y vers le haut, cœur centré
          const nx = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const ny = 1 - ((py + (sy + 0.5) / SS) / size) * 2;
          // espace du cœur (le cœur implicite tient dans ~[-1.15,1.15])
          const hx = (nx / scale) * 1.25;
          const hy = ((ny + 0.06 * scale) / scale) * 1.25 + 0.1;

          let cr, cg, cb, ca;
          const heart = inHeart(hx, hy);
          const play = heart && inPlay(hx, hy - 0.05);

          if (mode === "full") {
            // fond dégradé vertical + halo radial derrière le cœur
            const t = (1 - ny) / 2;
            let base = mix(BG_TOP, BG_BOT, t);
            const d = Math.sqrt(nx * nx + ny * ny);
            const glow = Math.max(0, 1 - d / 0.95);
            base = mix(base, [96, 60, 160], glow * glow * 0.35);
            // anneaux "ondes sonores"
            for (const ring of [0.78, 0.9]) {
              if (Math.abs(d - ring) < 0.008) base = mix(base, [190, 130, 255], 0.35);
            }
            [cr, cg, cb] = base;
            ca = 255;
          } else {
            cr = cg = cb = 0;
            ca = 0;
          }

          if (heart) {
            if (mode === "mono") {
              cr = cg = cb = 255;
            } else {
              // dégradé vertical dans le cœur + liseré clair en haut
              const ht = Math.min(1, Math.max(0, (1.15 - hy) / 2.1));
              [cr, cg, cb] = mix(HEART_TOP, HEART_BOT, ht);
            }
            ca = 255;
          }
          if (play) {
            if (mode === "mono") { cr = cg = cb = 0; ca = 0; }
            else { cr = cg = cb = 255; ca = 255; }
          }

          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      buf[i] = r / n; buf[i + 1] = g / n; buf[i + 2] = b / n; buf[i + 3] = a / n;
    }
  }
  return buf;
}

writePng(join(OUT, "icon.png"), render(1024, "full", 0.62), 1024, 1024);
writePng(join(OUT, "android-icon-foreground.png"), render(1024, "glyph", 0.40), 1024, 1024);
writePng(join(OUT, "android-icon-monochrome.png"), render(1024, "mono", 0.40), 1024, 1024);
// fond adaptive : dégradé seul (glyphe à l'échelle 0 → jamais dessiné)
writePng(join(OUT, "android-icon-background.png"), render(1024, "full", 0.0001), 1024, 1024);
writePng(join(OUT, "splash-icon.png"), render(512, "glyph", 0.85), 512, 512);
writePng(join(OUT, "favicon.png"), render(64, "full", 0.62), 64, 64);
console.log("\nIdentité visuelle Tune générée dans assets/images/");
