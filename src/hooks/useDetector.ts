import toast from 'react-hot-toast'
import { detectorApi } from '../api/detector'
import { useDetectorStore } from '../store/detectorStore'
import { useAuthStore } from '../store/authStore'
import type { DetectResponse } from '../types/detector'

export function useDetector() {
  const { setLoading, setResult, setError } = useDetectorStore()
  const updateUser = useAuthStore((s) => s.updateUser)

  const detect = async (text: string): Promise<DetectResponse | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await detectorApi.detect({ text })
      setResult(result)
      updateUser({
        wordsUsed: result.wordsUsed,
        wordsLimit: result.wordsLimit,
        creditsUsed: result.creditsUsed,
        creditsLimit: result.creditsLimit,
        detectorChecksUsed: result.detectorChecksUsed,
        detectorChecksLimit: result.detectorChecksLimit,
      })
      return result
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string; upgradeRequired?: boolean }

      if (apiErr?.code === 'DETECTOR_CAP_EXCEEDED') {
        toast.error('Monthly AI Detector check limit reached. Upgrade your plan for more checks.', { duration: 5000 })
      } else if (apiErr?.code === 'CREDIT_LIMIT_EXCEEDED' || apiErr?.upgradeRequired) {
        toast.error('Credit limit reached. Upgrade your plan to continue.', { duration: 5000 })
      } else {
        toast.error(apiErr?.message ?? 'Detection failed. Please try again.')
      }

      setError(apiErr?.message ?? 'Detection failed.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { detect, isLoading: useDetectorStore((s) => s.isLoading) }
}
