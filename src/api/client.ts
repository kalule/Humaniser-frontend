import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import type { ApiError } from '../types'
import { tokenRef } from '../lib/tokenRef'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the httpOnly refresh-token cookie with every request.
  withCredentials: true,
})

// ─── Request interceptor: inject in-memory access token ─────────────────────

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = tokenRef.current
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // FormData uploads must carry a boundary in Content-Type; let the browser set it
    if (config.data instanceof FormData && config.headers) {
      config.headers.delete('Content-Type')
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

// Track whether a token refresh is already in flight so we don't fire multiple.
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function drainQueue(token: string | null, error: unknown = null) {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)))
  failedQueue = []
}

// ─── Response interceptor: unwrap wrapper, handle 401 / 402 / 429 ───────────

client.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    const body = response.data as Record<string, unknown> | null
    if (body !== null && typeof body === 'object' && 'data' in body) {
      response.data = body['data']
    }
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // ── 401 Unauthorized — attempt silent refresh via httpOnly cookie ─────────
    // Skip retry if the failing request IS the refresh endpoint — retrying
    // would loop: refresh→401→refresh→401→...
    const isRefreshRequest = originalRequest.url?.endsWith('/auth/refresh')
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(client(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { authApi } = await import('./auth')
        const response = await authApi.refreshToken()
        const newToken = response.data.accessToken

        // login() writes to tokenRef and Zustand state
        const { useAuthStore } = await import('../store/authStore')
        useAuthStore.getState().login(response.data)

        if (originalRequest.headers)
          originalRequest.headers.Authorization = `Bearer ${newToken}`

        drainQueue(newToken)
        return client(originalRequest)
      } catch (refreshError) {
        drainQueue(null, refreshError)
        tokenRef.current = null
        const { useAuthStore } = await import('../store/authStore')
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // ── 402 Payment Required — Word or Credit limit exceeded ─────────────────
    if (error.response?.status === 402) {
      const body = error.response.data as { error?: { code?: string; details?: Record<string, unknown> } } | null
      const code = body?.error?.code
      const details = (body?.error?.details ?? {}) as Record<string, unknown>

      const used = (details.used as number) ?? 0
      const limit = (details.limit as number) ?? 500
      const resetDate =
        (details.resetDate as string) ??
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

      const { useUiStore } = await import('../store/uiStore')
      if (code === 'CREDIT_LIMIT_EXCEEDED') {
        useUiStore.getState().openCreditLimitModal({ used, limit, resetDate })
      } else {
        useUiStore.getState().openWordLimitModal({ used, limit, resetDate })
      }

      return Promise.reject(error)
    }

    // ── 429 Rate Limited ──────────────────────────────────────────────────────
    if (error.response?.status === 429) {
      const data = error.response.data as Record<string, unknown> | null
      const errorInfo = (data?.error ?? data) as Record<string, unknown> | null

      const code = (errorInfo?.code as string) ?? 'RATE_LIMIT_EXCEEDED'
      const retryAfterSeconds = (errorInfo?.retryAfterSeconds as number) ?? 60
      const upgradeRequired = (errorInfo?.upgradeRequired as boolean) ?? false
      const message = (errorInfo?.message as string) ?? 'Too many requests. Please slow down.'
      const signUpUrl = (errorInfo?.signUpUrl as string) ?? '/register'
      const upgradeUrl = (errorInfo?.upgradeUrl as string) ?? '/pricing'

      if (code === 'PREVIEW_LIMIT_EXCEEDED') {
        const { useRateLimitStore } = await import('../store/rateLimitStore')
        useRateLimitStore.getState().showPreviewLimitModal({ message, signUpUrl, upgradeUrl })
      } else if (upgradeRequired) {
        const { useRateLimitStore } = await import('../store/rateLimitStore')
        useRateLimitStore.getState().setPlanLimit({
          retryAfterSeconds,
          plan: (errorInfo?.plan as string) ?? 'Free',
          upgradeUrl,
          upgradeRequired,
        })
        toast.error(message, { duration: 5000 })
      } else {
        toast.error(`Too many requests. Try again in ${retryAfterSeconds}s.`, {
          duration: 4000,
          id: 'rate-limit',
        })
      }

      return Promise.reject(error)
    }

    // ── Surface structured ApiError ───────────────────────────────────────────
    // Most controllers return `{ error: "plain string" }` for validation failures;
    // the global exception middleware returns `{ error: { code, message, details } }`.
    // Normalize both into an ApiError so every caller's `err.message` check works.
    const body = error.response?.data as { error?: ApiError | string; message?: string } | undefined
    if (body?.error) {
      const normalized: ApiError =
        typeof body.error === 'string' ? { code: 'ERROR', message: body.error } : body.error
      return Promise.reject(normalized)
    }

    return Promise.reject(error)
  },
)

export default client
