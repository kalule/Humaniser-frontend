import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('./client', () => ({
  default: { get: mocks.get, post: mocks.post, delete: mocks.delete },
}))

// Pins the exact routes and payloads the backend's CitationCheckController serves. This is the seam that drifts silently: the
// shared client unwraps `{ success, data }` and drops the HTTP status from errors, so a wrong path or a wrong 404 assumption
// would otherwise only show up in a live browser.
describe('citationCheckApi', () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.post.mockReset(); mocks.delete.mockReset() })

  it('start posts { text } to the check route and returns the run id', async () => {
    mocks.post.mockResolvedValue({ status: 202, data: { runId: 'run-1' } })
    const { citationCheckApi } = await import('./citationCheck')

    expect(await citationCheckApi.start('Some draft (Smith, 2020).')).toBe('run-1')
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/citation-check', { text: 'Some draft (Smith, 2020).' })
  })

  it('start also accepts the still-wrapped response shape', async () => {
    mocks.post.mockResolvedValue({ status: 202, data: { success: true, data: { runId: 'run-2' } } })
    const { citationCheckApi } = await import('./citationCheck')
    expect(await citationCheckApi.start('x')).toBe('run-2')
  })

  it('upload sends the file as multipart under the field name "file" to the upload route', async () => {
    mocks.post.mockResolvedValue({ status: 202, data: { runId: 'run-3' } })
    const { citationCheckApi } = await import('./citationCheck')
    const file = new File(['bytes'], 'thesis.docx')

    expect(await citationCheckApi.upload(file)).toBe('run-3')

    const [url, body, config] = mocks.post.mock.calls[0]
    expect(url).toBe('/api/v1/citation-check/upload')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect(((body as FormData).get('file') as File).name).toBe('thesis.docx')
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })

  it('get returns the report', async () => {
    const report = { runId: 'run-1', status: 'Completed', cards: [] }
    mocks.get.mockResolvedValue({ status: 200, data: report })
    const { citationCheckApi } = await import('./citationCheck')

    expect(await citationCheckApi.get('run-1')).toEqual(report)
    expect(mocks.get.mock.calls[0][0]).toBe('/api/v1/citation-check/run-1')
  })

  it('get returns null for a 404 instead of throwing, because the shared client would otherwise hide the status', async () => {
    mocks.get.mockResolvedValue({ status: 404, data: { success: false, error: 'Check not found.' } })
    const { citationCheckApi } = await import('./citationCheck')
    expect(await citationCheckApi.get('gone')).toBeNull()
  })

  it('get tells the client to treat 404 (and only 404, besides success) as a normal response', async () => {
    mocks.get.mockResolvedValue({ status: 200, data: {} })
    const { citationCheckApi } = await import('./citationCheck')
    await citationCheckApi.get('run-1')

    const { validateStatus } = mocks.get.mock.calls[0][1] as { validateStatus: (s: number) => boolean }
    expect([200, 202, 404].map(validateStatus)).toEqual([true, true, true])
    expect([400, 401, 403, 429, 500, 503].map(validateStatus)).toEqual([false, false, false, false, false, false])
  })

  it('get lets real failures through so a transient error is not mistaken for a deleted run', async () => {
    mocks.get.mockRejectedValue({ code: 'ERROR', message: 'Service unavailable' })
    const { citationCheckApi } = await import('./citationCheck')
    await expect(citationCheckApi.get('run-1')).rejects.toMatchObject({ message: 'Service unavailable' })
  })

  it('remove deletes by id and does not fail when the run is already gone', async () => {
    mocks.delete.mockResolvedValue({ status: 404, data: undefined })
    const { citationCheckApi } = await import('./citationCheck')

    await expect(citationCheckApi.remove('run-1')).resolves.toBeUndefined()
    expect(mocks.delete.mock.calls[0][0]).toBe('/api/v1/citation-check/run-1')
    const { validateStatus } = mocks.delete.mock.calls[0][1] as { validateStatus: (s: number) => boolean }
    expect(validateStatus(204)).toBe(true)
    expect(validateStatus(404)).toBe(true)
    expect(validateStatus(500)).toBe(false)
  })
})
