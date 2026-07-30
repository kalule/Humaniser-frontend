import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, ExternalLink,
  Search, Book, Calendar, FileText, Hash, AlertTriangle, Loader2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import type { SystematicReviewDetail, FetchedPaper, FetchStatus } from '../../types/systematicReview'

interface FetchPapersStepProps {
  reviewId: string
  detail: SystematicReviewDetail
  onSaved: () => void
}

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus', 'Snowball']

export default function FetchPapersStep({ reviewId, detail, onSaved }: FetchPapersStepProps) {
  // Select stable action references rather than the whole store snapshot —
  // the latter gets a new identity on every `set()` call (including the
  // updatePaperCount call this component makes), which previously caused
  // the status-polling effect below to retrigger itself in an infinite loop.
  const getFetchStatus = useSystematicReviewStore(s => s.getFetchStatus)
  const updatePaperCount = useSystematicReviewStore(s => s.updatePaperCount)
  const getPapers = useSystematicReviewStore(s => s.getPapers)
  const fetchPapersAction = useSystematicReviewStore(s => s.fetchPapers)

  const [activeTabId, setActiveTabId] = useState<string>('all')
  
  // Search & Filters
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [listSegment, setListSegment] = useState<'all' | 'web' | 'library'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  // Data state
  const [papers, setPapers] = useState<FetchedPaper[]>([])
  const [totalPapers, setTotalPapers] = useState(0)
  const [loadingPapers, setLoadingPapers] = useState(false)
  const [loadError, setLoadError] = useState(false)
  
  // Fetch status state
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null)
  const [isFetchingJob, setIsFetchingJob] = useState(false)

  // Debounce search input 400ms after the user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  // Tabs scroll
  const tabsRef = useRef<HTMLDivElement>(null)
  
  const scrollTabs = (dir: 'left' | 'right') => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
    }
  }

  // Poll fetch status
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getFetchStatus(reviewId)
        if (cancelled) return
        setFetchStatus(status)
        if (status.isFetching) {
          setIsFetchingJob(true)
          timer = window.setTimeout(poll, 2000)
        } else if (isFetchingJob) {
          setIsFetchingJob(false)
          loadPapers() // Reload list when fetch completes
          updatePaperCount(reviewId, status.totalFetched)
          onSaved()
        }
      } catch (err) {
        console.error('Failed to poll status', err)
        if (!cancelled && isFetchingJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isFetchingJob) {
      poll()
    } else {
      // Initial load of status
      getFetchStatus(reviewId).then(status => {
        if (cancelled) return
        setFetchStatus(status)
        if (status.isFetching) {
          setIsFetchingJob(true)
        } else {
          updatePaperCount(reviewId, status.totalFetched)
        }
      }).catch(() => {})
    }

    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [isFetchingJob, reviewId, getFetchStatus, updatePaperCount])

  // Load papers
  const loadPapers = async () => {
    setLoadingPapers(true)
    setLoadError(false)
    try {
      const res = await getPapers(reviewId, {
        queryId: activeTabId === 'all' ? undefined : activeTabId,
        search: debouncedSearch || undefined,
        filter: listSegment === 'all' ? undefined : listSegment,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        page,
        pageSize
      })
      setPapers(res.items)
      setTotalPapers(res.total)
    } catch (err) {
      console.error(err)
      setLoadError(true)
    } finally {
      setLoadingPapers(false)
    }
  }

  useEffect(() => {
    loadPapers()
  }, [activeTabId, debouncedSearch, listSegment, sourceFilter, page, pageSize, reviewId])

  // Start fetch job
  const handleFetchPapers = async () => {
    try {
      setIsFetchingJob(true)
      await fetchPapersAction(reviewId)
      onSaved()
    } catch (err) {
      console.error('Failed to start fetch', err)
      setIsFetchingJob(false)
    }
  }

  const handleTabClick = (id: string) => {
    setActiveTabId(id)
    setPage(1)
  }

  // Derived state
  const unfetchedQueries = useMemo(() => {
    if (!fetchStatus) return detail.searchStrings
    return detail.searchStrings.filter(s => !fetchStatus.fetchedQueries.includes(s.id))
  }, [detail.searchStrings, fetchStatus])

  const totalFetchedOverall = fetchStatus?.totalFetched ?? detail.paperCount

  const formatSourceCounts = () => {
    if (!fetchStatus) return 'Home Library 0'
    const counts = fetchStatus.sourceCounts || {}
    const parts = []
    parts.push(`Home Library ${counts['Library'] || 0}`)
    SOURCES.forEach(src => {
      parts.push(`${src} ${counts[src] || 0}`)
    })
    return parts.join('   ')
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 2. Query tab bar */}
      <div className="border-b border-slate-200 px-6 pt-4 flex items-center shrink-0">
        <button
          onClick={() => handleTabClick('all')}
          className={cn(
            'shrink-0 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTabId === 'all' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          All papers ({totalFetchedOverall})
        </button>
        
        <div className="w-px h-6 bg-slate-200 mx-2 shrink-0" />
        
        <button onClick={() => scrollTabs('left')} className="p-1 text-slate-400 hover:text-slate-800 shrink-0">
          <ChevronLeft size={16} />
        </button>
        
        <div ref={tabsRef} className="flex-1 overflow-x-hidden flex items-center gap-1 scroll-smooth">
          {detail.searchStrings.map((str, idx) => {
            const isFetched = fetchStatus?.fetchedQueries.includes(str.id)
            const badgeLabel = isFetched ? 'DONE' : 'PENDING'
            const badgeColor = isFetched ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            const isActive = activeTabId === str.id
            const truncText = str.queryText.length > 30 ? str.queryText.slice(0, 30) + '...' : str.queryText || `Search string ${idx + 1}`

            return (
              <button
                key={str.id}
                onClick={() => handleTabClick(str.id)}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-3 py-2.5 border-b-2 text-[12px] transition-colors whitespace-nowrap max-w-[200px]',
                  isActive ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
                title={str.queryText}
              >
                <span className="truncate">{truncText}</span>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', badgeColor)}>
                  {badgeLabel}
                </span>
              </button>
            )
          })}
        </div>
        
        <button onClick={() => scrollTabs('right')} className="p-1 text-slate-400 hover:text-slate-800 shrink-0">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        
        {/* 3. Per-source count row */}
        <p className="text-[11px] text-slate-500 mb-4 whitespace-pre-wrap">
          <span className="font-semibold text-slate-600">Across all searches:</span>   {formatSourceCounts()}
        </p>

        {/* 4a. Truncated-source recall warning — a source hit the per-query result cap, so more
             matching records may exist upstream than were fetched. */}
        <AnimatePresence>
          {(fetchStatus?.truncatedSources.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-3"
            >
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-900 leading-relaxed">
                <span className="font-bold">{fetchStatus!.truncatedSources.join(', ')}</span> returned the maximum
                number of results for at least one search query — there may be more matching records upstream than
                were fetched. Consider narrowing that query or splitting it into more specific queries to improve
                recall.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Pending-fetch notice banner */}
        <AnimatePresence>
          {unfetchedQueries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-3"
            >
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-900 leading-relaxed">
                <span className="font-bold">{unfetchedQueries.length} new queries</span> have not been fetched yet. 
                Click <button onClick={handleFetchPapers} className="font-bold underline hover:text-amber-700 transition-colors">Fetch Papers</button> below to include{' '}
                {unfetchedQueries.slice(0, 3).map(q => `"${q.queryText.slice(0, 20)}..."`).join(', ')}
                {unfetchedQueries.length > 3 && `, +${unfetchedQueries.length - 3} more`}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. Section intro */}
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Fetch Papers</h2>
          <p className="text-[13px] text-slate-500 mb-3">Papers retrieved from search queries across target databases.</p>
          <p className="text-[12px] text-slate-600">
            <span className="font-semibold">{totalFetchedOverall} papers ready for screening</span> from {totalFetchedOverall} fetched records 
            (0 duplicates removed, 0 mechanically excluded)
          </p>
        </div>

        {/* 6. Filter/search bar */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Filter papers by title, author, journal, DOI..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
            />
          </div>

          <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            {(['all', 'web', 'library'] as const).map(seg => (
              <button
                key={seg}
                onClick={() => { setListSegment(seg); setPage(1) }}
                className={cn(
                  'px-3 py-1 text-[12px] font-medium rounded-md transition-all',
                  listSegment === seg ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {seg === 'all' && `All (${totalPapers})`}
                {seg === 'web' && `Web`}
                {seg === 'library' && `Library`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Source</span>
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={e => { setSourceFilter(e.target.value); setPage(1) }}
                className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-medium text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
              >
                <option value="all">All sources</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1" />
          <span className="text-[12px] text-slate-500 font-medium">
            Showing {papers.length} of {totalPapers}
          </span>
        </div>

        {/* 7. Action button row */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleFetchPapers}
            disabled={isFetchingJob}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isFetchingJob && <Loader2 size={14} className="animate-spin" />}
            {isFetchingJob ? 'Fetching...' : 'Fetch Papers'}
          </button>
          
          <button className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold transition-colors">
            From Library
          </button>
          
          <button className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold transition-colors">
            Import Papers
          </button>
          
          <div className="flex-1" />
          
          {totalPapers > papers.length && (
            <button
              onClick={() => loadPapers()}
              className="text-[13px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
            >
              + Load more across all queries
            </button>
          )}
        </div>

        {/* 8. Results area */}
        {loadingPapers ? (
          <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : loadError ? (
          <div className="py-12 text-center border border-red-200 bg-red-50 rounded-xl">
            <p className="text-[13px] text-red-600 font-medium">Error loading papers. The backend might not be available.</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="py-20 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
            <p className="text-[14px] font-semibold text-slate-600 mb-1">No papers fetched yet.</p>
            <p className="text-[13px] text-slate-400">Run Fetch Papers to search the selected sources.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Source Information</th>
                  <th className="px-4 py-3 font-semibold w-32 border-l border-slate-200">Source</th>
                  <th className="px-4 py-3 font-semibold w-24 border-l border-slate-200">Citations</th>
                  <th className="px-4 py-3 font-semibold border-l border-slate-200 w-1/3">Abstract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {papers.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.source}</span>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.typeBadge}</span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{p.doi}</span>
                      </div>
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-slate-900 group-hover:text-violet-700 transition-colors leading-tight inline-flex items-baseline gap-1.5 mb-2">
                        {p.title}
                        <ExternalLink size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <div className="space-y-1 mt-1">
                        <div className="flex items-start gap-2 text-[12px] text-slate-600">
                          <Book size={13} className="shrink-0 mt-0.5 text-slate-400" />
                          <span className="leading-snug">{p.authors}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-slate-600">
                          <Calendar size={13} className="shrink-0 text-slate-400" />
                          <span>{p.publicationDate}</span>
                        </div>
                        <div className="flex items-start gap-2 text-[12px] text-slate-600">
                          <FileText size={13} className="shrink-0 mt-0.5 text-slate-400" />
                          <span className="italic leading-snug">{p.journal}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-slate-600">
                          <Hash size={13} className="shrink-0 text-slate-400" />
                          <span>{p.citations} citations</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top border-l border-slate-100 text-[13px] text-slate-800 font-medium">
                      {p.source}
                    </td>
                    <td className="px-4 py-4 align-top border-l border-slate-100 text-[13px] text-slate-800 font-medium tabular-nums">
                      {p.citations}
                    </td>
                    <td className="px-4 py-4 align-top border-l border-slate-100">
                      <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4">
                        {p.abstract}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPapers > 0 && (
              <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
                <span className="text-[12px] text-slate-500 font-medium">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalPapers)} of {totalPapers} papers
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">Show:</span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                      className="border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-700 bg-white outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-slate-200 rounded text-[12px] font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-[12px] text-slate-500 font-medium min-w-[3rem] text-center">
                      {page} / {Math.ceil(totalPapers / pageSize)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= Math.ceil(totalPapers / pageSize)}
                      className="px-3 py-1 border border-slate-200 rounded text-[12px] font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
