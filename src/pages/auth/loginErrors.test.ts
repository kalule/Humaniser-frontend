import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { formatWait, getLoginErrorMessage } from './loginErrors'

const axiosError = (status: number | null, data?: unknown, headers: Record<string, string> = {}) => {
  const error = new AxiosError('failed')
  if (status !== null) error.response = { status, data, headers: new AxiosHeaders(headers), statusText: '', config: { headers: new AxiosHeaders() } }
  return error
}

describe('getLoginErrorMessage', () => {
  it('shows the server sentence from the normalised { code, message } error the API client produces', () => {
    expect(getLoginErrorMessage({ code: 'ERROR', message: 'Invalid email or password.' })).toBe('Invalid email or password.')
    expect(getLoginErrorMessage({ code: 'X', message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' }))
      .toContain('temporarily locked')
  })
  it('names the wait on a rate limit, in minutes when it is long', () => {
    expect(getLoginErrorMessage(axiosError(429, { error: { retryAfterSeconds: 297 } }))).toBe('Too many sign-in attempts. Please wait 5 minutes and try again.')
    expect(getLoginErrorMessage(axiosError(429, { error: { details: { retryAfterSeconds: 30 } } }))).toContain('30 seconds')
    expect(getLoginErrorMessage(axiosError(429, {}, { 'retry-after': '120' }))).toContain('2 minutes')
    expect(getLoginErrorMessage(axiosError(429))).toContain('1 minute')
  })
  it('does not blame the server when the request never reached it', () => {
    expect(getLoginErrorMessage(axiosError(null))).toContain('internet connection')
    expect(getLoginErrorMessage(axiosError(503))).toContain('on our end')
  })
  it('falls back to one generic sentence for anything else', () => {
    expect(getLoginErrorMessage(axiosError(401))).toBe('Invalid email or password.')
    expect(getLoginErrorMessage(new Error(''))).toBe('Unable to sign in. Please try again.')
    expect(getLoginErrorMessage(null)).toBe('Unable to sign in. Please try again.')
    expect(getLoginErrorMessage({ message: 'x'.repeat(300) })).toBe('Unable to sign in. Please try again.')
  })
})

describe('formatWait', () => {
  it.each([[5, '5 seconds'], [59, '59 seconds'], [60, '1 minute'], [297, '5 minutes'], [0, 'a moment'], [NaN, 'a moment']])('%s -> %s', (s, text) => expect(formatWait(s)).toBe(text))
})
