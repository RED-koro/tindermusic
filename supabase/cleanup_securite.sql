-- ════════════════════════════════════════════════════════════════════════
--  Tune — nettoyage sécurité (12 juillet 2026)
--  À lancer UNE FOIS : Dashboard Supabase → SQL Editor → colle → Run.
--
--  Objectif : supprimer tous les restes de l'ancien "espace artiste" (retiré
--  au pivot). Il ne doit plus rester que la table `boosted_artists` (lecture
--  seule), seule chose que l'app utilise encore.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Ancienne table des titres publiés par les artistes (vide, plus utilisée)
drop table if exists public.tracks cascade;

-- 2. Anciens buckets de stockage (fichiers audio + pochettes des uploads).
--    On vide puis on supprime. S'ils sont déjà vides, la 1re ligne ne fait rien.
delete from storage.objects where bucket_id in ('audio', 'covers', 'tracks');
delete from storage.buckets  where id       in ('audio', 'covers', 'tracks');

-- 3. Vérification : il ne doit RESTER que `boosted_artists`.
--    (Regarde le résultat : une seule ligne « boosted_artists » attendue.)
select tablename
from pg_tables
where schemaname = 'public';

-- ════════════════════════════════════════════════════════════════════════
--  ⚠️ À FAIRE AUSSI, à la main (pas en SQL) — couper l'authentification
--  anonyme, devenue inutile :
--    Dashboard → Authentication → Sign In / Providers → Anonymous → OFF
--  (avant : n'importe qui pouvait créer des comptes anonymes en boucle avec
--   la clé publique. On n'en a plus besoin : la lecture des boosts est
--   publique et ne demande aucune connexion.)
-- ════════════════════════════════════════════════════════════════════════
