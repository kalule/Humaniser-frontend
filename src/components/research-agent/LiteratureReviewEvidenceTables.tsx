import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { literatureReviewEvidenceApi, type LiteratureReviewEvidenceTables } from '../../api/literatureReviewEvidence'

/**
 * The Literature Review's source table and gap evidence table (output contract of the generation rules). Advice only:
 * the tables are built from stored metadata, never edit the section and never gate approval or export.
 */
export function LiteratureReviewEvidenceTablesView({
  tables, open, onToggle,
}: { tables: LiteratureReviewEvidenceTables; open: boolean; onToggle: () => void }) {
  if (tables.sources.length === 0 && tables.gaps.length === 0) return null
  const offTopic = tables.sources.filter(s => !s.onTopic).length

  return (
    <section aria-label="Evidence tables" className="border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1 font-medium text-slate-800 hover:text-slate-950"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Evidence tables
        <span className="ml-1 text-xs font-normal text-slate-500">
          {tables.sources.length} source{tables.sources.length === 1 ? '' : 's'}
          {offTopic > 0 ? ` · ${offTopic} off topic` : ''}
          {` · ${tables.gaps.length} gap statement${tables.gaps.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <p className="whitespace-pre-line rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {tables.hasSearchRecord ? '' : 'No search record is stored for this project. '}
            {tables.searchRecord.replace(/^SEARCH RECORD[^\n]*\n/, '')}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <caption className="mb-1 text-left font-medium text-slate-700">Sources cited</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">Source</th>
                  <th className="py-1 pr-2 font-medium">Setting</th>
                  <th className="py-1 pr-2 font-medium">Population</th>
                  <th className="py-1 pr-2 font-medium">Design</th>
                  <th className="py-1 pr-2 font-medium">Themes</th>
                  <th className="py-1 pr-2 font-medium">Evidence</th>
                  <th className="py-1 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {tables.sources.map(s => (
                  <tr key={s.sourceId} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-2">
                      <span className="font-medium text-slate-800">{s.citation}</span>
                      {!s.onTopic && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-800">off topic</span>
                      )}
                      <span className="block text-slate-500">{s.title}</span>
                    </td>
                    <td className="py-1 pr-2">{s.setting}</td>
                    <td className="py-1 pr-2">{s.population}</td>
                    <td className="py-1 pr-2">{s.design}</td>
                    <td className="py-1 pr-2">{s.themes.length > 0 ? s.themes.join('; ') : '—'}</td>
                    <td className="py-1 pr-2">{s.evidenceLevel}</td>
                    <td className="py-1">{s.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tables.gaps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <caption className="mb-1 text-left font-medium text-slate-700">Gap evidence</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-1 pr-2 font-medium">Gap statement</th>
                    <th className="py-1 pr-2 font-medium">Cited in its paragraph</th>
                    <th className="py-1 font-medium">Retrieved studies closest to closing it</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.gaps.map((g, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">{g.gapStatement}</td>
                      <td className="py-1 pr-2">{g.citedInGapParagraph.length > 0 ? g.citedInGapParagraph.join('; ') : 'nothing cited'}</td>
                      <td className="py-1">{g.closestRetrievedSources.length > 0 ? g.closestRetrievedSources.join('; ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Loads the tables for a project's Literature Review. Renders nothing until there is something to show. */
export function LiteratureReviewEvidenceTablesPanel({
  projectId, refreshKey,
}: { projectId: string; refreshKey?: string | number | boolean | null }) {
  const [tables, setTables] = useState<LiteratureReviewEvidenceTables | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    literatureReviewEvidenceApi.get(projectId)
      .then(t => { if (!cancelled) setTables(t) })
      // Advice must never get in the way: a failed read shows nothing.
      .catch(() => { if (!cancelled) setTables(null) })
    return () => { cancelled = true }
  }, [projectId, refreshKey])

  if (!tables) return null
  return <LiteratureReviewEvidenceTablesView tables={tables} open={open} onToggle={() => setOpen(o => !o)} />
}
