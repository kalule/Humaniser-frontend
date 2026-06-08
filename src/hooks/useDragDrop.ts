import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useFileInput } from './useFileInput.tsx'

interface UseDragDropOptions {
  onText: (text: string, filename: string) => void
  maxWords?: number
  disabled?: boolean
}

export interface DragHandlers {
  onDragEnter: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

export function useDragDrop({ onText, maxWords, disabled }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const depthRef = useRef(0)
  const { processFile, openFilePicker, isProcessing, fileInputElement } = useFileInput({ onText, maxWords })

  // Keep a stable ref so onDrop doesn't recreate when processFile identity changes
  const processFileRef = useRef(processFile)
  useEffect(() => { processFileRef.current = processFile })

  // Reset drag state when the zone is disabled (e.g. an API call starts mid-drag)
  useEffect(() => {
    if (disabled) {
      depthRef.current = 0
      setIsDragging(false)
    }
  }, [disabled])

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    // Only activate for actual file drags, not text selections
    if (!e.dataTransfer.types.includes('Files')) return
    depthRef.current += 1
    if (depthRef.current === 1) setIsDragging(true)
  }, [disabled])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    depthRef.current -= 1
    if (depthRef.current === 0) setIsDragging(false)
  }, [disabled])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    depthRef.current = 0
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFileRef.current(file)
  }, [disabled])

  const dragHandlers: DragHandlers = { onDragEnter, onDragLeave, onDragOver, onDrop }

  return { isDragging, isProcessing, dragHandlers, openFilePicker, fileInputElement }
}
