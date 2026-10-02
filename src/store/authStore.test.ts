import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthResponse } from '../types'

const mocks = vi.hoisted(() => ({ refreshToken: vi.fn() }))

vi.mock('../api/auth', () => ({
  authApi: { refreshToken: mocks.refreshToken },
}))

function authResponse(id: string): AuthResponse {
  return {
    accessToken: `token-${id}`,
    refreshToken: '',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id,
      email: `${id}@example.com`,
      plan: 'Free',
      wordsUsed: 0,
      wordsLimit: 500,
      creditsUsed: 0,
      creditsLimit: 10,
      isEmailVerified: true,
      createdAt: new Date(0).toISOString(),
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('authStore session initialization', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.refreshToken.mockReset()
  })

  it('shares one refresh request across concurrent StrictMode initialization calls', async () => {
    const pending = deferred<{ data: AuthResponse }>()
    mocks.refreshToken.mockReturnValue(pending.promise)
    const { useAuthStore } = await import('./authStore')

    const first = useAuthStore.getState().initialize()
    const second = useAuthStore.getState().initialize()

    await vi.waitFor(() => expect(mocks.refreshToken).toHaveBeenCalledTimes(1))
    pending.resolve({ data: authResponse('refreshed-user') })
    await Promise.all([first, second])

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'refreshed-user' },
    })
  })

  it('does not let a stale refresh failure undo a successful login', async () => {
    const pending = deferred<{ data: AuthResponse }>()
    mocks.refreshToken.mockReturnValue(pending.promise)
    const { useAuthStore } = await import('./authStore')

    const initialization = useAuthStore.getState().initialize()
    useAuthStore.getState().login(authResponse('logged-in-user'))
    pending.reject(new Error('stale refresh failed'))
    await initialization

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'logged-in-user' },
      token: 'token-logged-in-user',
    })
  })

  it('does not let a stale refresh success replace a newer login', async () => {
    const pending = deferred<{ data: AuthResponse }>()
    mocks.refreshToken.mockReturnValue(pending.promise)
    const { useAuthStore } = await import('./authStore')

    const initialization = useAuthStore.getState().initialize()
    useAuthStore.getState().login(authResponse('logged-in-user'))
    pending.resolve({ data: authResponse('stale-user') })
    await initialization

    expect(useAuthStore.getState().user?.id).toBe('logged-in-user')
    expect(useAuthStore.getState().token).toBe('token-logged-in-user')
  })
})
