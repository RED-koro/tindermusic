/* Intégration Deezer — vraie musique dans Tune.
   L'API publique Deezer est gratuite et sans clé : extraits officiels de 30 s,
   pochettes d'albums, charts par genre et recherche dans tout le catalogue.
   Sur téléphone : fetch direct. Sur web : l'API n'envoie pas d'en-têtes CORS,
   on passe par JSONP (uniquement utile pour l'aperçu navigateur). */

import { Platform } from "react-native";
import { Track } from "./catalog";
import { FEATURED_ARTISTS, FEATURED_LABEL } from "./featured";

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
    // timeout dur : un appel qui pend ne doit jamais bloquer l'app
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8000);
    return fetch(`${API}${path}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`deezer-http-${r.status}`);
        return r.json() as Promise<T>;
      })
      .finally(() => clearTimeout(deadline));
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
  /** Popularité du titre (0 à ~1 000 000) — utilisée pour le nivelage de visibilité */
  rank?: number;
  artist: { id?: number; name: string };
  album: { title: string; cover_big?: string; cover_medium?: string };
}

interface DeezerArtist {
  id: number;
  name: string;
}

function toTrack(
  t: DeezerTrack,
  genreLabel?: string,
  featured = false
): Track | null {
  if (!t?.preview) return null; // sans extrait, inutilisable dans Tune
  return {
    id: `dz-${t.id}`,
    title: t.title,
    artist: t.artist?.name ?? "Artiste inconnu",
    artistId: t.artist?.id,
    genres: [genreLabel ?? "Découverte"],
    // scene/hue inutilisés : la vraie pochette remplace le SVG généré
    scene: "sun",
    hue: 0,
    hue2: 0,
    deezer: true,
    featured: featured || undefined,
    popularity: t.rank,
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

/** Top titres d'un artiste (tagués avec le genre du titre "graine"). */
export async function fetchArtistTop(
  artistId: number,
  genreLabel: string,
  limit = 5,
  featured = false
): Promise<Track[]> {
  const d = await request<{ data?: DeezerTrack[] }>(
    `/artist/${artistId}/top?limit=${limit}`
  );
  return (d.data ?? [])
    .map(t => toTrack(t, genreLabel, featured))
    .filter((t): t is Track => !!t);
}

export interface ArtistInfo {
  id: number;
  name: string;
  pictureUrl: string | null;
  fans: number;
  albums: number;
}

/** Fiche d'un artiste (photo, fans, nombre d'albums). */
export async function fetchArtistInfo(artistId: number): Promise<ArtistInfo | null> {
  try {
    const a = await request<{
      id: number;
      name: string;
      picture_big?: string;
      picture_medium?: string;
      nb_fan?: number;
      nb_album?: number;
    }>(`/artist/${artistId}`);
    if (!a?.id) return null;
    return {
      id: a.id,
      name: a.name,
      pictureUrl: a.picture_big || a.picture_medium || null,
      fans: a.nb_fan ?? 0,
      albums: a.nb_album ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchRelatedArtists(
  artistId: number,
  limit = 2
): Promise<DeezerArtist[]> {
  const d = await request<{ data?: DeezerArtist[] }>(
    `/artist/${artistId}/related?limit=${limit}`
  );
  return (d.data ?? []).slice(0, limit);
}

/** Les artistes maison de Tune : leurs titres arrivent en priorité dans le deck. */
export async function fetchFeaturedTracks(): Promise<Track[]> {
  const lists = await Promise.all(
    FEATURED_ARTISTS.map(a =>
      fetchArtistTop(a.id, FEATURED_LABEL, 7, true).catch(() => [])
    )
  );
  return dedupe(lists);
}

export interface ArtistSeed {
  artistId: number;
  genres: string[];
}

/** Construit le flux Découvrir (algo v2) :
    artistes maison + tendances + charts des genres préférés + recommandations
    « parce que tu as aimé cet artiste » (top de l'artiste + artistes similaires). */
export async function fetchDiscoveryFeed(
  genreScores: Record<string, number>,
  seeds: ArtistSeed[] = [],
  perChart = 20
): Promise<Track[]> {
  const ranked = [...DEEZER_GENRES].sort(
    (a, b) => (genreScores[b.label] || 0) - (genreScores[a.label] || 0)
  );
  // exploration : un genre au hasard, mais jamais un genre clairement rejeté
  const explorable = DEEZER_GENRES.filter(g => (genreScores[g.label] || 0) > -3);
  const random = explorable[Math.floor(Math.random() * explorable.length)];
  const picks = [
    { id: 0, label: "Tendances" },
    ...ranked.slice(0, 2).filter(g => (genreScores[g.label] || 0) > 0),
    ...(random ? [random] : []),
  ].filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);

  const chartJobs = picks.map(p =>
    fetchChart(p.id, p.label, perChart).catch(() => [])
  );

  // « parce que tu as aimé X » : top de l'artiste + tops de 2 artistes similaires
  const seedJobs = seeds.slice(0, 2).map(async seed => {
    const label = seed.genres[0] ?? "Découverte";
    try {
      const [own, related] = await Promise.all([
        fetchArtistTop(seed.artistId, label, 4),
        fetchRelatedArtists(seed.artistId, 2),
      ]);
      const relatedTops = await Promise.all(
        related.map(a => fetchArtistTop(a.id, label, 4).catch(() => []))
      );
      return dedupe([own, ...relatedTops]);
    } catch {
      return [] as Track[];
    }
  });

  const lists = await Promise.all([...seedJobs, ...chartJobs]);
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
