import { supabase } from './supabase'

// The API is no longer same-origin, so requests carry a bearer token instead of a
// cookie. getSession() refreshes an expired access token before handing it over.
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers
    }
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((item: {msg:string}) => item.msg).join('. ') : data.detail
    throw new ApiError(response.status, detail || 'No se pudo completar la solicitud')
  }
  return data as T
}

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
