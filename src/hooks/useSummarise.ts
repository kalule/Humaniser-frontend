import toast from 'react-hot-toast'
import { summariseApi } from '../api/summarise'
import { useSummariseStore } from '../store/summariseStore'
import { SUMMARISE_MODE_INDEX } from '../types/summarise'
import type { SummariseMode, SummariseLength } from '../types/summarise'

export function useSummarise() {
  const { setLoading, setError, setResult } = useSummariseStore()

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
      return result
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }
      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade to continue.', { duration: 5000 })
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
