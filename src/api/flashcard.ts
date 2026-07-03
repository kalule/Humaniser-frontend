import client from './client'
import type { ExtractDocumentResult, GenerateRequest, StudyDeck } from '../types/flashcard'

type Wrapped<T> = { success: boolean; data: T }

const unwrap = <T>(res: { data: Wrapped<T> }): T =>
  res.data.data ?? (res.data as unknown as T)

export const flashcardApi = {
  generate: async (req: GenerateRequest): Promise<StudyDeck> =>
    unwrap(await client.post<Wrapped<StudyDeck>>('/api/v1/flashcards/generate', req)),

  getDecks: async (): Promise<StudyDeck[]> =>
    unwrap(await client.get<Wrapped<StudyDeck[]>>('/api/v1/flashcards/decks')),

  getDeck: async (id: string): Promise<StudyDeck> =>
    unwrap(await client.get<Wrapped<StudyDeck>>(`/api/v1/flashcards/decks/${id}`)),

  deleteDeck: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/flashcards/decks/${id}`)
  },

  retryDeck: async (id: string): Promise<StudyDeck> =>
    unwrap(await client.post<Wrapped<StudyDeck>>(`/api/v1/flashcards/decks/${id}/retry`, {})),

  extractDocument: async (file: File): Promise<ExtractDocumentResult> => {
    const form = new FormData()
    form.append('file', file)
    return unwrap(
      await client.post<Wrapped<ExtractDocumentResult>>('/api/v1/flashcards/extract-document', form)
    )
  },
}
