import toast from 'react-hot-toast'
import { paraphraseApi } from '../api/paraphrase'
import { useParaphraseStore } from '../store/paraphraseStore'
import { PARAPHRASE_MODE_INDEX } from '../types/paraphrase'
import type { ParaphraseMode, ParaphraseStrength } from '../types/paraphrase'

export function useParaphrase() {
  const { setLoading, setError, setLastResponse } = useParaphraseStore()

  const paraphrase = async (
    text: string,
    mode: ParaphraseMode,
    strength: ParaphraseStrength,
    includeManifest = false,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const result = await paraphraseApi.paraphrase({
        text,
        mode: PARAPHRASE_MODE_INDEX[mode],
        strength,
        includeManifest,
      })
      setLastResponse(result)
      return result
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }
      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade to continue.', { duration: 5000 })
      } else {
        toast.error(apiErr?.message ?? 'Paraphrase failed. Please try again.')
      }
      setError(apiErr?.message ?? 'Paraphrase failed.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    paraphrase,
    isLoading: useParaphraseStore((s) => s.isLoading),
  }
}
