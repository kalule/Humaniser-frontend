import { useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { PaperSearchResultCard } from '../../components/webLibrary/PaperSearchResultCard'
import { SaveToLibraryModal } from '../../components/webLibrary/SaveToLibraryModal'
import type { PaperSearchResult } from '../../types/webLibrary'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import type { PaperDetails } from '../../types/researchLibrary'

export default function FindPapersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { searchQuery, searchResults, isSearching, searchError, searchPapers, clearSearch } = useWebLibraryStore()
  const [input, setInput] = useState(searchQuery)
  const [saveModalFor, setSaveModalFor] = useState<PaperSearchResult | null>(null)

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isSearching) return
    void searchPapers(trimmed)
  }

  const handleClear = () => {
    setInput('')
    clearSearch()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="find" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0">
        <div className="flex items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="Search scholarly literature — e.g. AI in healthcare"
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 text-[14px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
            />
            {input && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isSearching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-accent hover:bg-purple-deep disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-medium transition-colors shadow-sm shadow-violet-200"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>
        {searchQuery && !isSearching && (
          <p className="text-[12px] text-slate-400 mt-2">
            {searchResults.length > 0 ? `Results for "${searchQuery}"` : `No results for "${searchQuery}"`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isSearching && (
          <div className="space-y-3 max-w-3xl">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
              </div>
            ))}
          </div>
        )}

        {!isSearching && searchError && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">Search failed</p>
            <p className="text-slate-400 text-[13px] mt-1">{searchError}</p>
          </div>
        )}

        {!isSearching && !searchError && !searchQuery && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">Search millions of scholarly works</p>
            <p className="text-slate-400 text-[13px] mt-1">Build your research library by saving sources you want to use later.</p>
          </div>
        )}

        {!isSearching && !searchError && searchQuery && searchResults.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">No strongly relevant papers were found</p>
            <p className="text-slate-400 text-[13px] mt-1">Try broader keywords or a different phrasing.</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="space-y-3 max-w-3xl">
            {searchResults.map(result => (
              <PaperSearchResultCard
                key={result.canonicalId}
                result={result}
                onSave={() => setSaveModalFor(result)}
                onDetails={() => { const next = new URLSearchParams(params); next.set('paper', result.canonicalId); setParams(next, { replace: true }) }}
              />
            ))}
          </div>
        )}
      </div>

      <SaveToLibraryModal
        open={saveModalFor !== null}
        result={saveModalFor}
        onClose={() => setSaveModalFor(null)}
      />
      <PaperDetailsDrawer
        workId={params.get('paper')}
        onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }}
        onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)}
      />
    </div>
  )
}
