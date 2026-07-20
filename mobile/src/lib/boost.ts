/* Boost éditorial & sponsorisé — le « backend » de la mise en avant
   (Supabase, lecture seule).

   Deux familles de mise en avant, même moteur :
   - ÉDITORIAL (sponsored = false) : Andy pousse un artiste en qui il croit.
   - SPONSORISÉ (sponsored = true) : l'artiste/le label PAIE sa visibilité —
     c'est le modèle économique de Zicmu (« ne fais pas payer ceux qui
     écoutent, fais payer ceux qui veulent être écoutés »).

   Règle d'éthique NON NÉGOCIABLE : un boost sponsorisé est TOUJOURS signalé
   à l'utilisateur (badge « Sponsorisé » sur la carte) et ne donne qu'une
   chance d'être vu — jamais un like. La dose reste plafonnée comme
   l'éditorial : présence, pas domination. Qui pourrit la découverte tue l'app.

   Lecture seule via l'API REST de Supabase (PostgREST), en fetch simple :
   zéro dépendance ajoutée, 100 % compatible Expo Go SDK 54. */

// ─── Projet Supabase (clé « anon public », faite pour être embarquée,
//     protégée par RLS — Dashboard → Settings → API) ───
const SUPABASE_URL = "https://ivswzeggkrrifdkxlvid.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2c3d6ZWdna3JyaWZka3hsdmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzY3ODAsImV4cCI6MjA5OTM1Mjc4MH0.I_xvtKpuoujQs_gB-goXOIECY7u7Dey0WvMcCSlrfzg";
// ──────────────────────────────────────────────────────────────────────

export const boostReady =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export interface BoostInfo {
  weight: number;
  /** true = visibilité payée → badge « Sponsorisé » affiché sur la carte */
  sponsored: boolean;
}

export type BoostMap = Map<number, BoostInfo>;

// Cache mémoire : la liste des boosts change rarement. On la garde 10 min
// pour ne pas retaper Supabase à chaque montée d'écran — indispensable à
// l'échelle (chaque appareil n'interroge le serveur qu'une fois toutes les 10 min).
let cache: { at: number; map: BoostMap } | null = null;
const CACHE_MS = 10 * 60 * 1000;

async function fetchRows(withSponsored: boolean): Promise<Response> {
  const cols = withSponsored
    ? "artist_id,weight,sponsored"
    : "artist_id,weight";
  const url = `${SUPABASE_URL}/rest/v1/boosted_artists?select=${cols}&active=eq.true&limit=100`;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  }).finally(() => clearTimeout(deadline));
}

/** Récupère les artistes boostés (actifs) depuis Supabase.
    Renvoie { artistId Deezer → { poids, sponsorisé } }. Toute erreur/réseau
    coupé → dernier cache connu (ou vide) : ne bloque JAMAIS le deck.
    Repli : si la colonne `sponsored` n'existe pas encore côté serveur
    (migration pas lancée), on relit sans elle — tout reste éditorial. */
export async function fetchBoostedArtists(): Promise<BoostMap> {
  if (!boostReady) return new Map();
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  try {
    let r = await fetchRows(true);
    if (!r.ok) r = await fetchRows(false);
    if (!r.ok) return cache?.map ?? new Map();
    const rows = (await r.json()) as {
      artist_id: number;
      weight: number | null;
      sponsored?: boolean | null;
    }[];
    // validation : ids numériques uniquement, poids borné à [0, 3] — même une
    // ligne aberrante en base ne peut pas écraser le classement du deck
    const map: BoostMap = new Map(
      rows
        .filter(row => typeof row.artist_id === "number" && Number.isFinite(row.artist_id))
        .map(row => [
          row.artist_id,
          {
            weight: Math.min(Math.max(Number(row.weight ?? 1) || 1, 0), 3),
            sponsored: row.sponsored === true,
          },
        ])
    );
    cache = { at: Date.now(), map };
    return map;
  } catch {
    // hors-ligne : on garde le dernier cache connu plutôt que de tout perdre
    return cache?.map ?? new Map();
  }
}

// Force du boost : un poids de 1 dans Supabase → +1 au score du deck.
// Dose VOLONTAIREMENT douce : garantir une présence, jamais une domination.
// La même pour l'éditorial et le sponsorisé — payer n'achète pas plus fort.
const CURATED_AMP = 1;

/** Bonus de mise en avant pour un titre (poids × amplitude). */
export function curatedBoost(
  artistId: number | undefined,
  boosts: BoostMap
): number {
  if (artistId == null) return 0;
  const info = boosts.get(artistId);
  return info == null ? 0 : info.weight * CURATED_AMP;
}

/** L'artiste de ce titre a-t-il payé sa visibilité ? (→ badge sur la carte) */
export function isSponsored(
  artistId: number | undefined,
  boosts: BoostMap
): boolean {
  return artistId != null && boosts.get(artistId)?.sponsored === true;
}
