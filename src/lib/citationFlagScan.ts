import type { CitationFlag } from '../types/research'

export interface CitationFlagSource {
  /** One request for every section's open flags. */
  getSectionCitationFlags: (projectId: string) => Promise<CitationFlag[]>
  /** One section's open flags — the fallback when the all-sections request is unavailable. */
  getCitationFlags: (projectId: string, sectionCode: string) => Promise<CitationFlag[]>
}

/**
 * Open citation flags for each of the given sections, keyed by section code (every requested code is present).
 * Uses a single all-sections request; if that request fails (for example against a server that does not have the
 * endpoint yet) it falls back to one request per section, as before, so the Download step's check never silently
 * reports "no issues" because of the shortcut.
 */
export async function citationFlagsBySection(
  projectId: string,
  sectionCodes: readonly string[],
  source: CitationFlagSource,
): Promise<Map<string, CitationFlag[]>> {
  const bySection = new Map<string, CitationFlag[]>(sectionCodes.map(code => [code, []]))
  try {
    const all = await source.getSectionCitationFlags(projectId)
    for (const flag of all) bySection.get(flag.sectionCode)?.push(flag)
    return bySection
  } catch {
    const perSection = await Promise.all(sectionCodes.map(code =>
      source.getCitationFlags(projectId, code).catch(() => [] as CitationFlag[])))
    sectionCodes.forEach((code, i) => bySection.set(code, perSection[i]))
    return bySection
  }
}
