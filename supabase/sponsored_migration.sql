-- ════════════════════════════════════════════════════════════════════════
--  Zicmu — migration « boost sponsorisé »
--  À lancer UNE FOIS : Dashboard Supabase → SQL Editor → colle → Run.
--
--  Ajoute la colonne qui distingue un boost ÉDITORIAL (tu pousses un artiste
--  gratuitement) d'un boost SPONSORISÉ (l'artiste a payé sa visibilité).
--  Un artiste sponsorisé porte automatiquement le badge « Sponsorisé »
--  sur sa carte dans l'app — transparence non négociable.
--
--  ⚠️ Tant que cette migration n'est pas lancée, l'app fonctionne normalement
--  (elle se replie sur l'ancien format : tout est traité comme éditorial).
-- ════════════════════════════════════════════════════════════════════════

alter table public.boosted_artists
  add column if not exists sponsored boolean not null default false;

-- Le jour où un artiste paie, une seule ligne à exécuter (exemple) :
-- update public.boosted_artists set sponsored = true, weight = 1.5
--   where artist_id = 123456;

-- Et à la fin de sa campagne :
-- update public.boosted_artists set active = false where artist_id = 123456;

-- Vérification :
select artist_id, name, weight, sponsored, active from public.boosted_artists;
