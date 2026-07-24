// PMS API. A 1:1 port of app/pms/api.py + app/auth/router.py onto Hono/Deno.
//
// Deliberately ONE function with internal routing rather than a function per endpoint:
// every deployed Edge Function cold-starts independently, so splitting these would
// multiply cold starts for no benefit.
//
// Deployed with verify_jwt = false. That is NOT "no auth" -- it is required because two
// auth lanes coexist and the platform gate only understands one of them: user routes
// carry a Supabase JWT, while the on-prem collector authenticates with X-Collector-Token
// (it has no user session). Both are enforced below, per route group.
import { Hono } from 'hono'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  etiquetaCampo,
  impresoraEnSitioWrite, impresoraWrite, listaSimple, listaSuministros, listaTransacciones,
  passwordChange, suministroWrite, telemetriaBatch, transaccionCreate, usuarioCreate, usuarioUpdate,
} from './schemas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const COLLECTOR_TOKEN = Deno.env.get('COLLECTOR_TOKEN') ?? ''
const STALE_MINUTES = Number(Deno.env.get('TELEMETRY_STALE_MINUTES') ?? '15')
const EMAIL_DOMAIN = Deno.env.get('PMS_EMAIL_DOMAIN') ?? 'pms.local'
// An origin allowlist is public information, so the deployed frontend is the default
// rather than something you must remember to set as a secret. ALLOWED_ORIGINS still
// overrides it -- set that when adding a custom domain.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://pms-8pn.pages.dev,http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean)

// Cloudflare also gives every single deployment its own <hash>.<project>.pages.dev
// URL, and the dashboard links to THAT rather than to the production alias -- so the
// URL people actually click is not the one in the list above. Those hostnames can
// only be produced by this project, so trusting the suffix is safe.
// The leading dot matters: it stops "evilpms-8pn.pages.dev" from matching.
const ORIGIN_SUFFIX = Deno.env.get('ALLOWED_ORIGIN_SUFFIX') ?? '.pms-8pn.pages.dev'

function originAllowed(origin: string): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return ORIGIN_SUFFIX !== '' && origin.startsWith('https://') && origin.endsWith(ORIGIN_SUFFIX)
}

// service_role bypasses the deny-all RLS on every pms_* table.
const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const USUARIO_COLS = 'id,username,nombre,activo,creado_en,rol,debe_cambiar_password'
// Every supply carries its printer's display name so listing screens can tell apart
// the five different "Black Toner" rows without dumping the whole compatible-models
// string. The FK is unambiguous, so the embed resolves cleanly.
const SUMINISTRO_SEL = '*, impresora:pms_impresora(nombre_para_mostrar)'
const IMPRESORA_SEL = '*, suministros:pms_suministro(*)'
const SITIO_SEL = '*, impresora:pms_impresora(id,nombre,nombre_para_mostrar,picture_url), telemetria:pms_telemetria_impresora(*)'
const TRANSACCION_SEL = `*, suministro:pms_suministro(*, impresora:pms_impresora(nombre_para_mostrar)), usuario:pms_usuario(${USUARIO_COLS})`

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Rol = 'superuser' | 'admin'
type Usuario = { id: number; username: string; nombre: string; activo: boolean; creado_en: string; auth_user_id: string; rol: Rol; debe_cambiar_password: boolean }

// ---------------------------------------------------------------- helpers

/**
 * Unwrap a PostgREST result, translating database errors into HTTP ones.
 *
 * Raw Postgres text is never forwarded to the user: it is English and it leaks column
 * and constraint names. Anything unrecognised is logged and reported generically.
 */
function unwrap<T>(res: { data: T | null; error: { code?: string; message: string } | null }, conflict?: string): T {
  if (res.error) {
    const code = res.error.code ?? ''
    // The PTxxx SQLSTATEs raised by crear_transaccion / revertir_transaccion carry
    // messages this codebase wrote, in Spanish, so they pass through verbatim.
    if (/^PT\d{3}$/.test(code)) throw new ApiError(Number(code.slice(2)), res.error.message)
    if (code === '23505') throw new ApiError(409, conflict ?? 'Ya existe un registro con esos datos')
    if (code === '23503') throw new ApiError(409, conflict ?? 'No se puede completar: el registro está relacionado con otros datos')
    if (code === '23514') throw new ApiError(400, 'Alguno de los datos no cumple las reglas del sistema')
    if (code === '22P02') throw new ApiError(400, 'Alguno de los datos tiene un formato incorrecto')
    console.error('postgrest', code, res.error.message)
    throw new ApiError(500, 'No se pudo completar la operación. Inténtalo de nuevo.')
  }
  return res.data as T
}

/** Supabase Auth replies in English; map the cases a user can actually cause. */
function mensajeAuth(error: { message: string }, respaldo: string): string {
  const m = error.message.toLowerCase()
  if (m.includes('should be at least') || m.includes('password should be')) {
    return 'La contraseña debe tener al menos 8 caracteres'
  }
  if (m.includes('different from the old')) return 'La contraseña nueva debe ser distinta de la actual'
  if (m.includes('weak') || m.includes('pwned') || m.includes('compromised')) {
    return 'Esa contraseña es demasiado común. Elige una más segura.'
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'El nombre de usuario ya existe'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  }
  console.error('auth', error.message)
  return respaldo
}

const page = <T>(items: T[], total: number, current: number, size: number) => ({
  items, total, page: current, page_size: size,
})

const range = (current: number, size: number): [number, number] => [(current - 1) * size, current * size - 1]

/** PostgREST splits or() on commas, so user input has to be double-quoted. */
const like = (term: string) => `"%${term.trim().replace(/["\\]/g, '')}%"`

function sitePayload(site: Record<string, any>) {
  const raw = Array.isArray(site.telemetria) ? site.telemetria[0] : site.telemetria
  let telemetria = null
  if (raw) {
    const observed = new Date(raw.observada_en).getTime()
    telemetria = {
      observada_en: raw.observada_en,
      disponible: raw.disponible,
      obsoleta: observed < Date.now() - STALE_MINUTES * 60_000,
      error: raw.error,
      nombre_dispositivo: raw.nombre_dispositivo,
      serie: raw.serie,
      notificaciones: raw.notificaciones ?? [],
      toners: raw.toners ?? [],
      cartucho: raw.cartucho,
      consumo: raw.consumo,
    }
  }
  return {
    id: site.id, nombre: site.nombre, ip: site.ip, a_color: site.a_color,
    impresora: site.impresora, telemetria,
  }
}

async function getPrinter(id: number) {
  const { data } = await db.from('pms_impresora').select('*').eq('id', id).maybeSingle()
  if (!data) throw new ApiError(404, 'No se encontró la impresora')
  return data
}

async function getSupply(id: number) {
  const { data } = await db.from('pms_suministro').select(SUMINISTRO_SEL).eq('id', id).maybeSingle()
  if (!data) throw new ApiError(404, 'No se encontró el suministro')
  return data
}

async function getSite(id: number) {
  const { data } = await db.from('pms_impresora_en_sitio').select(SITIO_SEL).eq('id', id).maybeSingle()
  if (!data) throw new ApiError(404, 'No se encontró el equipo')
  return data
}

async function readBody<T>(c: any, schema: { safeParse: (v: unknown) => any }): Promise<T> {
  const raw = await c.req.json().catch(() => null)
  if (raw === null) throw new ApiError(422, 'No recibimos los datos del formulario. Inténtalo de nuevo.')
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    // "Stock mínimo: debe ser 0 o más" reads like a form hint; the raw zod path and
    // English default did not.
    const detail = parsed.error.issues
      .map((i: any) => `${etiquetaCampo(i.path)}: ${i.message.charAt(0).toLowerCase()}${i.message.slice(1)}`)
      .join('. ')
    throw new ApiError(422, detail)
  }
  return parsed.data as T
}

function readQuery<T>(c: any, schema: { safeParse: (v: unknown) => any }): T {
  const parsed = schema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!parsed.success) throw new ApiError(422, 'Los filtros de búsqueda no son válidos')
  return parsed.data as T
}

const emailFor = (username: string) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`

/** La sección de usuarios es solo para superusuarios. */
function requireSuperuser(c: any): Usuario {
  const usuario = c.get('usuario') as Usuario
  if (usuario.rol !== 'superuser') throw new ApiError(403, 'No tienes permiso para administrar usuarios')
  return usuario
}

/** Length is allowed to leak, exactly as hmac.compare_digest does. */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length || ea.length === 0) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

// ---------------------------------------------------------------- app

const app = new Hono().basePath('/pms')

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') ?? ''
  const allowed = originAllowed(origin) ? origin : ''
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-collector-token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    })
  }
  await next()
  if (allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', allowed)
    c.res.headers.set('Vary', 'Origin')
  }
})

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ detail: err.message }, err.status as any)
  console.error('unhandled', err)
  return c.json({ detail: 'Ocurrió un error inesperado. Inténtalo de nuevo en un momento.' }, 500)
})

// --- auth lanes -------------------------------------------------

/**
 * Resolves the caller's domain profile from their JWT in a single round trip:
 * PostgREST verifies the token signature before pms_usuario_actual() can see
 * auth.uid(), and the function itself filters on `activo`.
 */
async function currentUser(c: any): Promise<Usuario> {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new ApiError(401, 'Inicia sesión para continuar')
  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await scoped.rpc('pms_usuario_actual')
  // A composite return type yields a row of nulls (not zero rows) when auth.uid()
  // matches nothing, so the id has to be checked explicitly.
  if (error || !data || data.id === null) throw new ApiError(401, 'Tu sesión expiró. Ingresa de nuevo.')
  return data as Usuario
}

app.use('/*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/pms/collector/')) {
    const token = c.req.header('X-Collector-Token') ?? ''
    if (!COLLECTOR_TOKEN || !timingSafeEqual(token, COLLECTOR_TOKEN)) {
      throw new ApiError(401, 'Credencial del colector inválida')
    }
  } else {
    c.set('usuario', await currentUser(c))
  }
  await next()
})

// --- auth -------------------------------------------------------

app.get('/auth/me', (c) => {
  const { auth_user_id: _ignored, ...perfil } = c.get('usuario') as Usuario
  return c.json(perfil)
})

app.post('/auth/change-password', async (c) => {
  const usuario = c.get('usuario') as Usuario
  const data = await readBody<{ password_actual: string; password_nuevo: string }>(c, passwordChange)
  // Verify the current password by actually attempting a sign-in; there is no
  // "check this password" admin call.
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await anon.auth.signInWithPassword({
    email: emailFor(usuario.username),
    password: data.password_actual,
  })
  if (error) throw new ApiError(400, 'La contraseña actual no coincide')
  const updated = await db.auth.admin.updateUserById(usuario.auth_user_id, { password: data.password_nuevo })
  if (updated.error) throw new ApiError(400, mensajeAuth(updated.error, 'No se pudo cambiar la contraseña'))
  // Al cambiar la contraseña se cumple el cambio obligatorio del primer ingreso.
  await db.from('pms_usuario').update({ debe_cambiar_password: false }).eq('id', usuario.id)
  return c.body(null, 204)
})

// --- dashboard --------------------------------------------------

app.get('/dashboard', async (c) => {
  const supplies = unwrap(await db.from('pms_suministro').select('stock,stock_minimo,stock_bajo'))
  const sites = unwrap(await db.from('pms_impresora_en_sitio').select('id, telemetria:pms_telemetria_impresora(observada_en,disponible)'))
  const recent = unwrap(await db.from('pms_transaccion').select(TRANSACCION_SEL).order('id', { ascending: false }).limit(5))

  const staleBefore = Date.now() - STALE_MINUTES * 60_000
  let disponibles = 0, obsoletos = 0, sinConexion = 0
  for (const site of sites as any[]) {
    const t = Array.isArray(site.telemetria) ? site.telemetria[0] : site.telemetria
    if (!t) { obsoletos++; continue }
    if (new Date(t.observada_en).getTime() < staleBefore) obsoletos++
    else if (t.disponible) disponibles++
    else sinConexion++
  }

  return c.json({
    stock_total: (supplies as any[]).reduce((sum, s) => sum + s.stock, 0),
    suministros_total: (supplies as any[]).length,
    stock_bajo: (supplies as any[]).filter((s) => s.stock_bajo).length,
    sin_stock: (supplies as any[]).filter((s) => s.stock === 0).length,
    equipos: { total: (sites as any[]).length, disponibles, sin_conexion: sinConexion, obsoletos },
    movimientos_recientes: recent,
  })
})

// --- impresoras -------------------------------------------------

app.get('/impresoras', async (c) =>
  c.json(unwrap(await db.from('pms_impresora').select(IMPRESORA_SEL).order('nombre_para_mostrar'))))

app.post('/impresoras', async (c) => {
  const data = await readBody(c, impresoraWrite)
  return c.json(unwrap(await db.from('pms_impresora').insert(data).select(IMPRESORA_SEL).single()), 201)
})

app.get('/impresoras/:id', async (c) => {
  const { data } = await db.from('pms_impresora').select(IMPRESORA_SEL).eq('id', Number(c.req.param('id'))).maybeSingle()
  if (!data) throw new ApiError(404, 'No se encontró la impresora')
  return c.json(data)
})

app.put('/impresoras/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getPrinter(id)
  const data = await readBody(c, impresoraWrite)
  return c.json(unwrap(await db.from('pms_impresora').update(data).eq('id', id).select(IMPRESORA_SEL).single()))
})

app.delete('/impresoras/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getPrinter(id)
  const supplies = unwrap(await db.from('pms_suministro').select('id').eq('impresora_id', id).limit(1))
  const sites = unwrap(await db.from('pms_impresora_en_sitio').select('id').eq('impresora_id', id).limit(1))
  if ((supplies as any[]).length || (sites as any[]).length) {
    throw new ApiError(409, 'No puedes eliminar este modelo porque tiene suministros o equipos asociados')
  }
  unwrap(await db.from('pms_impresora').delete().eq('id', id).select('id'))
  return c.body(null, 204)
})

// --- suministros ------------------------------------------------

app.get('/suministros', async (c) => {
  const q = readQuery<any>(c, listaSuministros)
  let query = db.from('pms_suministro').select(SUMINISTRO_SEL, { count: 'exact' })
  if (q.q) query = query.or(`nombre.ilike.${like(q.q)},sku.ilike.${like(q.q)},upc.ilike.${like(q.q)}`)
  if (q.tipo) query = query.eq('tipo_suministro', q.tipo)
  if (q.impresora_id) query = query.eq('impresora_id', q.impresora_id)
  if (q.estado === 'bajo') query = query.eq('stock_bajo', true)
  else if (q.estado === 'agotado') query = query.eq('stock', 0)
  else if (q.estado === 'normal') query = query.eq('stock_bajo', false)
  const [from, to] = range(q.page, q.page_size)
  const res = await query.order('nombre').range(from, to)
  return c.json(page(unwrap(res) as any[], res.count ?? 0, q.page, q.page_size))
})

app.post('/suministros', async (c) => {
  const data = await readBody<any>(c, suministroWrite)
  await getPrinter(data.impresora_id)
  const created = unwrap(
    await db.from('pms_suministro').insert({ ...data, stock: 0 }).select(SUMINISTRO_SEL).single(),
    'El SKU o UPC ya existe',
  )
  return c.json(created, 201)
})

app.get('/suministros/:id', async (c) => c.json(await getSupply(Number(c.req.param('id')))))

app.put('/suministros/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getSupply(id)
  const data = await readBody<any>(c, suministroWrite)
  await getPrinter(data.impresora_id)
  return c.json(unwrap(
    await db.from('pms_suministro').update(data).eq('id', id).select(SUMINISTRO_SEL).single(),
    'El SKU o UPC ya existe',
  ))
})

app.delete('/suministros/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getSupply(id)
  const movements = unwrap(await db.from('pms_transaccion').select('id').eq('suministro_id', id).limit(1))
  if ((movements as any[]).length) throw new ApiError(409, 'No puedes eliminar este suministro porque ya tiene movimientos registrados')
  unwrap(await db.from('pms_suministro').delete().eq('id', id).select('id'))
  return c.body(null, 204)
})

// --- impresoras en sitio ----------------------------------------

app.get('/impresoras-en-sitio', async (c) => {
  const q = readQuery<any>(c, listaSimple)
  let query = db.from('pms_impresora_en_sitio').select(SITIO_SEL, { count: 'exact' })
  if (q.q) query = query.or(`nombre.ilike.${like(q.q)},ip.ilike.${like(q.q)}`)
  const [from, to] = range(q.page, q.page_size)
  const res = await query.order('nombre').range(from, to)
  return c.json(page((unwrap(res) as any[]).map(sitePayload), res.count ?? 0, q.page, q.page_size))
})

app.post('/impresoras-en-sitio', async (c) => {
  const data = await readBody<any>(c, impresoraEnSitioWrite)
  await getPrinter(data.impresora_id)
  const created = unwrap(
    await db.from('pms_impresora_en_sitio').insert(data).select('id').single(),
    'El nombre o IP ya existe',
  )
  return c.json(sitePayload(await getSite((created as any).id)), 201)
})

app.get('/impresoras-en-sitio/:id', async (c) => c.json(sitePayload(await getSite(Number(c.req.param('id'))))))

app.put('/impresoras-en-sitio/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getSite(id)
  const data = await readBody<any>(c, impresoraEnSitioWrite)
  await getPrinter(data.impresora_id)
  unwrap(await db.from('pms_impresora_en_sitio').update(data).eq('id', id).select('id').single(), 'El nombre o IP ya existe')
  return c.json(sitePayload(await getSite(id)))
})

app.delete('/impresoras-en-sitio/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await getSite(id)
  unwrap(await db.from('pms_impresora_en_sitio').delete().eq('id', id).select('id'))
  return c.body(null, 204)
})

// `/snmp` is the legacy alias kept from api.py.
for (const suffix of ['telemetry', 'snmp']) {
  app.get(`/impresoras-en-sitio/:id/${suffix}`, async (c) => {
    const payload = sitePayload(await getSite(Number(c.req.param('id')))).telemetria
    if (!payload) throw new ApiError(404, 'El colector aún no ha enviado datos de este equipo')
    return c.json(payload)
  })
}

// --- transacciones ----------------------------------------------

app.get('/transacciones', async (c) => {
  const q = readQuery<any>(c, listaTransacciones)
  let query = db.from('pms_transaccion').select(TRANSACCION_SEL, { count: 'exact' })
  if (q.tipo) query = query.eq('tipo_transaccion', q.tipo)
  if (q.suministro_id) query = query.eq('suministro_id', q.suministro_id)
  const [from, to] = range(q.page, q.page_size)
  const res = await query.order('id', { ascending: false }).range(from, to)
  return c.json(page(unwrap(res) as any[], res.count ?? 0, q.page, q.page_size))
})

app.get('/transacciones/:id', async (c) => {
  const { data } = await db.from('pms_transaccion').select(TRANSACCION_SEL).eq('id', Number(c.req.param('id'))).maybeSingle()
  if (!data) throw new ApiError(404, 'No se encontró el movimiento')
  return c.json(data)
})

const readTransaction = async (id: number) =>
  unwrap(await db.from('pms_transaccion').select(TRANSACCION_SEL).eq('id', id).single())

app.post('/transacciones', async (c) => {
  const usuario = c.get('usuario') as Usuario
  const data = await readBody<any>(c, transaccionCreate)
  // Row locking and the stock rules live in the database -- see the movimientos
  // migration. An in-process lock cannot work across Edge Function instances.
  const id = unwrap(await db.rpc('crear_transaccion', {
    p_suministro_id: data.suministro_id,
    p_cantidad: data.cantidad_afectada,
    p_tipo: data.tipo_transaccion,
    p_usuario_id: usuario.id,
  }))
  return c.json(await readTransaction(id as number), 201)
})

app.post('/transacciones/:id/revertir', async (c) => {
  const usuario = c.get('usuario') as Usuario
  const id = unwrap(await db.rpc('revertir_transaccion', {
    p_transaccion_id: Number(c.req.param('id')),
    p_usuario_id: usuario.id,
  }))
  return c.json(await readTransaction(id as number), 201)
})

// --- usuarios ---------------------------------------------------

app.get('/usuarios', async (c) => {
  requireSuperuser(c)
  const q = readQuery<any>(c, listaSimple)
  let query = db.from('pms_usuario').select(USUARIO_COLS, { count: 'exact' })
  if (q.q) query = query.or(`username.ilike.${like(q.q)},nombre.ilike.${like(q.q)}`)
  const [from, to] = range(q.page, q.page_size)
  const res = await query.order('nombre').range(from, to)
  return c.json(page(unwrap(res) as any[], res.count ?? 0, q.page, q.page_size))
})

app.post('/usuarios', async (c) => {
  requireSuperuser(c)
  const data = await readBody<any>(c, usuarioCreate)
  const username = data.username.trim().toLowerCase()
  const existing = unwrap(await db.from('pms_usuario').select('id').eq('username', username).limit(1))
  if ((existing as any[]).length) throw new ApiError(409, 'El nombre de usuario ya existe')

  // The admin API sets the confirmation/recovery token columns that GoTrue later
  // scans into non-nullable strings; hand-written INSERTs into auth.users do not.
  const created = await db.auth.admin.createUser({
    email: emailFor(username),
    password: data.password,
    email_confirm: true,
    user_metadata: { username },
  })
  if (created.error) throw new ApiError(409, mensajeAuth(created.error, 'No se pudo crear el usuario'))

  // Todo usuario nuevo cambia su contraseña en el primer ingreso.
  const res = await db.from('pms_usuario')
    .insert({ username, nombre: data.nombre.trim(), activo: true, auth_user_id: created.data.user.id, rol: data.rol, debe_cambiar_password: true })
    .select(USUARIO_COLS).single()
  if (res.error) {
    // Do not leave an orphaned auth identity behind if the profile insert fails.
    await db.auth.admin.deleteUser(created.data.user.id)
    throw new ApiError(409, 'El nombre de usuario ya existe')
  }
  return c.json(res.data, 201)
})

app.patch('/usuarios/:id', async (c) => {
  const actual = requireSuperuser(c)
  const id = Number(c.req.param('id'))
  const { data: user } = await db.from('pms_usuario').select('*').eq('id', id).maybeSingle()
  if (!user) throw new ApiError(404, 'No se encontró el usuario')
  const data = await readBody<any>(c, usuarioUpdate)

  const patch: Record<string, unknown> = {}
  if (data.nombre !== undefined) patch.nombre = data.nombre
  if (data.rol !== undefined) {
    // No permitir que un superusuario se quite a sí mismo el rol y se quede sin acceso.
    if (data.rol !== 'superuser' && user.id === actual.id) {
      throw new ApiError(400, 'No puedes quitarte tu propio rol de superusuario')
    }
    patch.rol = data.rol
  }
  if (data.activo !== undefined) {
    if (data.activo === false) {
      if (user.id === actual.id) throw new ApiError(400, 'No puedes desactivar tu propia cuenta')
      const active = unwrap(await db.from('pms_usuario').select('id').eq('activo', true))
      if ((active as any[]).length <= 1) throw new ApiError(400, 'Debe existir al menos una cuenta activa')
    }
    patch.activo = data.activo
    // pms_usuario_actual() already refuses inactive accounts, which kills existing
    // sessions' API access; banning additionally blocks a fresh sign-in.
    if (user.auth_user_id) {
      await db.auth.admin.updateUserById(user.auth_user_id, {
        ban_duration: data.activo ? 'none' : '876000h',
      })
    }
  }
  if (data.password !== undefined && user.auth_user_id) {
    const updated = await db.auth.admin.updateUserById(user.auth_user_id, { password: data.password })
    if (updated.error) throw new ApiError(400, mensajeAuth(updated.error, 'No se pudo actualizar la contraseña'))
  }

  if (Object.keys(patch).length === 0) return c.json(unwrap(await db.from('pms_usuario').select(USUARIO_COLS).eq('id', id).single()))
  return c.json(unwrap(await db.from('pms_usuario').update(patch).eq('id', id).select(USUARIO_COLS).single()))
})

// --- apks -------------------------------------------------------

/** Mirrors latest_apk() in api.py: highest trailing _<n>, else most recently modified. */
async function latestApk() {
  const { data, error } = await db.storage.from('apks').list('', { limit: 1000 })
  if (error) {
    console.error('storage.list', error.message)
    throw new ApiError(500, 'No pudimos consultar la aplicación Android. Inténtalo más tarde.')
  }
  const apks = (data ?? []).filter((f) => f.name.toLowerCase().endsWith('.apk'))
  if (!apks.length) throw new ApiError(404, 'No hay una aplicación Android disponible')
  const versioned = apks
    .map((f) => ({ file: f, version: Number(f.name.replace(/\.apk$/i, '').split('_').pop()) }))
    .filter((x) => Number.isInteger(x.version))
  if (versioned.length) return versioned.reduce((a, b) => (b.version > a.version ? b : a))
  const newest = apks.reduce((a, b) =>
    new Date(b.updated_at ?? 0) > new Date(a.updated_at ?? 0) ? b : a)
  return { file: newest, version: 0 }
}

app.get('/apks/latest_version', async (c) => {
  const { file, version } = await latestApk()
  return c.json({ version, filename: file.name })
})

// Returns the signed URL rather than redirecting: the browser follows a redirect
// without the Authorization header, and the bucket is private.
app.get('/apks/download_apk', async (c) => {
  const { file } = await latestApk()
  const { data, error } = await db.storage.from('apks').createSignedUrl(file.name, 300, { download: true })
  if (error || !data) {
    console.error('storage.signedUrl', error?.message)
    throw new ApiError(500, 'No pudimos preparar la descarga. Inténtalo de nuevo.')
  }
  return c.json({ url: data.signedUrl, filename: file.name })
})

// --- collector --------------------------------------------------

app.get('/collector/devices', async (c) => {
  const devices = unwrap(await db.from('pms_impresora_en_sitio')
    .select('id,nombre,ip,a_color, impresora:pms_impresora(nombre_para_mostrar)').order('id'))
  return c.json((devices as any[]).map((d) => ({
    id: d.id, nombre: d.nombre, ip: d.ip, a_color: d.a_color,
    modelo: d.impresora?.nombre_para_mostrar,
  })))
})

app.post('/collector/telemetry', async (c) => {
  const batch = await readBody<any>(c, telemetriaBatch)
  const known = new Set((unwrap(await db.from('pms_impresora_en_sitio').select('id')) as any[]).map((s) => s.id))
  const rows = batch.items
    .filter((item: any) => known.has(item.impresora_en_sitio_id))
    .map((item: any) => ({ ...item }))
  if (rows.length) {
    // One row per site, overwritten each cycle -- hence upsert on the unique FK
    // rather than an append.
    unwrap(await db.from('pms_telemetria_impresora')
      .upsert(rows, { onConflict: 'impresora_en_sitio_id' }).select('id'))
  }
  return c.json({ updated: rows.length })
})

Deno.serve(app.fetch)
