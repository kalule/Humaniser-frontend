import toast from 'react-hot-toast'
import { summariseApi } from '../api/summarise'
import { useSummariseStore } from '../store/summariseStore'
import { useAuthStore } from '../store/authStore'
import { SUMMARISE_MODE_INDEX } from '../types/summarise'
import type { SummariseMode, SummariseLength } from '../types/summarise'

export function useSummarise() {
  const { setLoading, setError, setResult } = useSummariseStore()
  const updateUser = useAuthStore((s) => s.updateUser)

  const summarise = async (text: string, mode: SummariseMode, length: SummariseLength) => {
    setLoading(true)
    setError(null)
    try {
      const result = await summariseApi.summarise({
        text,
        mode: SUMMARISE_MODE_INDEX[mode],
        length,
      })
      setResult(result)
      updateUser({
        wordsUsed: result.wordsUsed,
        wordsLimit: result.wordsLimit,
        creditsUsed: result.creditsUsed,
        creditsLimit: result.creditsLimit,
      })
      return result
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string; upgradeRequired?: boolean }
      if (apiErr?.code === 'CREDIT_LIMIT_EXCEEDED' || apiErr?.upgradeRequired) {
        toast.error('Credit limit reached. Upgrade to continue.', { duration: 5000 })
      } else {
        toast.error(apiErr?.message ?? 'Summarise failed. Please try again.')
      }
      setError(apiErr?.message ?? 'Summarise failed.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    summarise,
    isLoading: useSummariseStore((s) => s.isLoading),
  }
}
