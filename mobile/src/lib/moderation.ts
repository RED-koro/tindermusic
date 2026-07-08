/* Modération des publications d'artistes (v1, côté client).
   Trois lignes de défense :
   1. Validation automatique à la publication : textes (mots interdits),
      fichier audio (format + durée), pochette (dimensions).
   2. Charte artiste obligatoire (droits + règles de contenu).
   3. Signalement par les auditeurs → titre masqué.
   La V2 (backend) ajoutera la revue humaine/IA avant mise en ligne : le champ
   `status` des titres est déjà prévu pour ("pending" → "approved"/"rejected"). */

import { createAudioPlayer } from "expo-audio";

export const AUDIO_MIN_SECONDS = 15;   // trop court = spam / bruit
export const AUDIO_MAX_SECONDS = 15 * 60;
export const COVER_MIN_PX = 200;
/** Nombre de signalements avant masquage. 1 en local ; à monter côté serveur. */
export const REPORTS_TO_HIDE = 1;

const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "aac", "flac", "ogg", "aiff", "aif"];

/* ---- Filtre de texte ----
   Liste volontairement large (haine, insultes, sexuel explicite, spam).
   Normalisation anti-contournement : accents, l33t (3→e, 1→i, @→a…). */
const BANNED_WORDS = [
  // insultes / haine (fr)
  "pute", "putes", "salope", "salopes", "connard", "connards", "connasse",
  "encule", "encules", "enculee", "batard", "batards", "fdp", "ntm", "tg",
  "pd", "tapette", "tarlouze", "negre", "negres", "bougnoule", "youpin",
  "feuj", "goudou", "trisomique", "mongol", "attarde",
  // insultes / haine (en)
  "fuck", "fucking", "bitch", "bitches", "cunt", "nigger", "nigga", "faggot",
  "retard", "whore", "slut", "dyke", "kike", "spic", "chink",
  // apologie / extrémisme
  "hitler", "nazi", "nazis", "sieg", "heil", "isis", "daech", "djihad",
  // sexuel explicite / spam
  "porn", "porno", "xxx", "sexe", "nude", "nudes", "onlyfans", "viagra",
];

const BANNED_PHRASES = [
  "niquetamere", "niquesamere", "filsdepute", "tamere", "suckmydick",
  "whitepower", "heilhitler",
];

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[3€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[@4]/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function checkText(fields: { label: string; value: string }[]): string[] {
  const reasons: string[] = [];
  for (const { label, value } of fields) {
    if (!value) continue;
    const words = normalizeWords(value);
    const collapsed = words.join("");
    const badWord = words.find(w => BANNED_WORDS.includes(w));
    const badPhrase = BANNED_PHRASES.find(p => collapsed.includes(p));
    if (badWord || badPhrase) {
      reasons.push(`${label} : contenu injurieux ou inapproprié détecté`);
    }
  }
  return reasons;
}

/* ---- Validation du fichier audio ---- */

export function checkAudioFile(name: string, mimeType?: string | null): string | null {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const extOk = AUDIO_EXTENSIONS.includes(ext);
  const mimeOk = !mimeType || mimeType.startsWith("audio/");
  if (!extOk && !mimeOk) {
    return `Fichier audio : format non reconnu (formats acceptés : ${AUDIO_EXTENSIONS.join(", ").toUpperCase()})`;
  }
  return null;
}

/** Charge le fichier pour lire sa durée réelle (null si illisible). */
export function probeAudioDuration(uri: string): Promise<number | null> {
  return new Promise(resolve => {
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let deadline: ReturnType<typeof setTimeout> | null = null;
    const finish = (d: number | null) => {
      if (poll) clearInterval(poll);
      if (deadline) clearTimeout(deadline);
      try { player?.remove(); } catch {}
      resolve(d);
    };
    try {
      player = createAudioPlayer({ uri });
      poll = setInterval(() => {
        if (player?.isLoaded && player.duration > 0) finish(player.duration);
      }, 200);
      deadline = setTimeout(() => finish(null), 8000);
    } catch {
      finish(null);
    }
  });
}

export function checkAudioDuration(duration: number | null, previewStart: number): string[] {
  if (duration == null) {
    return ["Fichier audio : illisible ou corrompu — impossible de vérifier le contenu"];
  }
  const reasons: string[] = [];
  if (duration < AUDIO_MIN_SECONDS) {
    reasons.push(`Fichier audio : trop court (${Math.round(duration)} s — minimum ${AUDIO_MIN_SECONDS} s)`);
  }
  if (duration > AUDIO_MAX_SECONDS) {
    reasons.push(`Fichier audio : trop long (maximum ${AUDIO_MAX_SECONDS / 60} minutes)`);
  }
  if (previewStart > 0 && duration >= AUDIO_MIN_SECONDS && previewStart > duration - 5) {
    reasons.push(`Début de l'extrait : au-delà de la fin du morceau (${Math.round(duration)} s)`);
  }
  return reasons;
}

/* ---- Validation de la pochette ---- */

export function checkCover(width?: number, height?: number): string | null {
  if (!width || !height) return null; // dimensions inconnues : laissé passer en v1
  if (width < COVER_MIN_PX || height < COVER_MIN_PX) {
    return `Pochette : image trop petite (minimum ${COVER_MIN_PX}×${COVER_MIN_PX} px)`;
  }
  const ratio = width / height;
  if (ratio < 0.5 || ratio > 2) {
    return "Pochette : format trop étiré — utilise une image proche du carré";
  }
  return null;
}
