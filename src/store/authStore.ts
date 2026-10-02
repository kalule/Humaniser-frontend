import { create } from 'zustand'
import type { AuthResponse, UserDto } from '../types'
import { tokenRef } from '../lib/tokenRef'

interface AuthState {
  user: UserDto | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (data: AuthResponse) => void
  logout: () => void
  updateUser: (user: Partial<UserDto>) => void
  setLoading: (v: boolean) => void
  initialize: () => Promise<void>
}

// React StrictMode intentionally re-runs mount effects in development. Keep session
// bootstrap single-flight so two refresh requests cannot rotate the same cookie and
// race each other. The revision also prevents an older bootstrap response from
// overwriting a login/logout that happened while the request was in flight.
let initializationPromise: Promise<void> | null = null
let authRevision = 0

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  // Session restoration runs after React mounts. Start in the loading state so
  // route guards cannot discard a deep link during the first render.
  isLoading: true,

  login: (data: AuthResponse) => {
    authRevision += 1
    tokenRef.current = data.accessToken
    set({
      user: data.user,
      token: data.accessToken,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: () => {
    authRevision += 1
    tokenRef.current = null
    set({ user: null, token: null, isAuthenticated: false, isLoading: false })
  },

  updateUser: (partial: Partial<UserDto>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    }))
  },

  setLoading: (v: boolean) => set({ isLoading: v }),

  initialize: async () => {
    if (initializationPromise) return initializationPromise

    // On app start, attempt a silent refresh using the httpOnly cookie.
    // If the cookie is valid the server returns a new access token and the
    // user object; if not (cookie expired / not present) it returns 401 and
    // we stay unauthenticated.
    const revisionAtStart = authRevision
    set({ isLoading: true })

    initializationPromise = (async () => {
      try {
        const { authApi } = await import('../api/auth')
        const response = await authApi.refreshToken()

        if (authRevision !== revisionAtStart) return

        const data = response.data
        tokenRef.current = data.accessToken
        set({
          user: data.user,
          token: data.accessToken,
          isAuthenticated: true,
          isLoading: false,
        })
      } catch {
        if (authRevision !== revisionAtStart) return

        tokenRef.current = null
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      } finally {
        initializationPromise = null
      }
    })()

    return initializationPromise
  },
}))
