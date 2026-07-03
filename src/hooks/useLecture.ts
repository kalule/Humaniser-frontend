import { useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { lectureApi } from '../api/lecture'
import { useLectureStore } from '../store/lectureStore'

const POLL_INTERVAL_MS = 3_000
const ALLOWED_EXTS = ['mp3', 'mp4', 'wav', 'm4a', 'ogg', 'webm', 'flac']
const MAX_BYTES = 500 * 1024 * 1024 // 500 MB

export function useLecture() {
  const { jobs, setJobs, upsertJob, removeJob, selectJob, setUploading } = useLectureStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initial load ───────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    try {
      const data = await lectureApi.getJobs()
      setJobs(data)
    } catch {
      // silently ignore — user may not have any jobs yet
    }
  }, [setJobs])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  // ── Poll processing jobs ───────────────────────────────────────────────────

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)

    const processing = jobs.filter((j) => j.status === 'processing')
    if (processing.length === 0) return

    pollRef.current = setInterval(async () => {
      await Promise.all(
        processing.map(async (job) => {
          try {
            const updated = await lectureApi.getJob(job.id)
            if (updated.status !== 'processing') {
              upsertJob(updated)
              if (updated.status === 'ready') {
                toast.success(`"${updated.title}" is ready!`)
              } else if (updated.status === 'error') {
                toast.error(`"${updated.title}" failed to process.`)
              }
            }
          } catch {
            // keep polling
          }
        }),
      )
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobs, upsertJob])

  // ── Upload ─────────────────────────────────────────────────────────────────

  const upload = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTS.includes(ext)) {
        toast.error(`Unsupported file type .${ext}. Use: ${ALLOWED_EXTS.join(', ')}`)
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error('File exceeds 500 MB limit.')
        return
      }

      setUploading(true)
      try {
        const job = await lectureApi.upload(file)
        upsertJob(job)
        selectJob(job.id)
        toast.success('Upload started — transcription in progress.')
      } catch {
        toast.error('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    },
    [upsertJob, selectJob, setUploading],
  )

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteJob = useCallback(
    async (id: string) => {
      try {
        await lectureApi.deleteJob(id)
        removeJob(id)
        toast.success('Lecture deleted.')
      } catch {
        toast.error('Failed to delete lecture.')
      }
    },
    [removeJob],
  )

  return { upload, loadJobs, deleteJob }
}
