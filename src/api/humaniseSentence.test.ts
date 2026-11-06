import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('./client', () => ({ default: { post: mocks.post, get: vi.fn(), delete: vi.fn() } }))

// Pins the route and payload the backend's POST /humanise/sentence expects, and tolerates both response shapes the shared
// client can hand back (still wrapped in { success, data }, or already unwrapped).
describe('humaniseApi.sentenceAlternatives', () => {
  beforeEach(() => mocks.post.mockReset())

  const dto = {
    sentence: 'Technology has expanded the options people have.',
    surroundingContext: 'The Paradox of Choice\nTechnology has expanded the options people have. This causes decision fatigue.',
    tone: 'academic' as const,
    originalSentence: 'The rapid advancement of technology has given people many options.',
    englishVariant: 'en-ZA',
  }

  it('posts the sentence, its paragraph, the tone, the original and the spelling preference', async () => {
    mocks.post.mockResolvedValue({ data: { success: true, data: { alternatives: ['One.', 'Two.'] } } })
    const { humaniseApi } = await import('./humanise')

    expect(await humaniseApi.sentenceAlternatives(dto)).toEqual(['One.', 'Two.'])
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/humanise/sentence', dto, { signal: undefined })
  })

  it('reads an already-unwrapped response', async () => {
    mocks.post.mockResolvedValue({ data: { alternatives: ['Only one.'] } })
    const { humaniseApi } = await import('./humanise')
    expect(await humaniseApi.sentenceAlternatives(dto)).toEqual(['Only one.'])
  })

  it('returns an empty list when the server found nothing safe, and drops blank entries', async () => {
    const { humaniseApi } = await import('./humanise')
    mocks.post.mockResolvedValueOnce({ data: { success: true, data: { alternatives: [] } } })
    expect(await humaniseApi.sentenceAlternatives(dto)).toEqual([])
    mocks.post.mockResolvedValueOnce({ data: { success: true, data: { alternatives: ['Real one.', '  ', ''] } } })
    expect(await humaniseApi.sentenceAlternatives(dto)).toEqual(['Real one.'])
    mocks.post.mockResolvedValueOnce({ data: { success: true, data: null } })
    expect(await humaniseApi.sentenceAlternatives(dto)).toEqual([])
  })

  it('passes the abort signal through so a stale request can be cancelled', async () => {
    mocks.post.mockResolvedValue({ data: { alternatives: [] } })
    const { humaniseApi } = await import('./humanise')
    const controller = new AbortController()
    await humaniseApi.sentenceAlternatives(dto, controller.signal)
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/humanise/sentence', dto, { signal: controller.signal })
  })
})
