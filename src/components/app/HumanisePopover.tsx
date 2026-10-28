import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Check, X, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { paraphraseApi } from '../../api/paraphrase'
import { humaniseApi } from '../../api/humanise'
import { useAuthStore } from '../../store/authStore'
import { PARAPHRASE_MODE_INDEX } from '../../types/paraphrase'

interface HumanisePopoverProps {
  sentence: string
  onAccept: (rewritten: string) => void
  onClose: () => void
  onOpenInEditor: () => void
}

export function HumanisePopover({ sentence, onAccept, onClose, onOpenInEditor }: HumanisePopoverProps) {
  const [rewritten, setRewritten] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Full is the Humaniser's thorough rewrite level and gives the best results. It is gated server-side to
  // paid plans (mirrors EditorPage's canUseFullMode), so other plans keep the Fluency paraphrase.
  const canUseFull = useAuthStore(s => s.user?.plan === 'Pro' || s.user?.plan === 'Unlimited')

  const generate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (canUseFull) {
        // 'professional' is the neutral register; preserveLength keeps the sentence close to its original
        // size, since the result is spliced back into the surrounding text.
        const response = await humaniseApi.humanise({
          text: sentence,
          tone: 'professional',
          strength: 'maximum',
          preserveLength: true,
        })
        setRewritten(response.data.humanisedText)
      } else {
        const result = await paraphraseApi.paraphrase({
          text: sentence,
          mode: PARAPHRASE_MODE_INDEX.Fluency,
          strength: 'medium',
        })
        setRewritten(result.paraphrasedText)
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }
      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade to continue.', { duration: 5000 })
        onClose()
        return
      }
      setError(apiErr?.message ?? 'Rewrite failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Rewrite</span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
          <X size={13} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
          <RefreshCw size={12} className="animate-spin" /> Rewriting…
        </div>
      ) : error ? (
        <div className="py-2">
          <p className="text-xs text-red-500 mb-2">{error}</p>
          <button type="button" onClick={generate} className="text-xs text-blue-500 hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-800 leading-relaxed bg-blue-50/60 rounded-md p-2">{rewritten}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => rewritten && onAccept(rewritten)}
              className="flex items-center gap-1 text-xs font-medium text-white bg-purple-accent hover:bg-purple-deep rounded-md px-2.5 py-1.5 transition-colors"
            >
              <Check size={12} /> Accept
            </button>
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 rounded-md px-2.5 py-1.5 transition-colors"
            >
              <RefreshCw size={12} /> Regenerate
            </button>
            <button
              type="button"
              onClick={onOpenInEditor}
              className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
            >
              Full editor <ExternalLink size={11} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  )
}
