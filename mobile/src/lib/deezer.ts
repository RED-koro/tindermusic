/* Intégration Deezer — vraie musique dans Tune.
   L'API publique Deezer est gratuite et sans clé : extraits officiels de 30 s,
   pochettes d'albums, charts par genre et recherche dans tout le catalogue.
   Sur téléphone : fetch direct. Sur web : l'API n'envoie pas d'en-têtes CORS,
   on passe par JSONP (uniquement utile pour l'aperçu navigateur). */

import { Platform } from "react-native";
import { Track } from "./catalog";

const API = "https://api.deezer.com";

/** Charts Deezer utilisés pour alimenter Découvrir (ids officiels /genre). */
export const DEEZER_GENRES: { id: number; label: string }[] = [
  { id: 132, label: "Pop" },
  { id: 116, label: "Rap / Hip-Hop" },
  { id: 152, label: "Rock" },
  { id: 106, label: "Électro" },
  { id: 113, label: "Dance" },
  { id: 165, label: "R&B" },
  { id: 85, label: "Alternative" },
  { id: 52, label: "Chanson française" },
  { id: 466, label: "Folk" },
  { id: 129, label: "Jazz" },
];

let jsonpCounter = 0;

function request<T>(path: string): Promise<T> {
  if (Platform.OS !== "web") {
    return fetch(`${API}${path}`).then(r => r.json());
  }
  return new Promise<T>((resolve, reject) => {
    const cb = `__deezer_cb_${++jsonpCounter}`;
    const sep = path.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    const w = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      delete w[cb];
      script.remove();
    };
    w[cb] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("deezer-jsonp"));
    };
    script.src = `${API}${path}${sep}output=jsonp&callback=${cb}`;
    document.head.appendChild(script);
    setTimeout(() => {
      if (w[cb]) {
        cleanup();
        reject(new Error("deezer-timeout"));
      }
    }, 10000);
  });
}

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: { name: string };
  album: { title: string; cover_big?: string; cover_medium?: string };
}

function toTrack(t: DeezerTrack, genreLabel?: string): Track | null {
  if (!t?.preview) return null; // sans extrait, inutilisable dans Tune
  return {
    id: `dz-${t.id}`,
    title: t.title,
    artist: t.artist?.name ?? "Artiste inconnu",
    genres: [genreLabel ?? "Découverte"],
    // scene/hue inutilisés : la vraie pochette remplace le SVG généré
    scene: "sun",
    hue: 0,
    hue2: 0,
    deezer: true,
    album: t.album?.title,
    previewUrl: t.preview,
    coverUri: t.album?.cover_big || t.album?.cover_medium || null,
  };
}

function dedupe(lists: Track[][]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const list of lists) {
    for (const t of list) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  return out;
}

export async function fetchChart(
  genreId: number,
  label: string,
  limit = 20
): Promise<Track[]> {
  const d = await request<{ data?: DeezerTrack[] }>(
    `/chart/${genreId}/tracks?limit=${limit}`
  );
  return (d.data ?? []).map(t => toTrack(t, label)).filter((t): t is Track => !!t);
}

/** Construit le flux Découvrir : tendances globales + charts des genres
    préférés de l'utilisateur (l'algo pilote ce qu'on va chercher). */
export async function fetchDiscoveryFeed(
  genreScores: Record<string, number>,
  perChart = 20
): Promise<Track[]> {
  const ranked = [...DEEZER_GENRES].sort(
    (a, b) => (genreScores[b.label] || 0) - (genreScores[a.label] || 0)
  );
  const random = DEEZER_GENRES[Math.floor(Math.random() * DEEZER_GENRES.length)];
  const picks = [
    { id: 0, label: "Tendances" },
    ...ranked.slice(0, 2),
    random,
  ].filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);

  const lists = await Promise.all(
    picks.map(p => fetchChart(p.id, p.label, perChart).catch(() => []))
  );
  return dedupe(lists);
}

export async function searchDeezer(query: string, limit = 25): Promise<Track[]> {
  const d = await request<{ data?: DeezerTrack[] }>(
    `/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return (d.data ?? []).map(t => toTrack(t)).filter((t): t is Track => !!t);
}

/** Les URLs d'extraits Deezer expirent au bout de quelques heures :
    on les rafraîchit au moment de la lecture. */
export async function refreshPreviewUrl(trackId: string): Promise<string | null> {
  const numericId = trackId.replace(/^dz-/, "");
  try {
    const t = await request<DeezerTrack>(`/track/${numericId}`);
    return t?.preview || null;
  } catch {
    return null;
  }
}
