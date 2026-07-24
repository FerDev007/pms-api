-- Fix: the REVOKE ... FROM PUBLIC in the movimientos migration did not actually lock
-- these down. Supabase ships ALTER DEFAULT PRIVILEGES that grant EXECUTE on new public
-- functions to `anon` and `authenticated` *explicitly*, and revoking from PUBLIC does
-- not remove an explicit role grant.
--
-- The effect was that anyone holding the publishable key -- which is embedded in the
-- frontend bundle by design -- could POST /rest/v1/rpc/crear_transaccion and move stock
-- with no authentication, going around the Edge Function entirely. These are
-- SECURITY DEFINER, so they also bypassed the deny-all RLS.
--
-- Stock movements must only ever be reachable through the Edge Function (service_role),
-- which is what establishes who the caller is and fills in p_usuario_id.
revoke execute on function crear_transaccion(integer, integer, text, integer) from anon, authenticated;
revoke execute on function revertir_transaccion(integer, integer) from anon, authenticated;

-- pms_usuario_actual genuinely needs `authenticated`: it is called with the end user's
-- JWT and returns only that user's own row. `anon` has no business calling it.
revoke execute on function pms_usuario_actual() from anon;
