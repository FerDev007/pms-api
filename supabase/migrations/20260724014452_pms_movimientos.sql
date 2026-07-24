-- Stock movements as database functions.
--
-- These replace the process-wide `threading.Lock` (movement_lock) in app/pms/api.py,
-- which only ever worked because Render ran exactly one uvicorn worker. Edge Functions
-- run N instances, so an in-process lock would protect nothing.
--
-- Both functions take the same global advisory lock. That is deliberate rather than
-- lazy: "a reversal is only allowed on the single most-recent transaction" is a claim
-- about the whole pms_transaccion table, not about one supply, so locking a single
-- suministro row would still let a concurrent movement on another supply invalidate a
-- reversal between its read of "latest" and its insert. The lock is transaction-scoped
-- and released automatically. Serializing every movement globally is what the Python
-- code already did, and this app has a handful of concurrent users.
--
-- Errors use PTxxx SQLSTATEs so the Edge Function can map them straight onto HTTP
-- status codes. The Spanish messages are copied verbatim from app/pms/api.py -- the
-- PWA surfaces them to users directly.

alter table pms_suministro
    add constraint pms_suministro_stock_no_negativo check (stock >= 0);

alter table pms_transaccion
    add constraint pms_transaccion_tipo_valido check (
        tipo_transaccion in ('entrada', 'salida', 'reversion_entrada', 'reversion_salida')
    );

create or replace function crear_transaccion(
    p_suministro_id integer,
    p_cantidad      integer,
    p_tipo          text,
    p_usuario_id    integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_antes   integer;
    v_despues integer;
    v_id      integer;
begin
    if p_tipo not in ('entrada', 'salida') then
        raise exception 'Tipo de movimiento inválido' using errcode = 'PT400';
    end if;
    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'La cantidad debe ser mayor que cero' using errcode = 'PT400';
    end if;

    perform pg_advisory_xact_lock(hashtext('pms_movimiento'));

    select stock into v_antes
    from public.pms_suministro
    where id = p_suministro_id
    for update;

    if not found then
        raise exception 'No se encontró el suministro' using errcode = 'PT404';
    end if;

    if p_tipo = 'salida' and v_antes < p_cantidad then
        raise exception 'No hay suficiente stock para completar la salida' using errcode = 'PT400';
    end if;

    v_despues := case when p_tipo = 'entrada' then v_antes + p_cantidad else v_antes - p_cantidad end;

    insert into public.pms_transaccion (
        suministro_id, usuario_id, stock_antes, cantidad_afectada, stock_despues, tipo_transaccion
    ) values (
        p_suministro_id, p_usuario_id, v_antes, p_cantidad, v_despues, p_tipo
    )
    returning id into v_id;

    update public.pms_suministro set stock = v_despues where id = p_suministro_id;

    return v_id;
end;
$$;

create or replace function revertir_transaccion(
    p_transaccion_id integer,
    p_usuario_id     integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_ultima  public.pms_transaccion;
    v_stock   integer;
    v_despues integer;
    v_tipo    text;
    v_id      integer;
begin
    perform pg_advisory_xact_lock(hashtext('pms_movimiento'));

    select * into v_ultima
    from public.pms_transaccion
    order by id desc
    limit 1;

    if not found or v_ultima.id <> p_transaccion_id then
        raise exception 'Solo se puede revertir el último movimiento' using errcode = 'PT400';
    end if;

    if v_ultima.tipo_transaccion not in ('entrada', 'salida') then
        raise exception 'Un movimiento de reversión no se puede revertir' using errcode = 'PT400';
    end if;

    select stock into v_stock
    from public.pms_suministro
    where id = v_ultima.suministro_id
    for update;

    if v_ultima.tipo_transaccion = 'entrada' then
        v_despues := v_stock - v_ultima.cantidad_afectada;
        v_tipo    := 'reversion_entrada';
    else
        v_despues := v_stock + v_ultima.cantidad_afectada;
        v_tipo    := 'reversion_salida';
    end if;

    if v_despues < 0 then
        raise exception 'El stock actual no permite esta reversión' using errcode = 'PT400';
    end if;

    insert into public.pms_transaccion (
        suministro_id, usuario_id, stock_antes, cantidad_afectada, stock_despues,
        tipo_transaccion, transaccion_revertida_id
    ) values (
        v_ultima.suministro_id, p_usuario_id, v_stock, v_ultima.cantidad_afectada, v_despues,
        v_tipo, v_ultima.id
    )
    returning id into v_id;

    update public.pms_suministro set stock = v_despues where id = v_ultima.suministro_id;

    return v_id;
end;
$$;

-- Only the Edge Function (service_role) may move stock.
--
-- WARNING: revoking from PUBLIC is NOT sufficient and did not work -- Supabase's
-- ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated *explicitly*, and a
-- revoke from PUBLIC leaves an explicit role grant in place. Fixed in
-- 20260724020549_pms_revocar_rpc.sql. Copy that pattern, not this one.
revoke execute on function crear_transaccion(integer, integer, text, integer) from public;
revoke execute on function revertir_transaccion(integer, integer) from public;
grant  execute on function crear_transaccion(integer, integer, text, integer) to service_role;
grant  execute on function revertir_transaccion(integer, integer) to service_role;

-- Same reasoning for the profile lookup: it is called with the end user's JWT, so
-- `authenticated` needs it, but `anon` does not.
revoke execute on function pms_usuario_actual() from public;
grant  execute on function pms_usuario_actual() to authenticated, service_role;
