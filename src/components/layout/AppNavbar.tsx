import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Sparkles, Shield, Settings, CreditCard, LogOut, History, ChevronDown } from 'lucide-react';
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
  if (pathname === '/app/history') return 'History';
  if (pathname === '/app/account' || pathname === '/app/billing') return 'Account Settings';
  return 'Dashboard';
};

const isToolPage = (pathname: string) => {
  return pathname === '/app' || pathname === '/app/humaniser' || pathname === '/app/detector';
};

const planColors: Record<string, string> = {
  Free: 'bg-slate-700 text-slate-400',
  Pro: 'bg-indigo-500/20 text-indigo-400',
  Unlimited: 'bg-purple-500/20 text-purple-400',
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
    logout()
    navigate('/login')
  };

  const wordsUsed = user?.wordsUsed ?? 0;
  const wordsLimit = user?.wordsLimit ?? 1;
  const plan = user?.plan ?? 'Free';
  const isUnlimited = plan === 'Unlimited' || wordsLimit >= 1_000_000;
  const usagePct = isUnlimited ? 100 : Math.min((wordsUsed / wordsLimit) * 100, 100);

  const usageColor = usagePct > 95 ? 'text-red-400 border-red-500/30' : usagePct >= 80 ? 'text-amber-400 border-amber-500/30' : 'text-slate-400 border-slate-700';
  const progressColor = usagePct > 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-indigo-500';

  const pageTitle = getPageTitle(location.pathname);
  const showToolSwitcher = isToolPage(location.pathname);
  const isDetector = location.pathname === '/app/detector';

  return (
    <header className="h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button 
          onClick={onMobileMenuClick}
          className="md:hidden text-slate-400 hover:text-white"
        >
          <Menu size={24} />
        </button>
        <h1 className="font-semibold text-white text-lg hidden sm:block">{pageTitle}</h1>
      </div>

      {/* Center - Tool switcher (Desktop only) */}
      {showToolSwitcher && (
        <div className="hidden md:flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          <Link 
            to="/app/humaniser"
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150", 
              !isDetector ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200 border border-transparent")}
          >
            <Sparkles size={16} /> Humaniser
          </Link>
          <Link 
            to="/app/detector"
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150", 
              isDetector ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200 border border-transparent")}
          >
            <Shield size={16} /> Detect AI
          </Link>
        </div>
      )}

      {/* Mobile Center Logo */}
      <div className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Usage pill */}
        <div className={cn("hidden md:flex flex-col justify-center px-3 py-1 bg-slate-800 border rounded-full relative overflow-hidden", usageColor)}>
          <span className="text-xs font-medium z-10">
            {isUnlimited ? `${wordsUsed.toLocaleString()} words · Unlimited` : `${wordsUsed.toLocaleString()}/${wordsLimit.toLocaleString()} words`}
          </span>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800">
             <div className={cn("h-full", progressColor)} style={{ width: `${usagePct}%` }} />
          </div>
        </div>

        {/* Plan badge */}
        <span className={cn('hidden md:inline-flex px-2 py-1 rounded-full text-xs font-semibold', planColors[plan] ?? planColors['Free'])}>
          {plan}
        </span>

        {/* Upgrade button */}
        {plan === 'Free' && (
          <Link to="/app/billing" className="hidden md:block">
            <button className={cn("bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200", usagePct >= 80 && "ring-2 ring-indigo-500/30 animate-pulse")}>
              ⬆ Upgrade
            </button>
          </Link>
        )}

        {/* Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:bg-white/5 transition-colors pr-2"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold select-none">
              {getInitials(user?.name, user?.email)}
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 overflow-hidden"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name ?? 'User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate mb-1">{user?.email}</p>
                  <p className="text-xs text-indigo-400 font-medium">{plan} Plan</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    to="/app/account"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                  >
                    <Settings size={16} />
                    ⚙️ Account Settings
                  </Link>
                  <Link
                    to="/app/billing"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                  >
                    <CreditCard size={16} />
                    💳 Billing
                  </Link>
                  <Link
                    to="/app/history"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                  >
                    <History size={16} />
                    🕐 History
                  </Link>
                </div>

                {plan === 'Free' && (
                  <div className="border-t border-slate-700 py-1">
                    <Link
                      to="/app/billing"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-slate-700/50 transition-colors"
                    >
                      ✨ Upgrade to Pro
                    </Link>
                  </div>
                )}

                <div className="border-t border-slate-700 py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-700/50 transition-colors text-left"
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
