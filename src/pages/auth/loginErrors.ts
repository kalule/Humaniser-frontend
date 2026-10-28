import axios from 'axios'

/** "297 seconds" reads as a countdown nobody can use; "5 minutes" is something a person can plan around. */
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'a moment'
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

/**
 * What to tell a person whose sign-in failed. The shared API client turns a JSON error body into a plain { code, message } object (not an
 * AxiosError), so both shapes arrive here: the plain one carries the server's own sentence ("Invalid email or password.", the lockout notice),
 * and the AxiosError one is what rate limits and network failures look like.
 */
export function getLoginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 429) {
      // The wait arrives in different places depending on which layer refused: the controller's rate limiter, the exception middleware
      // (inside details), or only the Retry-After header.
      const data = err.response?.data as { error?: { retryAfterSeconds?: number; details?: { retryAfterSeconds?: number } }; retryAfterSeconds?: number } | undefined
      const wait = data?.error?.retryAfterSeconds ?? data?.error?.details?.retryAfterSeconds ?? data?.retryAfterSeconds ?? Number(err.response?.headers?.['retry-after'])
      return `Too many sign-in attempts. Please wait ${formatWait(Number(wait) || 60)} and try again.`
    }
    if (!err.response) return 'We could not reach the server. Check your internet connection and try again.'
    if (status && status >= 500) return 'Something went wrong on our end. Please try again in a moment.'
    if (status === 400 || status === 401) return 'Invalid email or password.'
    return 'Unable to sign in. Please try again.'
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0 && message.length < 160) return message
  }
  return 'Unable to sign in. Please try again.'
}
