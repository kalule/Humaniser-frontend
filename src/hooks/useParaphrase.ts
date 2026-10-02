import toast from 'react-hot-toast'
import { paraphraseApi } from '../api/paraphrase'
import { useParaphraseStore } from '../store/paraphraseStore'
import { useAuthStore } from '../store/authStore'
import { PARAPHRASE_MODE_INDEX, PARAPHRASE_LENGTH_INDEX } from '../types/paraphrase'
import type { ParaphraseMode, ParaphraseStrength, ParaphraseLength } from '../types/paraphrase'

export function useParaphrase() {
  const { setLoading, setError, setLastResponse } = useParaphraseStore()
  const updateUser = useAuthStore((s) => s.updateUser)

  const paraphrase = async (
    text: string,
    mode: ParaphraseMode,
    strength: ParaphraseStrength,
    includeManifest = false,
    length: ParaphraseLength = 'None',
  ) => {
    setLoading(true)
    setError(null)
    try {
      const result = await paraphraseApi.paraphrase({
        text,
        mode: PARAPHRASE_MODE_INDEX[mode],
        strength,
        length: PARAPHRASE_LENGTH_INDEX[length],
        includeManifest,
      })
      setLastResponse(result)
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
