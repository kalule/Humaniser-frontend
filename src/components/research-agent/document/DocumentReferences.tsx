import { memo } from 'react'
import type { BibliographyEntry } from '../../../types/research'
import { ProposalMarkdown } from '../ProposalMarkdown'

interface Props {
  /** The project's compiled reference list (every source cited anywhere in the document). */
  entries: BibliographyEntry[] | null
  registerAnchor: (code: string, el: HTMLElement | null) => void
}

/**
 * One reference list for the whole document, after the last section, as in the exported file.
 * Sections keep their own References block in the stored text, but it is not shown per section.
 */
function DocumentReferencesImpl({ entries, registerAnchor }: Props) {
  if (!entries || entries.length === 0) return null
  const markdown = entries
    .map((e, i) => `${i + 1}. ${e.formattedText.trim().replace(/^\[?\d+[\].]\s*/, '')}`)
    .join('\n')
  return (
    <section ref={el => registerAnchor('references', el)} aria-labelledby="doc-references-heading" className="mb-8">
      <h2 id="doc-references-heading" tabIndex={-1} className="dm-heading m-0 mb-4 text-[26px] leading-tight font-semibold"
        style={{ fontFamily: 'Georgia, serif', color: 'var(--text-primary)' }}>
        References
      </h2>
      <div className="dm-prose">
        <ProposalMarkdown content={markdown} />
      </div>
    </section>
  )
}

export const DocumentReferences = memo(DocumentReferencesImpl)
