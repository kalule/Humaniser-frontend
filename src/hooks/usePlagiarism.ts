import toast from 'react-hot-toast'
import { plagiarismApi } from '../api/plagiarism'
import { usePlagiarismStore } from '../store/plagiarismStore'

const STAGES = [
  { delay: 0,    label: 'Extracting key phrases…'     },
  { delay: 2500, label: 'Searching the web…'          },
  { delay: 6000, label: 'Fetching source pages…'      },
  { delay: 9000, label: 'Running forensic analysis…'  },
]

export function usePlagiarism() {
  const { setLoading, setError, setResult } = usePlagiarismStore()

  const check = async (text: string) => {
    setLoading(true, STAGES[0].label)
    setError(null)

    // Progress stage labels so the user sees activity during the ~10s wait
    const timers = STAGES.map(({ delay, label }) =>
      setTimeout(() => setLoading(true, label), delay)
    )

    try {
      const result = await plagiarismApi.check({ text })
      setResult(result, text)
      return result
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }
      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade to continue.', { duration: 5000 })
      } else {
        toast.error(apiErr?.message ?? 'Plagiarism check failed. Please try again.')
      }
      setError(apiErr?.message ?? 'Check failed.')
      return null
    } finally {
      timers.forEach(clearTimeout)
      setLoading(false)
    }
  }

  return {
    check,
    isLoading:    usePlagiarismStore((s) => s.isLoading),
    loadingStage: usePlagiarismStore((s) => s.loadingStage),
  }
}
