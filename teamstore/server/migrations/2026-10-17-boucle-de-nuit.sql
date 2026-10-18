-- Piping Company : boucle de nuit. Nouveau type de bloc « candidate » (propositions de règle et frictions en
-- attente, à valider par la responsable), gardé 30 jours. À coller une fois dans l'éditeur SQL de Supabase.
alter table public.blobs drop constraint if exists blobs_kind_check;
alter table public.blobs add constraint blobs_kind_check
  check (kind in ('request', 'solution', 'signature', 'vote', 'certification', 'candidate'));

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
    when 'request'   then interval '1 day'
    when 'vote'      then interval '30 days'
    when 'signature' then interval '30 days'
    when 'candidate' then interval '30 days'
    else interval '180 days' end;
  insert into public.blobs (team_id, kind, epoch, ciphertext, expires_at)
  values (p_team, p_kind, p_epoch, p_ciphertext, now() + v_ttl)
  returning seq into v_seq;
  return v_seq;
end $$;

revoke execute on function public.put_blob(uuid, text, text, int, text) from public, authenticated;
grant execute on function public.put_blob(uuid, text, text, int, text) to anon;
