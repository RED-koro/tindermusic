/* ================================================================
   Tune — Tinder de la musique (V1)
   - Deck de cartes swipables avec extrait audio génératif (Web Audio)
   - Bibliothèque persistée en localStorage (Aimés / À revoir / Pas pour moi)
   - Algo v1 : score par genre ajusté à chaque swipe, réordonne le deck
   ================================================================ */

"use strict";

/* ---------------- Catalogue (V1 : données locales) ---------------- */
/* audio: root = note MIDI de base, mode = gamme, bpm, wave = timbre */
const TRACKS = [
  { id: "lune-rouge",   title: "Lune Rouge",     artist: "SOLARIS",      genres: ["Indie", "Électro", "Français"],      scene: "sun",    hue: 340, hue2: 265, audio: { root: 57, mode: "minor",  bpm: 96,  wave: "sawtooth", pad: true  } },
  { id: "avant-laube",  title: "Avant l'aube",   artist: "Mielka",       genres: ["Dream Pop", "Français"],             scene: "bloom",  hue: 24,  hue2: 350, audio: { root: 62, mode: "major",  bpm: 82,  wave: "triangle", pad: true  } },
  { id: "oceans",       title: "Oceans",         artist: "Naylors",      genres: ["Ambient", "Électronique"],           scene: "waves",  hue: 195, hue2: 230, audio: { root: 50, mode: "dorian", bpm: 70,  wave: "sine",     pad: true  } },
  { id: "echoes",       title: "Echoes",         artist: "The Kairo",    genres: ["Alternative", "Rock"],               scene: "moon",   hue: 220, hue2: 200, audio: { root: 52, mode: "minor",  bpm: 118, wave: "square",   pad: false } },
  { id: "falling",      title: "Falling Slowly", artist: "Vesper",       genres: ["Indie", "Folk"],                     scene: "sun",    hue: 30,  hue2: 200, audio: { root: 59, mode: "major",  bpm: 88,  wave: "triangle", pad: false } },
  { id: "dans-le-noir", title: "Dans le noir",   artist: "Lys",          genres: ["R&B", "Français"],                   scene: "portrait", hue: 350, hue2: 235, audio: { root: 55, mode: "dorian", bpm: 92, wave: "sine",   pad: true  } },
  { id: "neon",         title: "Néon",           artist: "Karma Club",   genres: ["Synthwave", "Électro"],              scene: "grid",   hue: 285, hue2: 320, audio: { root: 45, mode: "minor",  bpm: 110, wave: "sawtooth", pad: true  } },
  { id: "maree-haute",  title: "Marée haute",    artist: "Colline",      genres: ["Chanson", "Indie", "Français"],      scene: "waves",  hue: 160, hue2: 210, audio: { root: 60, mode: "major",  bpm: 100, wave: "triangle", pad: false } },
  { id: "gravity",      title: "Gravity",        artist: "Moth & Flame", genres: ["Electro Pop"],                       scene: "rings",  hue: 260, hue2: 300, audio: { root: 57, mode: "major",  bpm: 116, wave: "sawtooth", pad: true  } },
  { id: "sous-la-pluie",title: "Sous la pluie",  artist: "Amarante",     genres: ["Lo-fi", "Chill", "Français"],        scene: "bloom",  hue: 205, hue2: 260, audio: { root: 53, mode: "dorian", bpm: 74,  wave: "sine",     pad: true  } },
  { id: "zenith",       title: "Zenith",         artist: "ORBE",         genres: ["Techno", "Électronique"],            scene: "rings",  hue: 15,  hue2: 280, audio: { root: 43, mode: "minor",  bpm: 128, wave: "square",   pad: false } },
  { id: "ligne-claire", title: "Ligne claire",   artist: "Palissade",    genres: ["Indie Rock", "Français"],            scene: "moon",   hue: 40,  hue2: 20,  audio: { root: 55, mode: "major",  bpm: 122, wave: "square",   pad: false } },
  { id: "boreal",       title: "Boréal",         artist: "Nordlys",      genres: ["Ambient", "Cinématique"],            scene: "aurora", hue: 150, hue2: 190, audio: { root: 48, mode: "major",  bpm: 64,  wave: "sine",     pad: true  } },
  { id: "fievre",       title: "Fièvre",         artist: "Jade Ruby",    genres: ["Pop", "Français"],                   scene: "portrait", hue: 315, hue2: 355, audio: { root: 61, mode: "major",  bpm: 108, wave: "triangle", pad: true } },
];

const PREVIEW_SECONDS = 30;
const byId = Object.fromEntries(TRACKS.map(t => [t.id, t]));
const SCENES = ["sun", "moon", "waves", "rings", "grid", "aurora", "bloom", "portrait"];

/* ---------------- Titres importés par les artistes (IndexedDB) ---------------- */
/* localStorage est limité à ~5 Mo : les fichiers audio vont dans IndexedDB. */
const DB_NAME = "tune-db";

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tracks", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(rec) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("tracks", "readwrite");
    tx.objectStore("tracks").put(rec);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbAll() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const req = db.transaction("tracks").objectStore("tracks").getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction("tracks", "readwrite");
    tx.objectStore("tracks").delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

/* Transforme un enregistrement IndexedDB en piste du catalogue */
function addCustomToCatalog(rec) {
  const seed = hashCode(rec.id);
  const track = {
    id: rec.id,
    title: rec.title,
    artist: rec.artist,
    genres: rec.genres,
    custom: true,
    description: rec.description || "",
    previewStart: rec.previewStart || 0,
    scene: SCENES[seed % SCENES.length],
    hue: seed % 360,
    hue2: (seed * 7) % 360,
    audioURL: URL.createObjectURL(rec.audioBlob),
    coverURL: rec.coverBlob ? URL.createObjectURL(rec.coverBlob) : null,
  };
  if (!byId[track.id]) TRACKS.push(track);
  else TRACKS[TRACKS.findIndex(t => t.id === track.id)] = track;
  byId[track.id] = track;
  return track;
}

/* ---------------- État persistant ---------------- */
const STORAGE_KEY = "tune-state-v1";

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.liked)) return raw;
  } catch (_) {}
  return { liked: [], later: [], disliked: [], genreScores: {}, swipes: 0 };
}
const state = loadState();
const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function bucketOf(id) {
  if (state.liked.includes(id)) return "liked";
  if (state.later.includes(id)) return "later";
  if (state.disliked.includes(id)) return "disliked";
  return null;
}

function removeEverywhere(id) {
  for (const b of ["liked", "later", "disliked"]) {
    const i = state[b].indexOf(id);
    if (i !== -1) state[b].splice(i, 1);
  }
}

/* L'« algo » v1 : chaque genre a un score, ajusté à chaque décision */
function scoreGenres(track, delta) {
  for (const g of track.genres) {
    state.genreScores[g] = (state.genreScores[g] || 0) + delta;
  }
}
function trackAffinity(track) {
  return track.genres.reduce((s, g) => s + (state.genreScores[g] || 0), 0);
}

/* ---------------- Pochettes générées (SVG) ---------------- */
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function coverSVG(track) {
  const h1 = track.hue, h2 = track.hue2, seed = hashCode(track.id);
  const rnd = (n, m) => ((seed >> (n % 20)) % m);
  const uid = track.id.replace(/[^a-z0-9]/gi, "");
  const W = 400, H = 460;
  let scene = "";

  const stars = Array.from({ length: 26 }, (_, i) => {
    const x = (seed * (i + 3) * 97) % W;
    const y = ((seed >> 3) * (i + 7) * 61) % (H * 0.45);
    const r = 0.6 + ((i * seed) % 10) / 9;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="white" opacity="${(0.25 + (i % 5) / 8).toFixed(2)}"/>`;
  }).join("");

  const mountains = `
    <path d="M0 ${H} L0 ${H - 150} L70 ${H - 210} L130 ${H - 160} L200 ${H - 235} L280 ${H - 150} L340 ${H - 195} L${W} ${H - 140} L${W} ${H} Z"
      fill="hsl(${h2} 45% 12%)" opacity=".95"/>
    <path d="M0 ${H} L0 ${H - 95} L90 ${H - 150} L170 ${H - 100} L260 ${H - 165} L330 ${H - 105} L${W} ${H - 130} L${W} ${H} Z"
      fill="hsl(${h2} 40% 7%)"/>`;

  if (track.scene === "sun" || track.scene === "moon") {
    const big = track.scene === "sun";
    scene = `${stars}
      <circle cx="${W / 2}" cy="${H * 0.42}" r="${big ? 130 : 85}" fill="url(#orb-${uid})"/>
      <ellipse cx="${W / 2}" cy="${H * 0.52}" rx="150" ry="34" fill="hsl(${h1} 80% 60%)" opacity=".18"/>
      ${mountains}`;
  } else if (track.scene === "waves") {
    scene = `${stars}
      <circle cx="${W / 2}" cy="${H * 0.34}" r="70" fill="url(#orb-${uid})" opacity=".9"/>
      ${[0, 1, 2, 3, 4].map(i => `
        <path d="M0 ${H * 0.5 + i * 55} Q ${W * 0.25} ${H * 0.5 + i * 55 - 32}, ${W * 0.5} ${H * 0.5 + i * 55}
                 T ${W} ${H * 0.5 + i * 55} L ${W} ${H} L 0 ${H} Z"
          fill="hsl(${h2} ${55 - i * 6}% ${16 - i * 2.5}%)" opacity="${0.9 - i * 0.08}"/>`).join("")}`;
  } else if (track.scene === "rings") {
    scene = `${stars}
      ${[150, 118, 86, 54].map((r, i) => `
        <circle cx="${W / 2}" cy="${H * 0.46}" r="${r}" fill="none"
          stroke="hsl(${(h1 + i * 25) % 360} 85% ${62 - i * 6}%)" stroke-width="${10 + rnd(i, 8)}" opacity="${0.75 - i * 0.1}"/>`).join("")}
      <circle cx="${W / 2}" cy="${H * 0.46}" r="30" fill="url(#orb-${uid})"/>`;
  } else if (track.scene === "grid") {
    scene = `${stars}
      <circle cx="${W / 2}" cy="${H * 0.38}" r="105" fill="url(#orb-${uid})"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="0" y1="${H * 0.62 + i * i * 7}" x2="${W}" y2="${H * 0.62 + i * i * 7}" stroke="hsl(${h1} 90% 62%)" stroke-width="1.6" opacity="${0.7 - i * 0.08}"/>`).join("")}
      ${[-3, -2, -1, 0, 1, 2, 3].map(i => `<line x1="${W / 2 + i * 34}" y1="${H * 0.62}" x2="${W / 2 + i * 130}" y2="${H}" stroke="hsl(${h1} 90% 62%)" stroke-width="1.6" opacity=".5"/>`).join("")}`;
  } else if (track.scene === "aurora") {
    scene = `${stars}
      ${[0, 1, 2].map(i => `
        <path d="M${-40 + i * 60} ${H * 0.55} C ${W * 0.3} ${H * 0.1 + i * 40}, ${W * 0.6} ${H * 0.55 - i * 60}, ${W + 40} ${H * 0.15 + i * 50}"
          fill="none" stroke="hsl(${(h1 + i * 30) % 360} 85% 60%)" stroke-width="${46 - i * 10}" stroke-linecap="round" opacity="${0.3 - i * 0.06}"/>`).join("")}
      ${mountains}`;
  } else if (track.scene === "bloom") {
    scene = `${[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const a = (i / 8) * Math.PI * 2;
      return `<ellipse cx="${W / 2 + Math.cos(a) * 70}" cy="${H * 0.44 + Math.sin(a) * 70}" rx="72" ry="40"
        fill="hsl(${(h1 + i * 12) % 360} 75% ${45 + (i % 3) * 8}%)" opacity=".45"
        transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${W / 2 + Math.cos(a) * 70} ${H * 0.44 + Math.sin(a) * 70})"/>`;
    }).join("")}
      <circle cx="${W / 2}" cy="${H * 0.44}" r="34" fill="url(#orb-${uid})"/>`;
  } else { /* portrait abstrait */
    scene = `
      <rect x="0" y="0" width="${W / 2}" height="${H}" fill="hsl(${h1} 70% 30%)" opacity=".55"/>
      <circle cx="${W * 0.55}" cy="${H * 0.4}" r="95" fill="hsl(${h2} 30% 8%)"/>
      <circle cx="${W * 0.55}" cy="${H * 0.4}" r="95" fill="url(#orb-${uid})" opacity=".35"/>
      <path d="M${W * 0.3} ${H} Q ${W * 0.55} ${H * 0.55} ${W * 0.8} ${H} Z" fill="hsl(${h2} 25% 6%)"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="hsl(${h2} 45% 14%)"/>
        <stop offset="55%" stop-color="hsl(${(h1 + h2) / 2} 55% 26%)"/>
        <stop offset="100%" stop-color="hsl(${h1} 65% 38%)"/>
      </linearGradient>
      <radialGradient id="orb-${uid}" cx="50%" cy="40%" r="65%">
        <stop offset="0%" stop-color="hsl(${h1} 95% 72%)"/>
        <stop offset="70%" stop-color="hsl(${h1} 85% 55%)"/>
        <stop offset="100%" stop-color="hsl(${(h1 + 20) % 360} 80% 45%)"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky-${uid})"/>
    ${scene}
    <rect width="${W}" height="${H}" fill="black" opacity=".08"/>
  </svg>`;
}

/* Pochette : image importée par l'artiste si dispo, sinon SVG généré */
function coverHTML(track) {
  return track.coverURL ? `<img src="${track.coverURL}" alt="" />` : coverSVG(track);
}

/* ---------------- Moteur audio (extraits génératifs) ---------------- */
const MODES = {
  major:  [0, 2, 4, 5, 7, 9, 11],
  minor:  [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

const AudioEngine = {
  ctx: null,
  playing: null,        // { trackId, stopFns, startedAt, raf }
  onProgress: null,     // (trackId, ratio) => {}
  onEnd: null,          // (trackId) => {}

  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  isPlaying(trackId) {
    return !!this.playing && this.playing.trackId === trackId;
  },

  stop() {
    if (!this.playing) return;
    const p = this.playing;
    this.playing = null;
    if (p.progressTimer) clearInterval(p.progressTimer);
    if (p.timer) clearInterval(p.timer);
    if (p.el) { try { p.el.pause(); p.el.src = ""; } catch (_) {} }
    if (p.master) {
      try { p.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); } catch (_) {}
      setTimeout(() => { try { p.master.disconnect(); } catch (_) {} }, 300);
    }
    if (this.onEnd) this.onEnd(p.trackId, p.done);
  },

  /* Lecture d'un vrai fichier importé par un artiste */
  playFile(track) {
    const el = new Audio(track.audioURL);
    el.currentTime = track.previewStart || 0;
    const p = { trackId: track.id, el, done: false };
    this.playing = p;
    el.play().catch(() => { toast("Lecture impossible : format audio non supporté"); this.stop(); });
    const startedAt = performance.now();
    p.progressTimer = setInterval(() => {
      if (this.playing !== p) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      const ratio = Math.min(elapsed / PREVIEW_SECONDS, 1);
      if (this.onProgress) this.onProgress(track.id, ratio, elapsed);
      if (ratio >= 1 || el.ended) {
        p.done = true;
        this.stop();
      }
    }, 100);
  },

  play(track) {
    this.stop();
    if (track.custom && track.audioURL) return this.playFile(track);
    const ctx = this.ensureCtx();
    const a = track.audio;
    const scale = MODES[a.mode];
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = a.wave === "sine" ? 2200 : 3200;
    filter.connect(master);
    master.connect(ctx.destination);

    const seed = hashCode(track.id);
    const stepDur = 60 / a.bpm / 2; // croches
    const start = ctx.currentTime + 0.06;
    let step = 0;
    let nextTime = start;

    const note = (midi, t, dur, gainVal, wave, detune = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.frequency.value = midiToHz(midi);
      o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gainVal, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(filter);
      o.start(t); o.stop(t + dur + 0.05);
    };

    // Nappe (pad) pour les genres planants
    if (a.pad) {
      for (const iv of [0, scale[2], scale[4]]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = midiToHz(a.root + iv);
        o.detune.value = (seed % 12) - 6;
        g.gain.value = 0.05;
        o.connect(g); g.connect(filter);
        o.start(start);
        this._padStops = this._padStops || [];
      }
    }

    // Progression d'accords sur 4 mesures (degrés de la gamme)
    const progressions = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 4, 5, 3], [5, 3, 0, 4]];
    const prog = progressions[seed % progressions.length];

    const timer = setInterval(() => {
      if (!this.playing || this.playing.trackId !== track.id) return;
      // planifie ~200ms d'avance
      while (nextTime < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4;
        const degree = prog[bar];
        const chordRoot = a.root + scale[degree % 7] + (degree > 4 ? -12 : 0);

        // basse sur les temps forts
        if (step % 4 === 0) {
          note(chordRoot - 12, nextTime, stepDur * 3, 0.22, a.wave === "sine" ? "sine" : "triangle");
        }
        // arpège
        const arpPattern = [0, 2, 4, 2, 0, 4, 2, 4];
        const iv = scale[(arpPattern[step % 8] + degree) % 7] + (step % 8 > 5 ? 12 : 0);
        note(a.root + iv, nextTime, stepDur * 1.4, 0.09, a.wave, ((seed + step) % 9) - 4);

        // percussion légère (bruit) pour les tempos rapides
        if (a.bpm > 100 && step % 2 === 1) {
          const buf = ctx.createBuffer(1, 800, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
          const src = ctx.createBufferSource();
          const g = ctx.createGain();
          g.gain.value = 0.05;
          src.buffer = buf;
          src.connect(g); g.connect(master);
          src.start(nextTime);
        }
        nextTime += stepDur;
        step++;
      }
    }, 80);

    const startedAt = performance.now();
    const p = { trackId: track.id, master, timer, done: false };
    this.playing = p;
    p.progressTimer = setInterval(() => {
      if (this.playing !== p) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      const ratio = Math.min(elapsed / PREVIEW_SECONDS, 1);
      if (this.onProgress) this.onProgress(track.id, ratio, elapsed);
      if (ratio >= 1) {
        p.done = true;
        this.stop();
      }
    }, 100);
  },

  toggle(track) {
    if (this.isPlaying(track.id)) this.stop();
    else this.play(track);
  },
};

/* ---------------- Utilitaires DOM ---------------- */
const $ = sel => document.querySelector(sel);
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $(".phone").appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

/* ---------------- Deck (Découvrir) ---------------- */
let deckOrder = [];   // ids restants, le premier = carte du dessus
let autoplay = false; // devient true après le premier play manuel

function rebuildDeck() {
  const remaining = TRACKS.filter(t => !bucketOf(t.id));
  // tri par affinité (algo v1) + un peu de hasard pour varier
  deckOrder = remaining
    .map(t => ({ t, s: trackAffinity(t) + Math.random() * 1.5 }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.t.id);
}

function renderDeck() {
  const deck = $("#deck");
  deck.innerHTML = "";

  if (deckOrder.length === 0) {
    deck.innerHTML = `
      <div class="deck-empty">
        <div style="font-size:44px">🎧</div>
        <p>Tu as tout écouté !<br>Reviens plus tard pour de nouvelles découvertes.</p>
        <button id="btn-restart">Réécouter le catalogue</button>
      </div>`;
    $("#btn-restart").onclick = () => {
      state.liked = []; state.later = []; state.disliked = [];
      saveState();
      rebuildDeck(); renderDeck(); renderLibrary(); renderProfile();
    };
    return;
  }

  // 3 cartes max dans la pile (la première du DOM = dessous)
  const visible = deckOrder.slice(0, 3).reverse();
  for (const id of visible) {
    const card = buildCard(byId[id]);
    const depth = deckOrder.indexOf(id);
    card.style.transform = `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`;
    card.style.zIndex = 10 - depth;
    deck.appendChild(card);
  }
  attachDrag(deck.lastElementChild, byId[deckOrder[0]]);
}

function buildCard(track) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = track.id;
  card.innerHTML = `
    <div class="badge like">J'AIME</div>
    <div class="badge nope">NON</div>
    <div class="badge later">À REVOIR</div>
    <div class="cover">
      ${coverHTML(track)}
      <div class="cover-head">${track.artist.toUpperCase()}<small>${track.title.toUpperCase()}</small></div>
      <div class="player-row">
        <button class="play-btn">▶</button>
        <span class="time">0:00 / 0:${PREVIEW_SECONDS}</span>
        <div class="progress"><div></div></div>
      </div>
    </div>
    <div class="card-meta">
      <div class="title">${track.title}</div>
      <div class="artist">${track.artist}</div>
      <div class="tags">${track.genres.join(" • ")}</div>
      <button class="more">•••</button>
    </div>
    <div class="card-back">
      <h3>${track.title}</h3>
      <div class="kv"><span>Artiste</span><span>${track.artist}</span></div>
      <div class="kv"><span>Genres</span><span>${track.genres.join(", ")}</span></div>
      ${track.custom
        ? `<div class="kv"><span>Source</span><span>Publié par l'artiste</span></div>`
        : `<div class="kv"><span>Tempo</span><span>${track.audio.bpm} BPM</span></div>`}
      <div class="kv"><span>Extrait</span><span>${PREVIEW_SECONDS} secondes</span></div>
      <p>${track.custom
        ? (track.description
            ? `« ${esc(track.description)} »<br><span style="color:var(--accent)">— ${esc(track.artist)}</span>`
            : `Titre publié directement par ${esc(track.artist)} sur Tune. Si tu l'aimes, il rejoint ta bibliothèque et soutient l'artiste.`)
        : `Artiste émergent proposé selon tes goûts. Si tu aimes ce titre, il rejoint ta bibliothèque et l'algorithme te proposera plus de ${track.genres[0]}.`}</p>
      <button class="close-back">Fermer</button>
    </div>`;

  const playBtn = card.querySelector(".play-btn");
  playBtn.addEventListener("pointerdown", e => e.stopPropagation());
  playBtn.addEventListener("click", e => {
    e.stopPropagation();
    autoplay = true;
    AudioEngine.toggle(track);
    syncPlayUI();
  });

  const flip = e => { e.stopPropagation(); card.classList.toggle("flipped"); };
  card.querySelector(".more").addEventListener("pointerdown", e => e.stopPropagation());
  card.querySelector(".more").addEventListener("click", flip);
  card.querySelector(".close-back").addEventListener("click", flip);
  card.querySelector(".card-back").addEventListener("pointerdown", e => e.stopPropagation());

  return card;
}

function syncPlayUI() {
  const top = topCard();
  if (!top) return;
  const btn = top.querySelector(".play-btn");
  if (btn) btn.textContent = AudioEngine.isPlaying(top.dataset.id) ? "❚❚" : "▶";
}

const topCard = () => $("#deck .card:last-child");

/* Progression / fin d'extrait */
AudioEngine.onProgress = (trackId, ratio, elapsed) => {
  const card = topCard();
  if (card && card.dataset.id === trackId) {
    card.querySelector(".progress > div").style.width = `${ratio * 100}%`;
    card.querySelector(".time").textContent = `${fmtTime(elapsed)} / 0:${PREVIEW_SECONDS}`;
  }
  if (miniTrackId === trackId) {
    // rien de plus : le mini-player n'a pas de barre en V1
  }
};
AudioEngine.onEnd = () => {
  syncPlayUI();
  updateMiniPlayBtn();
};

/* ---- Drag & swipe ---- */
function attachDrag(card, track) {
  if (!card) return;
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

  const onDown = e => {
    if (card.classList.contains("flipped")) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    card.classList.add("dragging");
    card.setPointerCapture(e.pointerId);
  };
  const onMove = e => {
    if (!dragging) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    const likeB = card.querySelector(".badge.like");
    const nopeB = card.querySelector(".badge.nope");
    const laterB = card.querySelector(".badge.later");
    likeB.style.opacity = Math.max(0, Math.min(dx / 90, 1));
    nopeB.style.opacity = Math.max(0, Math.min(-dx / 90, 1));
    laterB.style.opacity = dy < -50 && Math.abs(dx) < 60 ? Math.min(-dy / 130, 1) : 0;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("dragging");
    if (dx > 110) return decide("liked");
    if (dx < -110) return decide("disliked");
    if (dy < -130 && Math.abs(dx) < 80) return decide("later");
    card.classList.add("snap");
    card.style.transform = "";
    card.querySelectorAll(".badge").forEach(b => (b.style.opacity = 0));
    setTimeout(() => card.classList.remove("snap"), 380);
    dx = dy = 0;
  };

  card.addEventListener("pointerdown", onDown);
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onUp);
}

function decide(bucket) {
  const id = deckOrder[0];
  if (!id) return;
  const track = byId[id];
  const card = topCard();

  AudioEngine.stop();

  removeEverywhere(id);
  state[bucket].push(id);
  state.swipes++;
  scoreGenres(track, bucket === "liked" ? 2 : bucket === "later" ? 1 : -2);
  saveState();

  if (bucket === "liked") toast(`❤ « ${track.title} » ajouté à ta bibliothèque`);
  else if (bucket === "later") toast(`⏱ « ${track.title} » à réécouter plus tard`);
  else toast(`On te proposera moins de ${track.genres[0]}`);

  // animation de sortie
  if (card) {
    const flyX = bucket === "liked" ? 600 : bucket === "disliked" ? -600 : 0;
    const flyY = bucket === "later" ? -700 : 60;
    card.classList.add("fly");
    card.style.transform = `translate(${flyX}px, ${flyY}px) rotate(${flyX / 14}deg)`;
  }

  deckOrder.shift();
  // ré-applique l'affinité mise à jour sur le reste du deck
  deckOrder.sort((a, b) => trackAffinity(byId[b]) - trackAffinity(byId[a]));

  setTimeout(() => {
    renderDeck();
    renderLibrary();
    renderProfile();
    const next = deckOrder[0];
    if (autoplay && next) {
      AudioEngine.play(byId[next]);
      syncPlayUI();
    }
  }, 260);
}

$("#btn-like").addEventListener("click", () => decide("liked"));
$("#btn-nope").addEventListener("click", () => decide("disliked"));
$("#btn-later").addEventListener("click", () => decide("later"));
$("#btn-info").addEventListener("click", () => topCard()?.classList.toggle("flipped"));
$("#btn-filters").addEventListener("click", () => toast("Filtres : bientôt disponible"));

/* ---------------- Bibliothèque ---------------- */
let currentBucket = "liked";
let miniTrackId = null;

const BUCKET_EMPTY = {
  liked: "Aucun titre aimé pour l'instant.<br>Swipe à droite dans Découvrir ❤",
  later: "Rien à revoir.<br>Swipe vers le haut pour garder un titre de côté ⏱",
  disliked: "Aucun titre écarté.<br>Swipe à gauche pour passer un titre ✕",
};

function renderLibrary() {
  const list = $("#lib-list");
  const ids = state[currentBucket];
  if (ids.length === 0) {
    list.innerHTML = `<div class="lib-empty">${BUCKET_EMPTY[currentBucket]}</div>`;
    return;
  }
  list.innerHTML = "";
  for (const id of [...ids].reverse()) {
    list.appendChild(libItem(byId[id]));
  }
}

function libItem(track) {
  const el = document.createElement("div");
  el.className = "lib-item";
  const heart = currentBucket === "liked" ? "❤" : currentBucket === "later" ? "⏱" : "✕";
  el.innerHTML = `
    <div class="lib-cover" title="Écouter">${coverHTML(track)}<div class="lc-play">▶</div></div>
    <div class="lib-meta">
      <strong>${track.title}</strong>
      <span class="lm-artist">${track.artist}</span>
      <div class="lm-tags">${track.genres.join(" • ")}</div>
    </div>
    <button class="lib-heart" title="${currentBucket === "liked" ? "Retirer des aimés" : "Déplacer vers Aimés"}">${heart}</button>
    <button class="lib-more" title="Remettre dans Découvrir">↺</button>`;

  el.querySelector(".lib-cover").addEventListener("click", () => playInMini(track));

  el.querySelector(".lib-heart").addEventListener("click", () => {
    removeEverywhere(track.id);
    if (currentBucket === "liked") {
      scoreGenres(track, -2);
      toast(`« ${track.title} » retiré des aimés`);
    } else {
      state.liked.push(track.id);
      scoreGenres(track, 2);
      toast(`❤ « ${track.title} » déplacé vers Aimés`);
    }
    saveState(); rebuildDeck(); renderDeck(); renderLibrary(); renderProfile();
  });

  el.querySelector(".lib-more").addEventListener("click", () => {
    removeEverywhere(track.id);
    saveState(); rebuildDeck(); renderDeck(); renderLibrary(); renderProfile();
    toast(`« ${track.title} » remis dans Découvrir`);
  });

  return el;
}

document.querySelectorAll(".lib-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".lib-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentBucket = tab.dataset.bucket;
    renderLibrary();
  });
});

/* ---- Mini-player ---- */
function playInMini(track) {
  miniTrackId = track.id;
  $("#miniplayer").classList.remove("hidden");
  $("#mp-cover").innerHTML = coverHTML(track);
  $("#mp-title").textContent = track.title;
  $("#mp-artist").textContent = track.artist;
  AudioEngine.play(track);
  updateMiniPlayBtn();
}

function updateMiniPlayBtn() {
  $("#mp-play").textContent = miniTrackId && AudioEngine.isPlaying(miniTrackId) ? "❚❚" : "▶";
}

$("#mp-play").addEventListener("click", () => {
  if (!miniTrackId) return;
  AudioEngine.toggle(byId[miniTrackId]);
  updateMiniPlayBtn();
});
$("#mp-next").addEventListener("click", () => {
  const ids = state[currentBucket].length ? state[currentBucket] : state.liked;
  if (!ids.length) return;
  const i = ids.indexOf(miniTrackId);
  playInMini(byId[ids[(i + 1) % ids.length]]);
});

/* ---------------- Recherche ---------------- */
$("#search-input").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  const box = $("#search-results");
  if (!q) { box.innerHTML = `<div class="lib-empty">Cherche un titre, un artiste ou un genre.</div>`; return; }
  const results = TRACKS.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.genres.some(g => g.toLowerCase().includes(q))
  );
  if (!results.length) { box.innerHTML = `<div class="lib-empty">Aucun résultat pour « ${e.target.value} »</div>`; return; }
  box.innerHTML = "";
  for (const t of results) {
    const el = document.createElement("div");
    el.className = "lib-item";
    const inLib = bucketOf(t.id) === "liked";
    el.innerHTML = `
      <div class="lib-cover">${coverHTML(t)}<div class="lc-play">▶</div></div>
      <div class="lib-meta">
        <strong>${t.title}</strong>
        <span class="lm-artist">${t.artist}</span>
        <div class="lm-tags">${t.genres.join(" • ")}</div>
      </div>
      <button class="lib-heart" style="${inLib ? "" : "color:var(--muted)"}">❤</button>`;
    el.querySelector(".lib-cover").addEventListener("click", () => playInMini(t));
    el.querySelector(".lib-heart").addEventListener("click", ev => {
      const wasLiked = bucketOf(t.id) === "liked";
      removeEverywhere(t.id);
      if (!wasLiked) { state.liked.push(t.id); scoreGenres(t, 2); toast(`❤ « ${t.title} » ajouté`); }
      else { scoreGenres(t, -2); toast(`« ${t.title} » retiré`); }
      saveState(); rebuildDeck(); renderDeck(); renderLibrary(); renderProfile();
      ev.target.style.color = wasLiked ? "var(--muted)" : "";
    });
    box.appendChild(el);
  }
});

/* ---------------- Profil ---------------- */
function renderProfile() {
  const el = $("#profile-content");
  const scores = Object.entries(state.genreScores).sort((a, b) => b[1] - a[1]);
  const liked = scores.filter(([, v]) => v > 0).slice(0, 5);
  const avoided = scores.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 3);
  const maxAbs = Math.max(1, ...scores.map(([, v]) => Math.abs(v)));

  const bars = (rows, neg) => rows.map(([g, v]) => `
    <div class="genre-bar">
      <span class="gb-name">${g}</span>
      <div class="gb-track"><div class="gb-fill ${neg ? "neg" : ""}" style="width:${(Math.abs(v) / maxAbs) * 100}%"></div></div>
    </div>`).join("");

  el.innerHTML = `
    <div class="pf-header">
      <div class="pf-avatar">A</div>
      <div>
        <strong>Andy</strong>
        <span>Découvre de nouveaux artistes en swipant</span>
      </div>
    </div>
    <div class="pf-stats">
      <div class="pf-stat"><b>${state.swipes}</b><span>Swipes</span></div>
      <div class="pf-stat"><b>${state.liked.length}</b><span>Aimés</span></div>
      <div class="pf-stat"><b>${state.later.length}</b><span>À revoir</span></div>
    </div>
    <div class="pf-section">
      <h3>Tes genres préférés (algo v1)</h3>
      ${liked.length ? bars(liked, false) : `<p style="color:var(--muted);font-size:13.5px">Swipe quelques titres pour que l'algo apprenne tes goûts.</p>`}
    </div>
    ${avoided.length ? `<div class="pf-section"><h3>Genres évités</h3>${bars(avoided, true)}</div>` : ""}
    <button class="pf-artist" id="pf-artist">🎤 Espace artiste — publier un titre</button>
    <button class="pf-reset" id="pf-reset">Réinitialiser mes données</button>`;

  $("#pf-artist").addEventListener("click", () => showScreen("artist"));

  $("#pf-reset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, { liked: [], later: [], disliked: [], genreScores: {}, swipes: 0 });
    rebuildDeck(); renderDeck(); renderLibrary(); renderProfile();
    $("#miniplayer").classList.add("hidden");
    AudioEngine.stop();
    toast("Données réinitialisées");
  });
}

/* ---------------- Espace artiste ---------------- */
function renderArtistTracks() {
  const box = $("#artist-tracks");
  const customs = TRACKS.filter(t => t.custom);
  if (!customs.length) {
    box.innerHTML = `<div class="lib-empty" style="margin-top:10px">Aucun titre publié pour l'instant.</div>`;
    return;
  }
  box.innerHTML = "";
  for (const t of customs) {
    const liked = bucketOf(t.id) === "liked";
    const el = document.createElement("div");
    el.className = "lib-item";
    el.innerHTML = `
      <div class="lib-cover" title="Écouter">${coverHTML(t)}<div class="lc-play">▶</div></div>
      <div class="lib-meta">
        <strong>${t.title}</strong>
        <span class="lm-artist">${t.artist}</span>
        <div class="lm-tags">${t.genres.join(" • ")}${liked ? " • ❤ aimé" : ""}</div>
      </div>
      <button class="af-delete" title="Retirer ce titre">🗑</button>`;
    el.querySelector(".lib-cover").addEventListener("click", () => playInMini(t));
    el.querySelector(".af-delete").addEventListener("click", async () => {
      if (AudioEngine.isPlaying(t.id)) AudioEngine.stop();
      await idbDelete(t.id);
      TRACKS.splice(TRACKS.findIndex(x => x.id === t.id), 1);
      delete byId[t.id];
      removeEverywhere(t.id);
      saveState();
      if (miniTrackId === t.id) { miniTrackId = null; $("#miniplayer").classList.add("hidden"); }
      rebuildDeck(); renderDeck(); renderLibrary(); renderProfile(); renderArtistTracks();
      toast(`« ${t.title} » retiré de Tune`);
    });
    box.appendChild(el);
  }
}

$("#artist-form").addEventListener("submit", async e => {
  e.preventDefault();
  const artist = $("#af-artist").value.trim();
  const title = $("#af-title").value.trim();
  const file = $("#af-audio").files[0];
  if (!artist || !title || !file) { toast("Artiste, titre et fichier audio requis"); return; }
  if (file.size > 150 * 1024 * 1024) { toast("Fichier trop lourd (150 Mo max)"); return; }

  const genres = $("#af-genres").value.split(/[,;•]/).map(s => s.trim()).filter(Boolean);
  const rec = {
    id: `custom-${Date.now()}`,
    artist,
    title,
    genres: genres.length ? genres : ["Indépendant"],
    description: $("#af-desc").value.trim(),
    previewStart: Math.max(0, Number($("#af-start").value) || 0),
    audioBlob: file,
    coverBlob: $("#af-cover").files[0] || null,
    addedAt: Date.now(),
  };

  try {
    await idbPut(rec);
  } catch (_) {
    toast("Impossible d'enregistrer le titre (stockage indisponible)");
    return;
  }

  const track = addCustomToCatalog(rec);
  rebuildDeck();
  // le nouveau titre passe en tête du deck pour être visible tout de suite
  deckOrder = [track.id, ...deckOrder.filter(id => id !== track.id)];
  renderDeck();
  renderArtistTracks();
  e.target.reset();
  toast(`🎤 « ${title} » publié — en tête de Découvrir !`);
});

$("#artist-back").addEventListener("click", () => showScreen("profile"));

/* ---------------- Navigation ---------------- */
const SCREEN_NAMES = ["discover", "library", "search", "profile", "artist"];

function showScreen(name) {
  for (const s of SCREEN_NAMES) $(`#screen-${s}`).classList.toggle("hidden", s !== name);
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.screen === name || (name === "artist" && t.dataset.screen === "profile"))
  );
  // Le mini-player laisse la place au deck sur l'écran Découvrir
  if (name === "discover") {
    if (miniTrackId && AudioEngine.isPlaying(miniTrackId)) AudioEngine.stop();
    miniTrackId = null;
    $("#miniplayer").classList.add("hidden");
  }
  if (name === "artist") renderArtistTracks();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showScreen(tab.dataset.screen));
});

/* ---------------- Init ---------------- */
(async function init() {
  // recharge les titres publiés par les artistes (IndexedDB)
  try {
    const customs = await idbAll();
    customs.sort((a, b) => a.addedAt - b.addedAt).forEach(addCustomToCatalog);
  } catch (_) { /* stockage indisponible : on continue avec le catalogue de base */ }

  rebuildDeck();
  renderDeck();
  renderLibrary();
  renderProfile();
  $("#search-results").innerHTML = `<div class="lib-empty">Cherche un titre, un artiste ou un genre.</div>`;
})();
