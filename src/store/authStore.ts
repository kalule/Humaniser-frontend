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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: (data: AuthResponse) => {
    tokenRef.current = data.accessToken
    set({
      user: data.user,
      token: data.accessToken,
      isAuthenticated: true,
    })
  },

  logout: () => {
    tokenRef.current = null
    set({ user: null, token: null, isAuthenticated: false })
  },

  updateUser: (partial: Partial<UserDto>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    }))
  },

  setLoading: (v: boolean) => set({ isLoading: v }),

  initialize: async () => {
    // On app start, attempt a silent refresh using the httpOnly cookie.
    // If the cookie is valid the server returns a new access token and the
    // user object; if not (cookie expired / not present) it returns 401 and
    // we stay unauthenticated.
    set({ isLoading: true })
    try {
      const { authApi } = await import('../api/auth')
      const response = await authApi.refreshToken()
      const data = response.data
      tokenRef.current = data.accessToken
      set({
        user: data.user,
        token: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
