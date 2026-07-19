# Zicmu — Modèle de monétisation

> **En une phrase : ne fais pas payer ceux qui écoutent — fais payer ceux qui
> veulent être écoutés.**

## Le modèle

Des **artistes émergents et petits labels paient pour être mis en avant** dans
le deck de découverte. C'est le modèle prouvé par Spotify (« Discovery Mode »)
et par tout l'écosystème de promo musicale (Groover ≈ 2 €/mise en relation,
SubmitHub ≈ 3 $/envoi, Playlist Push ≈ 300–500 $/campagne) : la découverte est
la douleur n°1 des artistes, et c'est **leur** ligne de budget — pas celle des
auditeurs, qui paient déjà leur streaming.

Ce que Zicmu vend est rare : **30 secondes d'attention réelle**, plein écran,
avec du son, chez un auditeur qui cherche précisément de la nouveauté. Aucune
bannière de pub n'offre ça.

## Les règles non négociables (gravées dans le code)

1. **Transparence** : toute visibilité payée porte un badge « Sponsorisé » sur
   la carte. Déjà implémenté (`boosted_artists.sponsored` → badge).
2. **On ne vend pas des likes, on vend une chance d'être vu** : le boost
   sponsorisé a la même dose plafonnée que le boost éditorial (présence, pas
   domination). L'artiste doit mériter le cœur.
3. **Jamais de monétisation de la musique elle-même** (streaming payant,
   téléchargement…) : c'est le piège des licences qui a tué les prédécesseurs.

## Grille tarifaire (campagne de 7 jours)

Hypothèse : un boost génère ≈ 1,5 écoute attentive par auditeur actif
hebdomadaire sur la semaine. Prix calé sur ~0,01–0,02 € par écoute attentive —
sous le coût d'un spot audio (CPM 15–25 €) et très en-dessous de Groover
rapporté au contact.

| Auditeurs actifs / semaine | Écoutes estimées (7 j) | Prix campagne 7 j |
|---|---|---|
| 1 000 | ~1 500 | **29 €** |
| 5 000 | ~7 500 | **99 €** |
| 20 000 | ~30 000 | **290 €** |
| 100 000 | ~150 000 | **990 €** |

Formules possibles : Découverte (7 j) / Poussée (14 j, −15 %) /
Résidence (30 j, −25 %).

### Ordre de grandeur des revenus

| Audience | Campagnes simultanées réalistes | Revenu mensuel |
|---|---|---|
| 5 000 actifs | 4 | ~400 € |
| 20 000 actifs | 6–8 | ~1 700–2 300 € |
| 100 000 actifs | 10–15 | ~10 000–15 000 € |

En appoint (plus tard, jamais en moteur principal) : un abonnement « Zicmu+ »
(stats d'écoute, filtres avancés, thèmes) à 2,99 €/mois — à ne lancer que si
l'audience le réclame.

## Les prérequis avant d'encaisser le premier euro

- [ ] **Audience** : sous ~2 000 auditeurs actifs/semaine, on ne vend rien
      (personne ne paie pour toucher 50 personnes ; vendre trop tôt grille la
      crédibilité).
- [ ] **Source musicale commerciale** : l'API publique Deezer est réservée à un
      usage non commercial → au premier euro, il faut un accord de données
      musicales (ligne rouge n°1).
- [ ] **Structure juridique** (micro-entreprise suffit au début) + moyen
      d'encaissement (Stripe : ~1,4 % + 0,25 €/transaction).
- [ ] **Page « Promouvoir ma musique »** pour les artistes (commande +
      paiement + rapport de campagne : écoutes, likes, ajouts en playlist).

## L'ordre de marche

1. **Maintenant** : rétention (est-ce que les gens reviennent ?) — rien à vendre.
2. **Ensuite** : audience (des milliers d'actifs) — toujours rien à vendre.
3. **Alors seulement** : ouvrir les campagnes sponsorisées avec cette grille,
   et basculer la source musicale sur un accord commercial.

Le moteur technique (table `boosted_artists` + badge « Sponsorisé ») est déjà
en production. Le jour J, il ne manque que la page de commande et le paiement.
