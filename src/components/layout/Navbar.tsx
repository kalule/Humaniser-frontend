import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Shield,
  Menu,
  X,
  ChevronDown,
  Zap,
  LogOut,
  User,
  CreditCard,
  Clock,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { Button } from '../ui/Button'

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
      className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-50"
      role="menu"
    >
      <div className="px-3 py-2.5 border-b border-slate-700">
        <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'User'}</p>
        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
      </div>

      <div className="px-3 py-2 border-b border-slate-700">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{wordsUsed.toLocaleString()} / {wordsLimit.toLocaleString()} words</span>
          <span className={isNearLimit ? 'text-amber-400' : ''}>{Math.round(usagePct)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              usagePct >= 100 ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-indigo-500',
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
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <item.icon size={14} className="text-slate-400" />
          {item.label}
        </Link>
      ))}

      {user?.plan === 'Free' && (
        <Link
          to="/app/billing"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/50 transition-colors"
        >
          <Zap size={14} />
          Upgrade to Pro
        </Link>
      )}

      <div className="border-t border-slate-700 mt-1 pt-1">
        <button
          type="button"
          onClick={handleLogout}
          role="menuitem"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleNavClick = (href: string) => {
    setMobileOpen(false)
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
            ? 'bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl shadow-black/20'
            : 'bg-transparent',
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
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                HumaniseAI
              </span>
            </Link>

            {/* Center nav — desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/app"
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <Sparkles size={14} className="text-indigo-400" />
                AI Humaniser
              </Link>
              <Link
                to="/app/detector"
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <Shield size={14} className="text-emerald-400" />
                AI Detector
              </Link>
              <button
                type="button"
                onClick={() => handleNavClick('#pricing')}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('#how-it-works')}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
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
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border text-xs',
                      isNearLimit ? 'border-amber-500/30 text-amber-400' : 'border-slate-700 text-slate-300',
                    )}
                  >
                    <span>{wordsUsed.toLocaleString()}/{wordsLimit.toLocaleString()} words</span>
                    <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          isNearLimit ? 'bg-amber-400' : 'bg-indigo-500',
                        )}
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
                      className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold select-none">
                        {getInitials(user?.name, user?.email)}
                      </div>
                      <ChevronDown
                        size={13}
                        className={cn(
                          'text-slate-500 transition-transform duration-200',
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
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
            className="fixed inset-0 z-30 bg-slate-900/98 backdrop-blur-md flex flex-col pt-16 md:hidden"
          >
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
              <Link
                to="/app"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Sparkles size={18} className="text-indigo-400" />
                AI Humaniser
              </Link>
              <Link
                to="/app/detector"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Shield size={18} className="text-emerald-400" />
                AI Detector
              </Link>

              <div className="border-t border-slate-800 my-3" />

              <button
                type="button"
                onClick={() => handleNavClick('#pricing')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('#how-it-works')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
              >
                How it Works
              </button>

              <div className="border-t border-slate-800 my-3" />

              {isAuthenticated ? (
                <>
                  <Link to="/app/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                    <User size={18} className="text-slate-400" /> Account
                  </Link>
                  <Link to="/app/billing" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                    <CreditCard size={18} className="text-slate-400" /> Billing
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
