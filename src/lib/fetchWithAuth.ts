import { tokenRef } from './tokenRef'

/**
 * fetch with the in-memory access token, for the streaming endpoints that cannot go through the axios client. A 401 means the
 * access token expired: the session is refreshed once (sharing the axios interceptor's refresh) and the request is sent again.
 * Without this, starting a generation with an expired token failed with a bare 401 however often it was retried, until some
 * unrelated axios request happened to refresh the session (seen 2026-11-14: three literature-review starts refused in a row).
 * When the refresh itself fails the original 401 is returned and the caller reports it as before.
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...(init.headers as Record<string, string> | undefined), ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) },
  })
  const res = await send()
  if (res.status !== 401) return res
  try {
    const { refreshSession } = await import('../api/client')
    await refreshSession()
  } catch {
    return res
  }
  return send()
}
