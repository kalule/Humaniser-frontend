import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { extractTextFromFile, isSupportedFile, ACCEPTED_EXTENSIONS } from '../lib/fileExtract'

interface UseFileInputOptions {
  onText: (text: string, filename: string) => void
  maxWords?: number
}

export function useFileInput({ onText, maxWords }: UseFileInputOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!isSupportedFile(file)) {
      toast.error(`Unsupported format. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`)
      return
    }

    setIsProcessing(true)
    try {
      const text = await extractTextFromFile(file)

      if (maxWords) {
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length
        if (wordCount > maxWords) {
          toast.error(`File exceeds the ${maxWords.toLocaleString()} word limit (${wordCount.toLocaleString()} words).`)
          return
        }
      }

      onText(text, file.name)
      toast.success(`Loaded: ${file.name}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read file.'
      toast.error(msg)
    } finally {
      setIsProcessing(false)
      // Reset input so the same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onText, maxWords])

  const openFilePicker = () => inputRef.current?.click()

  const fileInputElement = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_EXTENSIONS.join(',')}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
      }}
    />
  )

  return { processFile, openFilePicker, isProcessing, fileInputElement }
}
