import { supabase } from './supabase'

// The API is no longer same-origin, so requests carry a bearer token instead of a
// cookie. getSession() refreshes an expired access token before handing it over.
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...options.headers
      }
    })
  } catch {
    // fetch only rejects when the request never completed: offline, DNS, or a blocked
    // CORS preflight. The native message is "Failed to fetch", in English.
    throw new ApiError(0, 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((item: {msg:string}) => item.msg).join('. ') : data.detail
    // A body-less failure means the response never reached the API (gateway, timeout),
    // so give something more useful than a bare status code.
    const respaldo = response.status >= 500
      ? 'El servidor no respondió correctamente. Inténtalo de nuevo en un momento.'
      : 'No se pudo completar la solicitud'
    throw new ApiError(response.status, detail || respaldo)
  }
  return data as T
}

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
