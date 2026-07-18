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

// ─── Ton projet Supabase (repris de l'ancien client V2 ; clé « anon public »,
//     faite pour être embarquée, protégée par RLS — Dashboard → Settings → API) ───
const SUPABASE_URL = "https://ivswzeggkrrifdkxlvid.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2c3d6ZWdna3JyaWZka3hsdmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzY3ODAsImV4cCI6MjA5OTM1Mjc4MH0.I_xvtKpuoujQs_gB-goXOIECY7u7Dey0WvMcCSlrfzg";
// ──────────────────────────────────────────────────────────────────────────────

export const boostReady =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// Cache mémoire : la liste des boosts change rarement (Andy la modifie à la
// main). On la garde 10 min pour ne pas retaper Supabase à chaque montée
// d'écran — indispensable à l'échelle (des milliers d'appareils, mais chacun
// n'interroge le serveur qu'une fois toutes les 10 min).
let cache: { at: number; map: Map<number, number> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/** Récupère les artistes boostés (actifs) depuis Supabase.
    Renvoie une Map { artistId Deezer → poids }. Toute erreur/réseau coupé
    → Map vide : le boost éditorial ne doit JAMAIS bloquer le deck. */
export async function fetchBoostedArtists(): Promise<Map<number, number>> {
  if (!boostReady) return new Map();
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
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
    if (!r.ok) return cache?.map ?? new Map();
    const rows = (await r.json()) as { artist_id: number; weight: number | null }[];
    const map = new Map(rows.map(row => [row.artist_id, row.weight ?? 1]));
    cache = { at: Date.now(), map };
    return map;
  } catch {
    // hors-ligne : on garde le dernier cache connu plutôt que de tout perdre
    return cache?.map ?? new Map();
  }
}

// Force du boost éditorial : un poids de 1 dans Supabase → +1 au score du deck.
// Dose VOLONTAIREMENT douce : garantir une présence, jamais une domination.
// (Monte le poids par artiste dans Supabase pour pousser un peu plus, sans code.)
const CURATED_AMP = 1;

/** Bonus éditorial pour un titre, selon la liste Supabase (poids × amplitude). */
export function curatedBoost(
  artistId: number | undefined,
  boosts: Map<number, number>
): number {
  if (artistId == null) return 0;
  const w = boosts.get(artistId);
  return w == null ? 0 : w * CURATED_AMP;
}
