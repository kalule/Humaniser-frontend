import toast from 'react-hot-toast'
import { detectorApi } from '../api/detector'
import { useDetectorStore } from '../store/detectorStore'
import type { DetectResponse } from '../types/detector'

export function useDetector() {
  const { setLoading, setResult, setError } = useDetectorStore()

  const detect = async (text: string): Promise<DetectResponse | null> => {
    setLoading(true)
    setError(null)
    try {
      const result = await detectorApi.detect({ text })
      setResult(result)
      return result
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }

      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade your plan to continue.', { duration: 5000 })
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
