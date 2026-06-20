// Backend API for the inventory-tool. All inventory endpoints are authenticated
// by the signed link token (sent as a Bearer header).

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface SessionResponse {
  tenant: { companyName: string | null }
  draft: { items: Record<string, number>; notes: string; status: string } | null
}

interface ApiError extends Error {
  status?: number
}

async function post<T>(path: string, token: string, body?: object): Promise<T> {
  const res = await fetch(`${API_BASE}/inventory${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  })

  if (!res.ok) {
    const err: ApiError = new Error(`Request to ${path} failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export const inventoryApi = {
  session: (token: string) => post<SessionResponse>('/session', token),
  saveDraft: (token: string, items: Record<string, number>, notes: string) =>
    post<{ ok: boolean }>('/draft', token, { items, notes }),
  submit: (token: string, items: Record<string, number>, notes: string, summary: string) =>
    post<{ ok: boolean }>('/submit', token, { items, notes, summary }),
}
