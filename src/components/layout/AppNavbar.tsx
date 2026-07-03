import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Sparkles, Settings, CreditCard, LogOut, History, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

const getPageTitle = (pathname: string) => {
  if (pathname === '/app' || pathname === '/app/humaniser') return 'Humaniser';
  if (pathname === '/app/detector') return 'AI Detector';
  if (pathname === '/app/paraphrase') return 'Paraphraser';
  if (pathname === '/app/grammar') return 'Grammar';
  if (pathname === '/app/plagiarism') return 'Plagiarism';
  if (pathname === '/app/summarise') return 'Summariser';
  if (pathname === '/app/analyst')    return 'Data Analyst';
  if (pathname === '/app/workbench')  return 'Data Workbench';
  if (pathname === '/app/history') return 'History';
  if (pathname === '/app/account' || pathname === '/app/billing') return 'Account Settings';
  return 'Dashboard';
};

export function AppNavbar({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const wordsUsed = user?.wordsUsed ?? 0;
  const wordsLimit = user?.wordsLimit ?? 1;
  const plan = user?.plan ?? 'Free';
  const isUnlimited = plan === 'Unlimited' || wordsLimit >= 1_000_000;
  const usagePct = isUnlimited ? 0 : Math.min((wordsUsed / wordsLimit) * 100, 100);

  const pageTitle = getPageTitle(location.pathname);

  const planBadgeStyle =
    plan === 'Unlimited'
      ? { background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }
      : plan === 'Pro'
      ? { background: 'var(--color-green-tint)', color: 'var(--color-green-text)' }
      : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' };

  return (
    <header
      className="h-16 sticky top-0 z-30 flex items-center justify-between px-6"
      style={{
        background: 'var(--surface-card)',
        borderBottom: '0.5px solid var(--border-hairline)',
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuClick}
          className="md:hidden transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Menu size={24} />
        </button>
        <h1 className="font-semibold text-lg hidden sm:block" style={{ color: 'var(--text-primary)' }}>
          {pageTitle}
        </h1>
      </div>

      {/* Center spacer */}
      <div />

      {/* Mobile center logo */}
      <div className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 600,
        }}>H</div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Usage pill */}
        <div
          className="hidden md:flex items-center px-3 py-1 rounded-full"
          style={{ background: 'var(--color-purple-tint)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--color-purple-text)' }}>
            {isUnlimited
              ? `${wordsUsed.toLocaleString()} words · Unlimited`
              : `${wordsUsed.toLocaleString()}/${wordsLimit.toLocaleString()} words`}
          </span>
        </div>

        {/* Plan badge */}
        <span
          className="hidden md:inline-flex px-2 py-1 rounded-full text-xs font-semibold"
          style={planBadgeStyle}
        >
          {plan}
        </span>

        {/* Upgrade button */}
        {plan === 'Free' && (
          <Link to="/app/billing" className="hidden md:block">
            <button
              className={cn('text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors', usagePct >= 80 && 'ring-2 ring-offset-1')}
              style={{
                background: 'var(--color-purple)',
                ...(usagePct >= 80 ? { boxShadow: '0 0 0 2px var(--color-purple-tint)' } : {}),
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-deep)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-purple)')}
            >
              ⬆ Upgrade
            </button>
          </Link>
        )}

        {/* Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 p-1 rounded-full pr-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="User menu"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold select-none"
              style={{ background: 'var(--color-purple)' }}
            >
              {getInitials(user?.name, user?.email)}
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-elevated py-1 z-50 overflow-hidden"
                style={{
                  background: 'var(--surface-card)',
                  border: '0.5px solid var(--border-hairline)',
                }}
              >
                {/* User info */}
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border-hairline)', background: 'var(--surface-rail)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user?.name ?? 'User'}
                  </p>
                  <p className="text-xs truncate mb-1" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-purple)' }}>{plan} Plan</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {[
                    { to: '/app/account', icon: Settings, label: '⚙️ Account Settings' },
                    { to: '/app/billing', icon: CreditCard, label: '💳 Billing' },
                    { to: '/app/history', icon: History, label: '🕐 History' },
                  ].map(({ to, icon: Icon, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                </div>

                {plan === 'Free' && (
                  <div style={{ borderTop: '0.5px solid var(--border-hairline)' }} className="py-1">
                    <Link
                      to="/app/billing"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: 'var(--color-purple)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-tint)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Sparkles size={16} />
                      ✨ Upgrade to Pro
                    </Link>
                  </div>
                )}

                <div style={{ borderTop: '0.5px solid var(--border-hairline)' }} className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left"
                    style={{ color: 'var(--color-red)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-red-tint)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={16} />
                    🚪 Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
