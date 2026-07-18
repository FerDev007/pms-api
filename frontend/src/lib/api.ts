export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
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
