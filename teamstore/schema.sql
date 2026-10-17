-- friction-assist : stockage d'équipe chiffré sur Supabase (temporaire).
-- Le serveur ne voit que des blobs chiffrés côté client. Il ne connaît ni la clé, ni l'auteur d'un blob.
-- Aucun accès direct aux tables : tout passe par des fonctions RPC qui vérifient le jeton d'équipe.
-- À coller dans l'éditeur SQL de Supabase (ou `supabase db push`).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Une équipe = une clé maîtresse K (jamais envoyée ici). On ne stocke que des empreintes :
--   access_hash = sha256(jeton d'accès dérivé de K)        → lire / écrire (tous les membres)
--   admin_hash  = sha256(jeton admin dérivé de la clé admin) → rotation, purge (l'admin seul)
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  access_hash text not null,
  admin_hash  text not null,
  epoch       int  not null default 1,          -- incrémentée à chaque rotation de clé
  created_at  timestamptz not null default now()
);

-- Un blob = un objet chiffré (demande d'aide, solution, signature, vote, certification).
-- Pas d'auteur, pas d'horodatage précis : `seq` sert de curseur, `day` de base à la rétention.
create table if not exists public.blobs (
  seq        bigint generated always as identity primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  kind       text not null check (kind in ('request', 'solution', 'signature', 'vote', 'certification', 'candidate')),
  epoch      int  not null,
  ciphertext text not null check (length(ciphertext) <= 24000),  -- base64url ; ≈ 16 Ko chiffrés max
  day        date not null default current_date,
  expires_at timestamptz not null
);
create index if not exists blobs_team_seq on public.blobs (team_id, seq);

-- Personne ne touche aux tables directement : ni anon, ni authenticated.
alter table public.teams enable row level security;
alter table public.blobs enable row level security;
revoke all on public.teams, public.blobs from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.teams, public.blobs from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.teams, public.blobs from authenticated';
  end if;
end $$;

create or replace function public._hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- Créer une équipe. Le client génère K et la clé admin, et n'envoie que les empreintes des jetons.
create or replace function public.create_team(p_access_hash text, p_admin_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_access_hash !~ '^[0-9a-f]{64}$' or p_admin_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide';
  end if;
  if (select count(*) from public.teams where created_at > now() - interval '1 hour') >= 50 then
    raise exception 'trop de créations d''équipe, réessayer plus tard';
  end if;
  insert into public.teams (access_hash, admin_hash) values (p_access_hash, p_admin_hash) returning id into v_id;
  return v_id;
end $$;

-- Écrire un blob. Refusé si le jeton est faux, si l'époque n'est plus la bonne, ou en cas de rafale.
create or replace function public.put_blob(p_team uuid, p_token text, p_kind text, p_epoch int, p_ciphertext text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_team public.teams; v_seq bigint; v_ttl interval;
begin
  select * into v_team from public.teams where id = p_team;
  if v_team.id is null or v_team.access_hash <> public._hash(p_token) then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  if p_epoch <> v_team.epoch then
    raise exception 'époque périmée : la clé d''équipe a changé' using errcode = '22023';
  end if;
  if (select count(*) from public.blobs where team_id = p_team and day = current_date) >= 2000 then
    raise exception 'quota quotidien atteint';
  end if;
  v_ttl := case p_kind
    when 'request'   then interval '1 day'     -- une demande d'aide n'a de sens que le jour même
    when 'vote'      then interval '30 days'
    when 'signature' then interval '30 days'   -- puis seuls les agrégats de la carte restent (côté client)
    when 'candidate' then interval '30 days'   -- propositions de la boucle de nuit, en attente de la responsable
    else interval '180 days' end;              -- solutions et certifications
  insert into public.blobs (team_id, kind, epoch, ciphertext, expires_at)
  values (p_team, p_kind, p_epoch, p_ciphertext, now() + v_ttl)
  returning seq into v_seq;
  return v_seq;
end $$;

-- Lire les blobs postérieurs à un curseur, éventuellement d'un seul type. Seule l'époque courante est
-- renvoyée. On ne renvoie ni l'heure, ni quoi que ce soit sur l'auteur.
drop function if exists public.list_blobs(uuid, text, bigint, int);
create or replace function public.list_blobs(p_team uuid, p_token text, p_since bigint default 0, p_limit int default 200, p_kind text default null)
returns table (seq bigint, kind text, epoch int, ciphertext text)
language plpgsql security definer set search_path = '' as $$
declare v_epoch int;
begin
  select t.epoch into v_epoch from public.teams t where t.id = p_team and t.access_hash = public._hash(p_token);
  if v_epoch is null then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  return query
    select b.seq, b.kind, b.epoch, b.ciphertext from public.blobs b
    where b.team_id = p_team and b.seq > p_since and b.expires_at > now() and b.epoch = v_epoch
      and (p_kind is null or b.kind = p_kind)
    order by b.seq limit least(greatest(p_limit, 1), 500);
end $$;

-- Rotation (départ d'un membre, fuite d'un lien) : nouvelle clé K', nouvelle empreinte, époque + 1.
-- L'ancien jeton ne donne plus accès à rien. Les blobs des époques précédentes sont effacés : le client
-- admin les a relus AVANT la rotation et republie les solutions sous la nouvelle clé.
create or replace function public.rotate_team(p_team uuid, p_admin_token text, p_new_access_hash text)
returns int
language plpgsql security definer set search_path = '' as $$
declare v_epoch int;
begin
  if p_new_access_hash !~ '^[0-9a-f]{64}$' then raise exception 'empreinte invalide'; end if;
  update public.teams set access_hash = p_new_access_hash, epoch = epoch + 1
  where id = p_team and admin_hash = public._hash(p_admin_token)
  returning epoch into v_epoch;
  if v_epoch is null then raise exception 'accès refusé' using errcode = '42501'; end if;
  delete from public.blobs where team_id = p_team and epoch < v_epoch;
  return v_epoch;
end $$;

-- Purge par l'admin : une solution fausse, un blob indésirable, ou toute l'équipe.
create or replace function public.purge_blob(p_team uuid, p_admin_token text, p_seq bigint)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.teams t where t.id = p_team and t.admin_hash = public._hash(p_admin_token)) then
    raise exception 'accès refusé' using errcode = '42501';
  end if;
  delete from public.blobs where team_id = p_team and seq = p_seq;
  return found;
end $$;

create or replace function public.delete_team(p_team uuid, p_admin_token text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.teams where id = p_team and admin_hash = public._hash(p_admin_token);
  return found;
end $$;

-- Seules ces fonctions sont appelables avec la clé publique (anon). Supabase accorde par défaut
-- l'exécution DIRECTEMENT à anon et authenticated (pas seulement à public) : on la leur retire aussi.
revoke execute on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on all functions in schema public from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.create_team(text, text), public.put_blob(uuid, text, text, int, text),
             public.list_blobs(uuid, text, bigint, int, text), public.rotate_team(uuid, text, text),
             public.purge_blob(uuid, text, bigint), public.delete_team(uuid, text) to anon';
  end if;
end $$;

-- Rétention : purge quotidienne des blobs expirés (pg_cron est disponible sur Supabase).
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('friction-assist-retention', '17 3 * * *', $c$delete from public.blobs where expires_at < now()$c$);
  end if;
end $$;
