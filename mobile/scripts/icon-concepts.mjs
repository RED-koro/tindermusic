/* Génère 4 concepts d'icône pour Tune + une planche comparative 2×2.
   Usage : node scripts/icon-concepts.mjs <dossier-sortie> */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || ".";
mkdirSync(OUT, { recursive: true });

/* ---------- encodeur PNG minimal (repris de generate-icons.mjs) ---------- */
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
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log("✓", path);
}

/* ---------- outils ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = t => Math.max(0, Math.min(1, t));

const BG_TOP = [16, 10, 28];
const BG_BOT = [8, 8, 13];
const VIOLET_HI = [214, 116, 255];
const VIOLET_LO = [124, 77, 255];

const bg = (nx, ny, glowR = 0.9, glowAmp = 0.3) => {
  let c = mix(BG_TOP, BG_BOT, (1 - ny) / 2);
  const d = Math.sqrt(nx * nx + ny * ny);
  const glow = Math.max(0, 1 - d / glowR);
  return mix(c, [96, 60, 160], glow * glow * glowAmp);
};

/** rounded-rect SDF avec rotation : le point est-il dans le rectangle ? */
function inRoundedRect(nx, ny, cx, cy, w, h, r, angleDeg) {
  const a = (-angleDeg * Math.PI) / 180;
  const dx0 = nx - cx, dy0 = ny - cy;
  const x = dx0 * Math.cos(a) - dy0 * Math.sin(a);
  const y = dx0 * Math.sin(a) + dy0 * Math.cos(a);
  const qx = Math.abs(x) - (w / 2 - r);
  const qy = Math.abs(y) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return ax * ax + ay * ay <= r * r;
}

/* ---------- concepts (chaque shader rend un pixel opaque) ---------- */

// A — Vinyle : disque plein cadre, sillons, étiquette violette, reflet
function vinyl(nx, ny) {
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 0.92) return bg(nx, ny, 1.1, 0.25);
  // disque
  let c = mix([26, 22, 36], [14, 12, 20], clamp01(r / 0.92));
  // sillons fins
  if (r > 0.34 && r < 0.88) {
    const groove = (r * 95) % 1;
    if (groove < 0.35) c = mix(c, [58, 50, 82], 0.5);
    // respirations plus larges (comme les pistes d'un disque)
    const band = (r * 7) % 1;
    if (band < 0.08) c = mix(c, [10, 9, 15], 0.6);
  }
  // reflet diagonal
  const theta = Math.atan2(ny, nx);
  for (const t0 of [2.2, -0.94]) {
    const dTheta = Math.abs(theta - t0);
    if (dTheta < 0.32 && r > 0.3 && r < 0.9) {
      c = mix(c, [120, 100, 170], (1 - dTheta / 0.32) * 0.35);
    }
  }
  // étiquette violette
  if (r < 0.33) {
    c = mix(VIOLET_HI, VIOLET_LO, clamp01((0.33 - ny * 0.5) / 0.66));
    if (r > 0.31) c = mix(c, [20, 16, 30], 0.65); // liseré
    // petit triangle play blanc sur l'étiquette
    const px = nx / 0.30, py = ny / 0.30;
    const L = -0.34, R = 0.42, H = 0.42;
    if (px >= L && px <= R && Math.abs(py) <= H * (1 - (px - L) / (R - L))) c = [255, 255, 255];
  }
  if (r < 0.045) c = bg(nx, ny); // trou central
  return c;
}

// B — Monogramme "T" géométrique, dégradé violet, ombre douce
function letterT(nx, ny) {
  const inT = (x, y) =>
    inRoundedRect(x, y, 0, 0.44, 1.04, 0.32, 0.1, 0) ||
    inRoundedRect(x, y, 0, -0.16, 0.32, 0.92, 0.1, 0);
  // ombre décalée
  if (!inT(nx, ny) && inT(nx - 0.055, ny + 0.055)) {
    const base = bg(nx, ny, 0.95, 0.3);
    return mix(base, [0, 0, 0], 0.45);
  }
  if (inT(nx, ny)) {
    let c = mix(VIOLET_HI, VIOLET_LO, clamp01((0.9 - ny) / 1.8));
    return c;
  }
  return bg(nx, ny, 0.95, 0.3);
}

// C — Waveform : 7 barres arrondies, hauteurs organiques
function waveform(nx, ny) {
  const bars = [
    { x: -0.72, h: 0.38 }, { x: -0.48, h: 0.72 }, { x: -0.24, h: 0.5 },
    { x: 0, h: 1.3 }, { x: 0.24, h: 0.92 }, { x: 0.48, h: 0.58 }, { x: 0.72, h: 0.42 },
  ];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (inRoundedRect(nx, ny, b.x, 0, 0.15, b.h, 0.075, 0)) {
      const central = 1 - Math.abs(i - 3) / 4;
      let c = mix(VIOLET_HI, VIOLET_LO, clamp01((b.h / 2 - ny) / b.h));
      return mix(c, [240, 220, 255], central * 0.25);
    }
  }
  return bg(nx, ny, 1.0, 0.35);
}

// D — Deux cartes empilées (le geste du swipe) + play
function cards(nx, ny) {
  const topCard = inRoundedRect(nx, ny, 0.05, 0.0, 0.92, 1.18, 0.13, 6);
  const underCard = inRoundedRect(nx, ny, -0.09, -0.04, 0.92, 1.18, 0.13, -8);
  if (topCard) {
    let c = mix(VIOLET_HI, VIOLET_LO, clamp01((0.75 - ny) / 1.5));
    // triangle play blanc (dans le repère de la carte, à peu près centré)
    const a = (-6 * Math.PI) / 180;
    const x = (nx - 0.05) * Math.cos(a) - ny * Math.sin(a);
    const y = (nx - 0.05) * Math.sin(a) + ny * Math.cos(a);
    const L = -0.13, R = 0.17, H = 0.17;
    if (x >= L && x <= R && Math.abs(y) <= H * (1 - (x - L) / (R - L))) c = [255, 255, 255];
    return c;
  }
  if (underCard) return mix([44, 36, 64], [30, 25, 45], (1 - ny) / 2);
  return bg(nx, ny, 1.0, 0.3);
}

/* ---------- rendu ---------- */
const SS = 3;
function render(size, shader) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const ny = 1 - ((py + (sy + 0.5) / SS) / size) * 2;
          const c = shader(nx, ny);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      buf[i] = r / n; buf[i + 1] = g / n; buf[i + 2] = b / n; buf[i + 3] = 255;
    }
  }
  return buf;
}

const CELL = 480, GAP = 14;
const GRID = CELL * 2 + GAP * 3;
const grid = Buffer.alloc(GRID * GRID * 4);
grid.fill(0);
for (let i = 3; i < grid.length; i += 4) grid[i] = 255;

const concepts = [
  ["A-vinyle", vinyl], ["B-lettre-t", letterT],
  ["C-waveform", waveform], ["D-cartes", cards],
];
concepts.forEach(([name, shader], idx) => {
  const img = render(CELL, shader);
  const ox = GAP + (idx % 2) * (CELL + GAP);
  const oy = GAP + Math.floor(idx / 2) * (CELL + GAP);
  for (let y = 0; y < CELL; y++) {
    img.copy(grid, ((oy + y) * GRID + ox) * 4, y * CELL * 4, (y + 1) * CELL * 4);
  }
  console.log("rendu :", name);
});

writePng(join(OUT, "concepts-icone.png"), grid, GRID, GRID);
