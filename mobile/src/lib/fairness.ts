/* Nivelage de visibilité — « du Michael Jackson comme du Yohann Zveig ».

   Un titre déjà populaire remonte tout seul dans le deck (charts + affinité) :
   il n'a pas besoin d'aide. Un petit artiste réel, lui, mérite un coup de pouce
   pour exister — SAUF s'il n'a aucune visibilité du tout (là, on ne parie pas).

   Le bonus dessine une cloche : ~0 pour l'invisible, maximal pour le petit
   artiste réel, ~0 pour la superstar. On se base sur le champ `rank` de Deezer
   (popularité du titre, ~0 à 1 000 000), donc c'est gratuit : aucun appel réseau.

   La popularité s'étale sur 6 ordres de grandeur → on raisonne en log10 :
     rank 300 → p≈2.5 · rank 3 000 → p≈3.5 · rank 800 000 → p≈5.9 */

// ─── Les 4 réglages (change-les librement pour ajuster le comportement) ───
const FLOOR = 2.5; // plancher de visibilité (rank ≈ 300) : en dessous = « aucune visibilité »
const CEIL = 6; // plafond superstar (rank ≈ 1 000 000) : au-dessus, plus besoin d'aide
const SOFT = 0.5; // douceur du seuil (petit = transition douce, grand = brutal)
const AMP = 3; // amplitude max du bonus — dose douce : favorise la découverte
                // sans écraser le hasard (qui, lui, garantit l'équité)
// ─────────────────────────────────────────────────────────────────────────

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Bonus de mise en avant à ajouter au score du deck, selon la popularité
    (`rank` Deezer) du titre. Sans donnée de popularité → 0 (on ne parie pas). */
export function fairnessBonus(popularity?: number): number {
  if (popularity == null || popularity <= 0) return 0;
  const p = Math.log10(popularity);
  const gate = sigmoid((p - FLOOR) / SOFT); // porte : filtre « aucune visibilité »
  const underdog = clamp01((CEIL - p) / (CEIL - FLOOR)); // moins connu = plus de pouce
  return AMP * gate * underdog;
}

/** Variété : le même artiste ne revient pas avant `gap` cartes. Le tri par
    score a tendance à empiler les titres d'un artiste boosté ou adoré — on
    entrelace en respectant l'ordre au maximum (le n°1 reste n°1). */
export function spreadArtists<T extends { artist: string }>(
  sorted: T[],
  gap = 4
): T[] {
  const out: T[] = [];
  const rest = [...sorted];
  while (rest.length) {
    const recent = new Set(out.slice(-gap).map(t => t.artist));
    let i = rest.findIndex(t => !recent.has(t.artist));
    if (i === -1) i = 0; // il ne reste que des artistes récents : on empile, tant pis
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
