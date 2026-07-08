/* Génère les extraits 30s du catalogue en WAV (port du moteur Web Audio du prototype).
   Usage : node scripts/generate-previews.mjs  (depuis mobile/)
   Puis conversion en m4a via afconvert (voir scripts/build-previews.sh). */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "previews");
mkdirSync(OUT, { recursive: true });

const SR = 22050;
const DUR = 30;

const TRACKS = [
  { id: "lune-rouge",    root: 57, mode: "minor",  bpm: 96,  wave: "sawtooth", pad: true },
  { id: "avant-laube",   root: 62, mode: "major",  bpm: 82,  wave: "triangle", pad: true },
  { id: "oceans",        root: 50, mode: "dorian", bpm: 70,  wave: "sine",     pad: true },
  { id: "echoes",        root: 52, mode: "minor",  bpm: 118, wave: "square",   pad: false },
  { id: "falling",       root: 59, mode: "major",  bpm: 88,  wave: "triangle", pad: false },
  { id: "dans-le-noir",  root: 55, mode: "dorian", bpm: 92,  wave: "sine",     pad: true },
  { id: "neon",          root: 45, mode: "minor",  bpm: 110, wave: "sawtooth", pad: true },
  { id: "maree-haute",   root: 60, mode: "major",  bpm: 100, wave: "triangle", pad: false },
  { id: "gravity",       root: 57, mode: "major",  bpm: 116, wave: "sawtooth", pad: true },
  { id: "sous-la-pluie", root: 53, mode: "dorian", bpm: 74,  wave: "sine",     pad: true },
  { id: "zenith",        root: 43, mode: "minor",  bpm: 128, wave: "square",   pad: false },
  { id: "ligne-claire",  root: 55, mode: "major",  bpm: 122, wave: "square",   pad: false },
  { id: "boreal",        root: 48, mode: "major",  bpm: 64,  wave: "sine",     pad: true },
  { id: "fievre",        root: 61, mode: "major",  bpm: 108, wave: "triangle", pad: true },
];

const MODES = {
  major:  [0, 2, 4, 5, 7, 9, 11],
  minor:  [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const OSC = {
  sine: p => Math.sin(2 * Math.PI * p),
  square: p => (p % 1 < 0.5 ? 0.6 : -0.6),
  sawtooth: p => 2 * (p % 1) - 1,
  triangle: p => 2 * Math.abs(2 * (p % 1) - 1) - 1,
};

function addNote(buf, startSec, dur, freq, gain, wave, detuneCents = 0) {
  const f = freq * Math.pow(2, detuneCents / 1200);
  const osc = OSC[wave];
  const i0 = Math.floor(startSec * SR);
  const nSamp = Math.min(Math.floor((dur + 0.05) * SR), buf.length - i0);
  const attack = 0.02;
  const k = Math.log(gain / 0.001) / dur;
  for (let i = 0; i < nSamp; i++) {
    const t = i / SR;
    const env = t < attack ? gain * (t / attack) : gain * Math.exp(-k * (t - attack));
    buf[i0 + i] += osc(f * t) * env;
  }
}

function addNoiseHit(buf, startSec, gain) {
  const i0 = Math.floor(startSec * SR);
  const n = Math.min(Math.floor(0.036 * SR), buf.length - i0);
  for (let i = 0; i < n; i++) {
    buf[i0 + i] += (Math.random() * 2 - 1) * gain * (1 - i / n);
  }
}

function synthesize(track) {
  const buf = new Float32Array(SR * DUR);
  const scale = MODES[track.mode];
  const seed = hashCode(track.id);
  const stepDur = 60 / track.bpm / 2;
  const progressions = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 4, 5, 3], [5, 3, 0, 4]];
  const prog = progressions[seed % progressions.length];
  const arpPattern = [0, 2, 4, 2, 0, 4, 2, 4];

  // nappe pour les genres planants
  if (track.pad) {
    for (const iv of [0, scale[2], scale[4]]) {
      addNote(buf, 0, DUR - 0.1, midiToHz(track.root + iv), 0.045, "sine", (seed % 12) - 6);
    }
  }

  let t = 0.05;
  let step = 0;
  while (t < DUR - 0.3) {
    const bar = Math.floor(step / 8) % 4;
    const degree = prog[bar];
    const chordRoot = track.root + scale[degree % 7] + (degree > 4 ? -12 : 0);

    if (step % 4 === 0) {
      addNote(buf, t, stepDur * 3, midiToHz(chordRoot - 12), 0.22, track.wave === "sine" ? "sine" : "triangle");
    }
    const iv = scale[(arpPattern[step % 8] + degree) % 7] + (step % 8 > 5 ? 12 : 0);
    addNote(buf, t, stepDur * 1.4, midiToHz(track.root + iv), 0.09, track.wave, ((seed + step) % 9) - 4);

    if (track.bpm > 100 && step % 2 === 1) addNoiseHit(buf, t, 0.05);

    t += stepDur;
    step++;
  }

  // filtre passe-bas 1 pôle + master + fondu d'entrée/sortie
  const fc = track.wave === "sine" ? 2200 : 3200;
  const alpha = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += alpha * (buf[i] - y);
    const tt = i / SR;
    const fadeIn = Math.min(1, tt / 0.5);
    const fadeOut = Math.min(1, (DUR - tt) / 0.5);
    buf[i] = Math.max(-1, Math.min(1, y * 0.55 * fadeIn * fadeOut));
  }
  return buf;
}

function writeWav(path, buf) {
  const n = buf.length;
  const out = Buffer.alloc(44 + n * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + n * 2, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(buf[i] * 32767), 44 + i * 2);
  writeFileSync(path, out);
}

for (const track of TRACKS) {
  writeWav(join(OUT, `${track.id}.wav`), synthesize(track));
  console.log(`✓ ${track.id}.wav`);
}
console.log(`\nWAV générés dans ${OUT}`);
