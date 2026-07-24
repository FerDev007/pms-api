-- Move authentication off the hand-rolled cookie sessions and onto Supabase Auth.
--
-- The API and the PWA now live on different origins (*.supabase.co vs Cloudflare
-- Pages), which would have forced SameSite=None cookies -- routinely dropped by iOS
-- Safari and by installed PWAs. A bearer JWT sidesteps that, and is not CSRF-able, so
-- the Origin==Host middleware in app/main.py goes away with it.
--
-- pms_usuario survives as the domain profile: it carries `nombre`/`activo` and is
-- referenced by pms_transaccion.usuario_id, so the audit trail depends on it.

drop table if exists pms_sesion;

-- Passwords live in auth.users now; nothing reads this column any more.
alter table pms_usuario drop column password_hash;

alter table pms_usuario
    add column auth_user_id uuid unique references auth.users (id) on delete set null;

comment on column pms_usuario.auth_user_id is
    'Links the domain profile to its Supabase Auth identity. Usernames map to the '
    'synthetic email <username>@pms.local, which is what the PWA signs in with.';

-- Resolve the calling JWT to a domain user. Used by the Edge Function on every
-- authenticated request. SECURITY DEFINER so it can read pms_usuario past the
-- deny-all RLS, with an empty search_path so the body cannot be hijacked by a
-- caller-controlled schema.
create or replace function pms_usuario_actual()
returns pms_usuario
language sql
stable
security definer
set search_path = ''
as $$
    select u.*
    from public.pms_usuario u
    where u.auth_user_id = auth.uid()
      and u.activo
$$;
