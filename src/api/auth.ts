import client from './client'
import type { AuthResponse, RegisterRequest, LoginRequest } from '../types'

export const authApi = {
  register: (dto: RegisterRequest) =>
    client.post<AuthResponse>('/api/v1/auth/register', dto),

  login: (dto: LoginRequest) =>
    client.post<AuthResponse>('/api/v1/auth/login', dto),

  forgotPassword: (email: string) =>
    client.post<void>('/api/v1/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    client.post<void>('/api/v1/auth/reset-password', { token, newPassword }),

  // No body — the server reads the refresh token from the httpOnly cookie.
  // The X-Requested-With header is required for CSRF defense-in-depth.
  refreshToken: () =>
    client.post<AuthResponse>(
      '/api/v1/auth/refresh',
      {},
      { headers: { 'X-Requested-With': 'HumaniseAI' } },
    ),

  // No body — the server reads and revokes the cookie itself.
  logout: () =>
    client.post<void>('/api/v1/auth/logout', {}),

  googleAuth: (idToken: string) =>
    client.post<AuthResponse>('/api/v1/auth/google', { idToken }),

  sendOtp: (email: string) =>
    client.post<void>('/api/v1/auth/send-otp', { email }),

  verifyOtp: (email: string, code: string) =>
    client.post<{ verificationToken: string }>('/api/v1/auth/verify-otp', { email, code }),

  registerWithOtp: (dto: { email: string; password: string; name?: string; verificationToken: string }) =>
    client.post<AuthResponse>('/api/v1/auth/register-otp', dto),
}
