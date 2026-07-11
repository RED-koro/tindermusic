-- ============================================================
--  Tune — schéma Supabase (V2, brique 1 : catalogue partagé)
--  À coller dans Supabase → SQL Editor → Run.
--  Idempotent : on peut le relancer sans casser l'existant.
-- ============================================================

-- 1. La table des titres publiés par les artistes -----------
create table if not exists public.tracks (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  owner         uuid not null references auth.users (id) on delete cascade,
  artist        text not null,
  title         text not null,
  genres        text[] not null default '{}',
  description   text not null default '',
  preview_start integer not null default 0,
  audio_path    text not null,           -- chemin dans le bucket "audio"
  cover_path    text,                    -- chemin dans le bucket "covers" (optionnel)
  status        text not null default 'approved'
                check (status in ('pending', 'approved', 'rejected')),
  reports       integer not null default 0
);

create index if not exists tracks_status_idx on public.tracks (status, created_at desc);
create index if not exists tracks_owner_idx  on public.tracks (owner);

-- 2. Row Level Security : qui a le droit de quoi --------------
alter table public.tracks enable row level security;

-- Tout le monde (même non connecté) lit les titres validés
drop policy if exists "lecture publique des titres validés" on public.tracks;
create policy "lecture publique des titres validés"
  on public.tracks for select
  using (status = 'approved');

-- Un artiste voit aussi ses propres titres (même en attente/masqués)
drop policy if exists "l'artiste voit ses titres" on public.tracks;
create policy "l'artiste voit ses titres"
  on public.tracks for select
  using (auth.uid() = owner);

-- Publier : seulement pour soi-même (identité anonyme incluse)
drop policy if exists "publier pour soi" on public.tracks;
create policy "publier pour soi"
  on public.tracks for insert
  with check (auth.uid() = owner);

-- Modifier / supprimer : seulement ses propres titres
drop policy if exists "gérer ses titres" on public.tracks;
create policy "gérer ses titres"
  on public.tracks for update using (auth.uid() = owner);
drop policy if exists "supprimer ses titres" on public.tracks;
create policy "supprimer ses titres"
  on public.tracks for delete using (auth.uid() = owner);

-- 3. Signalement communautaire (incrément atomique) ----------
-- Permet à n'importe quel auditeur de signaler sans pouvoir tout casser.
create or replace function public.report_track(track_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tracks
     set reports = reports + 1,
         status  = case when reports + 1 >= 1 then 'rejected' else status end
   where id = track_id;
$$;

-- 4. Les deux buckets de stockage (audio + pochettes) --------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true), ('covers', 'covers', true)
on conflict (id) do nothing;

-- Lecture publique des fichiers
drop policy if exists "fichiers publics en lecture" on storage.objects;
create policy "fichiers publics en lecture"
  on storage.objects for select
  using (bucket_id in ('audio', 'covers'));

-- Upload : réservé aux identités connectées (anonymes comprises)
drop policy if exists "upload par les connectés" on storage.objects;
create policy "upload par les connectés"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('audio', 'covers'));

-- Suppression : chacun ne peut effacer que ses propres fichiers
drop policy if exists "supprimer ses fichiers" on storage.objects;
create policy "supprimer ses fichiers"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('audio', 'covers') and owner = auth.uid());

-- ============================================================
--  Fait. La brique "catalogue partagé" est prête côté serveur.
-- ============================================================
