export type ApiErrorKind = 'offline' | 'sandbox_offline' | 'timeout' | 'rate_limit' | 'generic'

export interface ClassifiedError {
  kind: ApiErrorKind
  message: string
}

const OFFLINE_PATTERNS = [
  /connection refused/i,
  /actively refused/i,
  /target machine/i,
  /econnrefused/i,
  /localhost:\d+/i,
  /127\.0\.0\.1:\d+/i,
  /no connection could be made/i,
  /failed to connect/i,
  /service unavailable/i,
  /network socket/i,
]

const TIMEOUT_PATTERNS = [
  /taking longer than expected/i,
  /timed? ?out/i,
  /deadline exceeded/i,
]

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /429/,
]

export interface ClassifyOptions {
  /** Pass the logStream from the job response.
   *  If it has entries the main backend ran fine — the error is in the execution sandbox. */
  logStream?: string[]
}

export function classifyApiError(
  raw: string | null | undefined,
  options: ClassifyOptions = {},
): ClassifiedError {
  const msg = raw ?? ''
  const backendWorked = (options.logStream?.length ?? 0) > 0

  if (OFFLINE_PATTERNS.some((p) => p.test(msg))) {
    if (backendWorked) {
      return {
        kind: 'sandbox_offline',
        message: 'Your analysis was prepared but the Python execution sandbox is offline. Start the analyst-runner service and try again.',
      }
    }
    return {
      kind: 'offline',
      message: 'The analysis service is currently offline. Make sure the backend server is running and try again.',
    }
  }

  if (TIMEOUT_PATTERNS.some((p) => p.test(msg))) {
    return {
      kind: 'timeout',
      message: 'Analysis is taking longer than expected — possibly waiting on API rate limits. Please try again in a moment.',
    }
  }

  if (RATE_LIMIT_PATTERNS.some((p) => p.test(msg))) {
    return {
      kind: 'rate_limit',
      message: 'The AI service is temporarily rate-limited. Please wait a minute then try again.',
    }
  }

  return {
    kind: 'generic',
    message: msg || 'Analysis failed. Please try again.',
  }
}
