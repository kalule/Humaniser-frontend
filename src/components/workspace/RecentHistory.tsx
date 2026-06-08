import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Clock } from 'lucide-react'
import { formatDate, truncate } from '../../lib/utils'
import { humaniseApi } from '../../api/humanise'
import type { HistoryItem } from '../../types'
import type { WorkspaceTool } from './ToolActionBar'

interface RecentHistoryProps {
  onRestore: (text: string, tool: WorkspaceTool) => void
}

export function RecentHistory({ onRestore }: RecentHistoryProps) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    humaniseApi
      .getHistory({ page: 1, pageSize: 5 })
      .then((res) => setItems(res.data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">Recent</span>
        <Link
          to="/app/history"
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock size={28} className="text-slate-600 mb-2" />
          <p className="text-sm text-slate-500">No recent activity yet</p>
          <p className="text-xs text-slate-600 mt-1">Start by pasting some text above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onRestore(item.inputText, 'humanise')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="w-full flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 text-left transition-colors"
            >
              {/* Tool icon */}
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-indigo-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  {truncate(item.inputText, 60)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.wordCount} words · {formatDate(item.createdAt)}
                </p>
              </div>

              {/* Score placeholder — humanise history doesn't have human score */}
              <div className="shrink-0">
                <span className="text-xs text-slate-500 capitalize">{item.tone}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
