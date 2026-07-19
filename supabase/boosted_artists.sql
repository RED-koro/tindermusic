-- ════════════════════════════════════════════════════════════════════════
--  Tune — boost éditorial partagé
--  À lancer UNE FOIS dans Supabase : Dashboard → SQL Editor → colle → Run.
--  Rôle sain (≠ upload d'artiste retiré au pivot) : toi seul pousses des
--  artistes émergents pour tous les utilisateurs, sans republier l'app.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.boosted_artists (
  artist_id  bigint primary key,             -- id Deezer de l'artiste
  name       text,                            -- pour t'y retrouver dans le tableau
  weight     real    not null default 1,      -- force du boost (1 = normal, 2 = fort)
  sponsored  boolean not null default false,  -- true = l'artiste a payé (badge affiché)
  active     boolean not null default true,   -- décoche pour retirer sans supprimer
  note       text,                            -- pourquoi tu le pousses (optionnel)
  created_at timestamptz not null default now()
);

-- Sécurité : l'app (clé anon) ne peut que LIRE les artistes actifs.
-- L'écriture reste réservée à toi, depuis le dashboard Supabase.
alter table public.boosted_artists enable row level security;

drop policy if exists "lecture publique des boosts actifs" on public.boosted_artists;
create policy "lecture publique des boosts actifs"
  on public.boosted_artists
  for select
  using (active = true);

-- Exemple : pousse tes 4 artistes maison (ids Deezer de src/lib/featured.ts).
-- Modifie/ajoute des lignes quand tu veux — l'app suivra au prochain chargement.
insert into public.boosted_artists (artist_id, name, weight) values
  (13586547,  'Yohann Zveig', 1.5),
  (394647281, 'NoLaDiK',      1.5),
  (5596957,   'Vincent Bidal',1.5),
  (381242471, 'Mélanie Noé',  1.5)
on conflict (artist_id) do nothing;
