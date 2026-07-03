import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Shield, Menu, X, ChevronDown, Zap, LogOut, User, CreditCard, Clock,
  RefreshCw, BookOpen, Scissors, SpellCheck, BarChart2, Layers, MessageSquare,
  BookMarked, Brain, Mic, Library, FileText, Globe, ScrollText,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { Button } from '../ui/Button'

// ── Features menu data ────────────────────────────────────────────────────────
type FeatureItem = {
  icon: React.ElementType
  iconCls: string
  bgCls: string
  label: string
  desc: string
  to: string
  badge?: string
}

const FEATURE_CATEGORIES: { label: string; items: FeatureItem[] }[] = [
  {
    label: 'Writing & Editing',
    items: [
      { icon: Sparkles,     iconCls: 'text-indigo-600',  bgCls: 'bg-indigo-50',  label: 'AI Humaniser',     desc: 'Make AI text sound naturally human',             to: '/app/humaniser' },
      { icon: Shield,       iconCls: 'text-emerald-600', bgCls: 'bg-emerald-50', label: 'AI Detector',      desc: 'Sentence-level human score analysis',            to: '/app/detector' },
      { icon: RefreshCw,    iconCls: 'text-violet-600',  bgCls: 'bg-violet-50',  label: 'Paraphraser',      desc: 'Rewrite while preserving meaning and tone',     to: '/app/paraphrase' },
      { icon: SpellCheck,   iconCls: 'text-amber-600',   bgCls: 'bg-amber-50',   label: 'Grammar Checker',  desc: 'Fix errors and improve writing clarity',         to: '/app/grammar' },
      { icon: BookOpen,     iconCls: 'text-rose-600',    bgCls: 'bg-rose-50',    label: 'Source Check',     desc: 'Detect copied or plagiarised content',           to: '/app/plagiarism' },
      { icon: Scissors,     iconCls: 'text-cyan-600',    bgCls: 'bg-cyan-50',    label: 'Summariser',       desc: 'Condense long text to key points',               to: '/app/summarise' },
    ],
  },
  {
    label: 'Research & Study',
    items: [
      { icon: ScrollText,   iconCls: 'text-blue-600',    bgCls: 'bg-blue-50',    label: 'Proposal Studio',  desc: 'Write research proposals and literature reviews', to: '/app/proposal-studio', badge: 'New' },
      { icon: BarChart2,    iconCls: 'text-purple-600',  bgCls: 'bg-purple-50',  label: 'Data Analyst',     desc: 'Analyse datasets and produce summaries',         to: '/app/analyst',         badge: 'New' },
      { icon: MessageSquare,iconCls: 'text-teal-600',    bgCls: 'bg-teal-50',    label: 'Document Chat',    desc: 'Ask questions about PDFs and papers',            to: '/app/document-chat',   badge: 'New' },
      { icon: BookMarked,   iconCls: 'text-orange-600',  bgCls: 'bg-orange-50',  label: 'Citations',        desc: 'Generate references in any citation style',      to: '/app/citations',       badge: 'New' },
      { icon: Brain,        iconCls: 'text-green-600',   bgCls: 'bg-green-50',   label: 'Flashcards',       desc: 'Create study cards from any text',               to: '/app/flashcards',      badge: 'New' },
      { icon: Mic,          iconCls: 'text-pink-600',    bgCls: 'bg-pink-50',    label: 'Lecture Notes',    desc: 'Transcribe and summarise lectures',              to: '/app/lecture',         badge: 'New' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { icon: Library,      iconCls: 'text-slate-700',   bgCls: 'bg-slate-100',  label: 'My Library',       desc: 'Organise papers, PDFs, and documents',           to: '/app/library',         badge: 'New' },
      { icon: Globe,        iconCls: 'text-sky-600',     bgCls: 'bg-sky-50',     label: 'Web Library',      desc: 'Save and organise web sources',                  to: '/app/web-library',     badge: 'New' },
      { icon: FileText,     iconCls: 'text-indigo-600',  bgCls: 'bg-indigo-50',  label: 'Doc Writer',       desc: 'Create and edit academic documents',             to: '/app/editor/new',      badge: 'New' },
      { icon: Layers,       iconCls: 'text-gray-500',    bgCls: 'bg-gray-100',   label: 'Workbench',        desc: 'Advanced multi-tool workspace',                  to: '/app/workbench',       badge: 'Beta' },
    ],
  },
]

// ── Auth user avatar dropdown ─────────────────────────────────────────────────
function getInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email?.slice(0, 2).toUpperCase() ?? 'U'
}

function UserMenu({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const wordsUsed = user?.wordsUsed ?? 0
  const wordsLimit = user?.wordsLimit ?? 1
  const usagePct = Math.min((wordsUsed / wordsLimit) * 100, 100)
  const isNearLimit = usagePct >= 80

  const handleLogout = async () => {
    onClose()
    try { await authApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e0e0da] rounded-2xl shadow-elevated py-1.5 z-50"
      role="menu"
    >
      <div className="px-3 py-2.5 border-b border-[#e0e0da]">
        <p className="text-sm font-semibold text-[#1a1a18] truncate">{user?.name ?? 'User'}</p>
        <p className="text-xs text-[#888888] truncate">{user?.email}</p>
      </div>

      <div className="px-3 py-2 border-b border-[#e0e0da]">
        <div className="flex justify-between text-xs text-[#888888] mb-1">
          <span>{wordsUsed.toLocaleString()} / {wordsLimit.toLocaleString()} words</span>
          <span className={isNearLimit ? 'text-amber-600' : ''}>{Math.round(usagePct)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#e0e0da] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              usagePct >= 100 ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-[#7c3aed]',
            )}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      {[
        { icon: User, label: 'Account', to: '/app/account' },
        { icon: CreditCard, label: 'Billing', to: '/app/billing' },
        { icon: Clock, label: 'History', to: '/app/history' },
      ].map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onClose}
          role="menuitem"
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors"
        >
          <item.icon size={14} className="text-[#888888]" />
          {item.label}
        </Link>
      ))}

      {user?.plan === 'Free' && (
        <Link
          to="/app/billing"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#7c3aed] hover:text-[#4c1d95] hover:bg-[#ede9fe] transition-colors"
        >
          <Zap size={14} />
          Upgrade to Pro
        </Link>
      )}

      <div className="border-t border-[#e0e0da] mt-1 pt-1">
        <button
          type="button"
          onClick={handleLogout}
          role="menuitem"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const featuresRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const { isAuthenticated, user } = useAuthStore()
  const wordsUsed = user?.wordsUsed ?? 0
  const wordsLimit = user?.wordsLimit ?? 1
  const usagePct = Math.min((wordsUsed / wordsLimit) * 100, 100)
  const isNearLimit = usagePct >= 80

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close features dropdown on click-outside
  useEffect(() => {
    if (!featuresOpen) return
    const handler = (e: MouseEvent) => {
      if (featuresRef.current && !featuresRef.current.contains(e.target as Node)) {
        setFeaturesOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFeaturesOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [featuresOpen])

  // Close user menu on click-outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleNavClick = (href: string) => {
    setMobileOpen(false)
    setFeaturesOpen(false)
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <header
        className={cn(
          'sticky top-0 left-0 right-0 z-40 transition-all duration-300 h-16',
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-[#e0e0da] shadow-sm'
            : 'bg-white/80 backdrop-blur-sm border-b border-[#e0e0da]',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full gap-4">

            {/* Logo */}
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 shrink-0"
            >
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold text-[#1a1a18]">HumaniseAI</span>
            </Link>

            {/* Center nav — desktop */}
            <nav className="hidden md:flex items-center gap-1">

              {/* Features dropdown */}
              <div ref={featuresRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFeaturesOpen((p) => !p)}
                  aria-expanded={featuresOpen}
                  aria-haspopup="true"
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors',
                    featuresOpen
                      ? 'text-[#1a1a18] bg-[#f1f5f9]'
                      : 'text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9]',
                  )}
                >
                  Features
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', featuresOpen && 'rotate-180')}
                  />
                </button>

                {/* Mega menu dropdown */}
                <AnimatePresence>
                  {featuresOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.99 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[720px] max-w-[calc(100vw-32px)] bg-white border border-[#e0e0da] rounded-2xl shadow-2xl shadow-black/10 z-50 overflow-hidden"
                    >
                      {/* Top accent line */}
                      <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500" />

                      <div className="p-5 grid grid-cols-3 gap-2">
                        {FEATURE_CATEGORIES.map((cat) => (
                          <div key={cat.label}>
                            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest px-2 mb-2">
                              {cat.label}
                            </p>
                            <div className="space-y-0.5">
                              {cat.items.map((item) => (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  onClick={() => setFeaturesOpen(false)}
                                  className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors group"
                                >
                                  <div className={cn(
                                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                    item.bgCls,
                                  )}>
                                    <item.icon size={14} className={item.iconCls} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-semibold text-[#1a1a18] group-hover:text-[#7c3aed] transition-colors leading-tight">
                                        {item.label}
                                      </span>
                                      {item.badge && (
                                        <span className={cn(
                                          'text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none',
                                          item.badge === 'Beta'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-[#ede9fe] text-[#7c3aed]',
                                        )}>
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#888888] mt-0.5 leading-snug line-clamp-1">
                                      {item.desc}
                                    </p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer CTA */}
                      <div className="border-t border-[#e0e0da] px-5 py-3 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs text-[#888888]">16 tools to supercharge your writing</p>
                        <Link
                          to="/register"
                          onClick={() => setFeaturesOpen(false)}
                          className="text-xs font-semibold text-[#7c3aed] hover:text-[#4c1d95] transition-colors"
                        >
                          Get started free →
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => handleNavClick('#pricing')}
                className="px-4 py-2 text-sm text-[#555555] hover:text-[#1a1a18] rounded-lg hover:bg-[#f1f5f9] transition-colors"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('#how-it-works')}
                className="px-4 py-2 text-sm text-[#555555] hover:text-[#1a1a18] rounded-lg hover:bg-[#f1f5f9] transition-colors"
              >
                How it Works
              </button>
            </nav>

            {/* Right side */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              {isAuthenticated ? (
                <>
                  {/* Usage pill */}
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f1f5f9] border text-xs',
                      isNearLimit ? 'border-amber-300 text-amber-700' : 'border-[#e0e0da] text-[#555555]',
                    )}
                  >
                    <span>{wordsUsed.toLocaleString()}/{wordsLimit.toLocaleString()} words</span>
                    <div className="w-12 h-1.5 rounded-full bg-[#e0e0da] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', isNearLimit ? 'bg-amber-500' : 'bg-[#7c3aed]')}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="relative" ref={userRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((p) => !p)}
                      aria-label="User menu"
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen}
                      className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-[#f1f5f9] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold select-none">
                        {getInitials(user?.name, user?.email)}
                      </div>
                      <ChevronDown
                        size={13}
                        className={cn(
                          'text-[#888888] transition-transform duration-200',
                          userMenuOpen && 'rotate-180',
                        )}
                      />
                    </button>
                    <AnimatePresence>
                      {userMenuOpen && <UserMenu onClose={() => setUserMenuOpen(false)} />}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Login</Button>
                  </Link>
                  <Link to="/register">
                    <Button variant="primary" size="sm">Get Started</Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-[#888888] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-white flex flex-col pt-16 md:hidden border-t border-[#e0e0da]"
          >
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">

              {/* Features accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileFeaturesOpen((p) => !p)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors text-left"
                >
                  <span className="font-medium">Features</span>
                  <ChevronDown
                    size={16}
                    className={cn('text-[#888888] transition-transform duration-200', mobileFeaturesOpen && 'rotate-180')}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {mobileFeaturesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-2 mt-1 space-y-4 py-2">
                        {FEATURE_CATEGORIES.map((cat) => (
                          <div key={cat.label}>
                            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest px-3 mb-1">
                              {cat.label}
                            </p>
                            {cat.items.map((item) => (
                              <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors"
                              >
                                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', item.bgCls)}>
                                  <item.icon size={14} className={item.iconCls} />
                                </div>
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.badge && (
                                  <span className={cn(
                                    'ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                    item.badge === 'Beta'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-[#ede9fe] text-[#7c3aed]',
                                  )}>
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-[#e0e0da] my-1" />

              <button
                type="button"
                onClick={() => handleNavClick('#pricing')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors text-left"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('#how-it-works')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors text-left"
              >
                How it Works
              </button>

              <div className="border-t border-[#e0e0da] my-1" />

              {isAuthenticated ? (
                <>
                  <Link to="/app/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors">
                    <User size={18} className="text-[#888888]" /> Account
                  </Link>
                  <Link to="/app/billing" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#555555] hover:text-[#1a1a18] hover:bg-[#f1f5f9] transition-colors">
                    <CreditCard size={18} className="text-[#888888]" /> Billing
                  </Link>
                </>
              ) : (
                <div className="space-y-2 pt-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-center">Login</Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    <Button variant="primary" size="sm" className="w-full justify-center">Get Started</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
