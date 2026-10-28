import { describe, expect, it } from 'vitest'
import { isCredentialRequest } from './client'

describe('isCredentialRequest', () => {
  it.each([
    '/api/v1/auth/login', '/api/v1/auth/login?x=1', '/api/v1/auth/register', '/api/v1/auth/google', '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password', '/api/v1/auth/send-otp', '/api/v1/auth/verify-otp', '/api/v1/auth/register-otp', '/api/v1/auth/login/',
  ])('treats %s as a credential request, so a 401 reaches the page', url => expect(isCredentialRequest(url)).toBe(true))

  it.each(['/api/v1/workbench/essay-cowrite/section', '/api/v1/auth/refresh', '/api/v1/auth/logout', '/api/v1/documents', undefined])(
    'treats %s as an ordinary request, so a 401 still triggers the session refresh', url => expect(isCredentialRequest(url)).toBe(false))
})
