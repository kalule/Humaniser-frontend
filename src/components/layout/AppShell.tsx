import { useState, useCallback } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Wand2, Brain, Clock, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Sidebar } from './Sidebar'
import { AppNavbar } from './AppNavbar'
import { OnboardingModal } from '../ui/OnboardingModal'
import { WordLimitModal } from '../ui/WordLimitModal'
import { CreditLimitModal } from '../ui/CreditLimitModal'
import { DetectorCapModal } from '../ui/DetectorCapModal'
import { TopUpModal } from '../ui/TopUpModal'
import { DeepResearchWatcher } from '../app/DeepResearchWatcher'

const BOTTOM_TABS = [
  { to: '/app/humaniser', label: 'Humanise', icon: Wand2 },
  { to: '/app/detector', label: 'AI Content Check', icon: Brain },
  { to: '/app/history', label: 'History', icon: Clock },
  { to: '/app/account', label: 'Account', icon: Settings },
] as const

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-page)' }}>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <Sidebar mobileOpen={mobileOpen} onMobileClose={closeMobile} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AppNavbar onMobileMenuClick={openMobile} />
        {/* relative: absolutely positioned children (sr-only labels, icons) must be placed inside this scroller. Without it they were
            placed against the document at their unscrolled position, made the page taller than the window, and scrolling past
            the end of a long list moved the whole app up and showed blank space under it. */}
        <main id="main-content" className="relative flex-1 min-h-0 pb-16 md:pb-0 overflow-auto" tabIndex={-1}>
          <Outlet />
          <DeepResearchWatcher />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 md:hidden flex safe-bottom"
        style={{
          background: 'var(--surface-card)',
          borderTop: '0.5px solid var(--border-hairline)',
        }}
      >
        {BOTTOM_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors',
                isActive ? 'text-[var(--color-purple)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <OnboardingModal />
      <WordLimitModal />
      <CreditLimitModal />
      <DetectorCapModal />
      <TopUpModal />
    </div>
  )
}
