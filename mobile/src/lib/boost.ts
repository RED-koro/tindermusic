/* Boost éditorial partagé — le « backend » de la mise en avant (Supabase, lecture seule).

   Un rôle SAIN pour Supabase, à l'opposé de l'upload d'artiste retiré au pivot :
   ici, TOI seul décides — depuis le tableau Supabase — quels artistes émergents
   pousser pour TOUS les utilisateurs, sans republier l'app. Aucun upload de
   fichier, aucune dépendance de licence : juste une liste d'ids Deezer + un poids.

   Lecture seule via l'API REST de Supabase (PostgREST), en fetch simple :
   zéro dépendance ajoutée, 100 % compatible Expo Go SDK 54.

   Complète le nivelage automatique (src/lib/fairness.ts) d'une couche curatée :
   le rank Deezer pousse les petits artistes tout seul ; cette liste-ci te laisse
   pousser À LA MAIN un artiste précis en qui tu crois. */

// ─── À REMPLIR avec TON projet Supabase (Dashboard → Project Settings → API) ───
const SUPABASE_URL = ""; // ex. "https://abcd1234.supabase.co"
const SUPABASE_ANON_KEY = ""; // la clé « anon public » (faite pour être embarquée, protégée par RLS)
// ──────────────────────────────────────────────────────────────────────────────

export const boostReady =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Récupère les artistes boostés (actifs) depuis Supabase.
    Renvoie une Map { artistId Deezer → poids }. Toute erreur/réseau coupé
    → Map vide : le boost éditorial ne doit JAMAIS bloquer le deck. */
export async function fetchBoostedArtists(): Promise<Map<number, number>> {
  if (!boostReady) return new Map();
  try {
    const url = `${SUPABASE_URL}/rest/v1/boosted_artists?select=artist_id,weight&active=eq.true`;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }).finally(() => clearTimeout(deadline));
    if (!r.ok) return new Map();
    const rows = (await r.json()) as { artist_id: number; weight: number | null }[];
    return new Map(rows.map(row => [row.artist_id, row.weight ?? 1]));
  } catch {
    return new Map();
  }
}

// Force du boost éditorial : un poids de 1 dans Supabase → +3 au score du deck.
// (Monte le poids par artiste dans Supabase pour pousser plus fort, sans toucher au code.)
const CURATED_AMP = 3;

/** Bonus éditorial pour un titre, selon la liste Supabase (poids × amplitude). */
export function curatedBoost(
  artistId: number | undefined,
  boosts: Map<number, number>
): number {
  if (artistId == null) return 0;
  const w = boosts.get(artistId);
  return w == null ? 0 : w * CURATED_AMP;
}
