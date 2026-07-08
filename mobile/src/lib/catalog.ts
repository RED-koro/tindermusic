/* Catalogue V1 de Tune — repris du prototype web.
   Les extraits audio des titres du catalogue sont pré-générés dans assets/previews/
   (scripts/generate-previews.mjs) ; les titres publiés par les artistes jouent
   leur vrai fichier importé. */

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
}

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const CATALOG: Track[] = [
  { id: "lune-rouge",    title: "Lune Rouge",     artist: "SOLARIS",      genres: ["Indie", "Électro", "Français"],  scene: "sun",      hue: 340, hue2: 265, bpm: 96 },
  { id: "avant-laube",   title: "Avant l'aube",   artist: "Mielka",       genres: ["Dream Pop", "Français"],         scene: "bloom",    hue: 24,  hue2: 350, bpm: 82 },
  { id: "oceans",        title: "Oceans",         artist: "Naylors",      genres: ["Ambient", "Électronique"],       scene: "waves",    hue: 195, hue2: 230, bpm: 70 },
  { id: "echoes",        title: "Echoes",         artist: "The Kairo",    genres: ["Alternative", "Rock"],           scene: "moon",     hue: 220, hue2: 200, bpm: 118 },
  { id: "falling",       title: "Falling Slowly", artist: "Vesper",       genres: ["Indie", "Folk"],                 scene: "sun",      hue: 30,  hue2: 200, bpm: 88 },
  { id: "dans-le-noir",  title: "Dans le noir",   artist: "Lys",          genres: ["R&B", "Français"],               scene: "portrait", hue: 350, hue2: 235, bpm: 92 },
  { id: "neon",          title: "Néon",           artist: "Karma Club",   genres: ["Synthwave", "Électro"],          scene: "grid",     hue: 285, hue2: 320, bpm: 110 },
  { id: "maree-haute",   title: "Marée haute",    artist: "Colline",      genres: ["Chanson", "Indie", "Français"],  scene: "waves",    hue: 160, hue2: 210, bpm: 100 },
  { id: "gravity",       title: "Gravity",        artist: "Moth & Flame", genres: ["Electro Pop"],                   scene: "rings",    hue: 260, hue2: 300, bpm: 116 },
  { id: "sous-la-pluie", title: "Sous la pluie",  artist: "Amarante",     genres: ["Lo-fi", "Chill", "Français"],    scene: "bloom",    hue: 205, hue2: 260, bpm: 74 },
  { id: "zenith",        title: "Zenith",         artist: "ORBE",         genres: ["Techno", "Électronique"],        scene: "rings",    hue: 15,  hue2: 280, bpm: 128 },
  { id: "ligne-claire",  title: "Ligne claire",   artist: "Palissade",    genres: ["Indie Rock", "Français"],        scene: "moon",     hue: 40,  hue2: 20,  bpm: 122 },
  { id: "boreal",        title: "Boréal",         artist: "Nordlys",      genres: ["Ambient", "Cinématique"],        scene: "aurora",   hue: 150, hue2: 190, bpm: 64 },
  { id: "fievre",        title: "Fièvre",         artist: "Jade Ruby",    genres: ["Pop", "Français"],               scene: "portrait", hue: 315, hue2: 355, bpm: 108 },
];
