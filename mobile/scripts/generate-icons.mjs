/* Génère l'identité visuelle de Tune (icône, adaptive Android, splash, favicon)
   sans aucune dépendance : dessin par pixel + encodeur PNG maison (zlib Node).
   Design retenu par Andy : la waveform (barres d'onde sonore violettes).
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

/* ---------- outils ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = t => Math.max(0, Math.min(1, t));

const BG_TOP = [16, 10, 28];
const BG_BOT = [8, 8, 13];
const VIOLET_HI = [214, 116, 255];
const VIOLET_LO = [124, 77, 255];

/** rounded-rect : le point est-il dans le rectangle arrondi ? */
function inRoundedRect(nx, ny, cx, cy, w, h, r) {
  const qx = Math.abs(nx - cx) - (w / 2 - r);
  const qy = Math.abs(ny - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return ax * ax + ay * ay <= r * r;
}

/* ---------- la waveform ---------- */
const BARS = [
  { x: -0.72, h: 0.38 }, { x: -0.48, h: 0.72 }, { x: -0.24, h: 0.5 },
  { x: 0, h: 1.3 }, { x: 0.24, h: 0.92 }, { x: 0.48, h: 0.58 }, { x: 0.72, h: 0.42 },
];

/** Couleur de la barre touchée en (nx, ny), ou null. mono = tout blanc. */
function barColor(nx, ny, mono) {
  for (let i = 0; i < BARS.length; i++) {
    const b = BARS[i];
    if (inRoundedRect(nx, ny, b.x, 0, 0.15, b.h, 0.075)) {
      if (mono) return [255, 255, 255];
      const central = 1 - Math.abs(i - 3) / 4;
      const c = mix(VIOLET_HI, VIOLET_LO, clamp01((b.h / 2 - ny) / b.h));
      return mix(c, [240, 220, 255], central * 0.25);
    }
  }
  return null;
}

/* ---------- rendu ---------- */
const SS = 3; // super-échantillonnage anti-aliasing

/**
 * mode: "full"  → fond dégradé + halo + waveform (icône complète)
 *       "glyph" → waveform seule sur fond transparent (splash / foreground)
 *       "mono"  → waveform blanche sur transparent (Android monochrome)
 *       "bg"    → fond seul (Android adaptive background)
 * scale: taille de la waveform relative à l'image
 */
function render(size, mode, scale = 1) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const ny = 1 - ((py + (sy + 0.5) / SS) / size) * 2;

          let cr = 0, cg = 0, cb = 0, ca = 0;
          if (mode === "full" || mode === "bg") {
            let base = mix(BG_TOP, BG_BOT, (1 - ny) / 2);
            const d = Math.sqrt(nx * nx + ny * ny);
            const glow = Math.max(0, 1 - d / 1.0);
            base = mix(base, [96, 60, 160], glow * glow * 0.35);
            [cr, cg, cb] = base;
            ca = 255;
          }
          if (mode !== "bg") {
            const c = barColor(nx / scale, ny / scale, mode === "mono");
            if (c) {
              [cr, cg, cb] = c;
              ca = 255;
            }
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

writePng(join(OUT, "icon.png"), render(1024, "full", 0.78), 1024, 1024);
writePng(join(OUT, "android-icon-foreground.png"), render(1024, "glyph", 0.52), 1024, 1024);
writePng(join(OUT, "android-icon-monochrome.png"), render(1024, "mono", 0.52), 1024, 1024);
writePng(join(OUT, "android-icon-background.png"), render(1024, "bg"), 1024, 1024);
writePng(join(OUT, "splash-icon.png"), render(512, "glyph", 0.95), 512, 512);
writePng(join(OUT, "favicon.png"), render(64, "full", 0.85), 64, 64);
console.log("\nIdentité visuelle Tune (waveform) générée dans assets/images/");
