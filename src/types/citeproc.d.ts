declare module 'citeproc' {
  interface CiteItem { id: string; locator?: string; label?: string }
  interface Citation {
    citationID: string
    citationItems: CiteItem[]
    properties: { noteIndex: number; mode?: 'composite'; infix?: string }
  }
  interface BibliographyOptions { entry_ids: string[][]; bibliography_errors?: unknown[] }
  class Engine {
    constructor(sys: { retrieveLocale: (lang: string) => string | false; retrieveItem: (id: string) => object }, style: string, lang?: string)
    setOutputFormat(format: 'text' | 'html'): void
    updateItems(ids: string[]): void
    updateUncitedItems(ids: string[]): void
    processCitationCluster(citation: Citation, before: [string, number][], after: [string, number][]):
      [object, [number, string, string?][]]
    makeBibliography(): [BibliographyOptions, string[]] | false
  }
  const CSL: { Engine: typeof Engine }
  export default CSL
}
