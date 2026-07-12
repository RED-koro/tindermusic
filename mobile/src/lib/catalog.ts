/* Types des titres de Tune.
   La musique vient de Deezer (artistes maison de src/lib/featured.ts + charts
   + recommandations) et des artistes qui publient depuis l'app. */

export const PREVIEW_SECONDS = 30;

export type Scene =
  | "sun"
  | "moon"
  | "waves"
  | "rings"
  | "grid"
  | "aurora"
  | "bloom"
  | "portrait";

export const SCENES: Scene[] = [
  "sun",
  "moon",
  "waves",
  "rings",
  "grid",
  "aurora",
  "bloom",
  "portrait",
];

export interface Track {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  scene: Scene;
  hue: number;
  hue2: number;
  bpm?: number;
  /** Titre publié par un artiste depuis l'app */
  custom?: boolean;
  description?: string;
  previewStart?: number;
  audioUri?: string;
  coverUri?: string | null;
  /** Titre venant du catalogue Deezer (extraits officiels 30 s) */
  deezer?: boolean;
  artistId?: number;
  /** Popularité du titre (champ `rank` Deezer, ~0 à 1 000 000) — sert au
      nivelage de visibilité dans le deck (voir src/lib/fairness.ts) */
  popularity?: number;
  /** Titre d'un artiste maison de Tune (mis en avant dans le deck) */
  featured?: boolean;
  album?: string;
  previewUrl?: string;
  /** Titre publié dans le cloud (Supabase) — visible par tous les utilisateurs */
  cloud?: boolean;
  /** Chemins de stockage, pour la suppression par l'artiste propriétaire */
  cloudAudioPath?: string;
  cloudCoverPath?: string | null;
  owner?: string;
}

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* L'ancien catalogue de démo (14 titres synthétiques) a été retiré :
   la musique vient désormais des artistes maison (featured.ts), des charts
   Deezer et des artistes qui publient depuis l'app. */
