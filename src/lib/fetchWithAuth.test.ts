import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenRef } from './tokenRef'

const refreshSession = vi.fn()
vi.mock('../api/client', () => ({ refreshSession: () => refreshSession() }))

import { fetchWithAuth } from './fetchWithAuth'

describe('fetchWithAuth', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    tokenRef.current = 'old'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    refreshSession.mockReset()
    tokenRef.current = null
  })

  const auth = (call: number) => (fetchMock.mock.calls[call][1].headers as Record<string, string>).Authorization

  it('sends the request once when the token is accepted', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const res = await fetchWithAuth('/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(auth(0)).toBe('Bearer old')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('refreshes the session once after a 401 and sends the request again with the new token', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(new Response('ok', { status: 200 }))
    refreshSession.mockImplementation(async () => { tokenRef.current = 'new'; return 'new' })

    const res = await fetchWithAuth('/x', { method: 'POST', body: '{"a":1}' })

    expect(res.status).toBe(200)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(auth(1)).toBe('Bearer new')
    expect(fetchMock.mock.calls[1][1].body).toBe('{"a":1}')
  })

  it('returns the 401 when the session cannot be refreshed', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    refreshSession.mockRejectedValue(new Error('expired'))

    const res = await fetchWithAuth('/x')

    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
