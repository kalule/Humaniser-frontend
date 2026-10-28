import { ExternalLink, Loader2 } from 'lucide-react'
import type { CitationCandidate } from '../../lib/citationMatch'

interface AmbiguousSourceChooserProps {
  /** The paper the section currently points to comes first. */
  candidates: CitationCandidate[]
  busy:       boolean
  onChoose:   (literatureId: string) => void
}

/**
 * "Which paper did you mean?" for an AmbiguousCitation flag: several project papers share the cited
 * author and year, so the text alone cannot say. Choosing updates the section's reference list on
 * the server (deterministic, no credit); choosing the paper already in use just confirms it.
 */
export function AmbiguousSourceChooser({ candidates, busy, onChoose }: AmbiguousSourceChooserProps) {
  if (candidates.length < 2) {
    return (
      <p className="mt-2 text-[10.5px] leading-relaxed text-amber-700">
        The papers that share this author and year could not be listed. Add the exact paper's DOI to its
        reference entry, or remove the citation.
      </p>
    )
  }
  return (
    <div className="mt-2" role="group" aria-label="Choose which paper this citation refers to">
      <p className="text-[10.5px] leading-relaxed text-amber-800">
        Which paper did you mean? The reference list will be updated to name it.
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {candidates.map((c, i) => (
          <li key={c.id} className="rounded border border-amber-200 bg-white px-2 py-1.5">
            <p className="text-[11px] font-medium leading-snug text-slate-800">{c.title}</p>
            <p className="text-[10.5px] text-slate-500">{c.authors} ({c.year})</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoose(c.id)}
                className="inline-flex items-center gap-1 rounded bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                {busy && <Loader2 size={10} className="animate-spin" />}
                {i === 0 ? 'Keep this one' : 'Use this paper'}
              </button>
              {i === 0 && <span className="text-[10px] text-slate-400">currently used</span>}
              {c.viewUrl && (
                <a
                  href={c.viewUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-violet-700 hover:text-violet-900"
                >
                  view <ExternalLink size={9} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
