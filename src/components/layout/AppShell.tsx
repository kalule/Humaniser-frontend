import { useState, useCallback } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Wand2, Brain, Clock, Settings } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Sidebar } from './Sidebar'
import { AppNavbar } from './AppNavbar'
import { OnboardingModal } from '../ui/OnboardingModal'
import { WordLimitModal } from '../ui/WordLimitModal'

const BOTTOM_TABS = [
  { to: '/app/humaniser', label: 'Humanise', icon: Wand2 },
  { to: '/app/detector', label: 'Detector', icon: Brain },
  { to: '/app/history', label: 'History', icon: Clock },
  { to: '/app/account', label: 'Account', icon: Settings },
] as const

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex min-h-screen bg-[#0b1120]">
      {/* Skip to main content — keyboard / screen reader shortcut */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <Sidebar mobileOpen={mobileOpen} onMobileClose={closeMobile} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppNavbar onMobileMenuClick={openMobile} />
        <main id="main-content" className="flex-1 pb-16 md:pb-0" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex safe-bottom">
        {BOTTOM_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors',
                isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <OnboardingModal />
      <WordLimitModal />
    </div>
  )
}
