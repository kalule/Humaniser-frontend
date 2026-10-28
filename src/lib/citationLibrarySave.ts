import type { CitationDto, SaveCitationRequest } from '../types/citation'

const pending = new Map<string, Promise<CitationDto>>()
const doiKey = (doi?: string | null) => doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase()
const metadataKey = (source: SaveCitationRequest | CitationDto) => JSON.stringify([source.title.trim().toLowerCase(), source.publicationYear, source.authors.map(a => [a.firstName.trim().toLowerCase(), a.middleInitial.trim().toLowerCase(), a.lastName.trim().toLowerCase()])])

/** Serialize saves of the same work, and check server persistence before creating a new record. */
export function saveCitationToLibrary(payload: SaveCitationRequest, libraryId: string | undefined, api: { getLibrary: () => Promise<CitationDto[]>; save: (payload: SaveCitationRequest) => Promise<CitationDto> }): Promise<CitationDto> {
  const key = doiKey(payload.doi) || metadataKey(payload)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight
  const request = (async () => {
    const library = await api.getLibrary()
    return library.find(c => c.id === libraryId || (doiKey(c.doi) && doiKey(c.doi) === doiKey(payload.doi)) || (!c.doi && !payload.doi && metadataKey(c) === metadataKey(payload))) ?? await api.save(payload)
  })()
  pending.set(key, request)
  void request.finally(() => { pending.delete(key) }).catch(() => undefined)
  return request
}
