import toast from 'react-hot-toast'
import { grammarApi } from '../api/grammar'
import { useGrammarStore } from '../store/grammarStore'

export function useGrammar() {
  const { context, enabledCategories, setLoading, setError, setResult } = useGrammarStore()

  const check = async () => {
    // Read inputText fresh from the store rather than the closure — callers may
    // set the text and immediately invoke check() in the same handler (e.g. "Try
    // sample"), before this hook's own re-render has captured the new value.
    const inputText = useGrammarStore.getState().inputText

    if (!inputText.trim() || inputText.trim().split(/\s+/).length < 2) {
      toast.error('Enter at least a few words to check.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await grammarApi.check({
        text: inputText,
        context,
        enabledCategories,
      })
      setResult(result)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Grammar check failed. Please try again.'

      const status = (err as { response?: { status?: number } })?.response?.status

      if (status === 402) {
        toast.error('Word limit reached. Upgrade to continue.')
      } else if (status === 429) {
        toast.error('Too many requests. Please wait a moment.')
      } else {
        toast.error(msg)
      }

      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return { check }
}
