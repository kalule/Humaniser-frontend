import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Shield, RefreshCw, BookOpen, Scissors, SpellCheck,
  History, Settings, CreditCard, ChevronLeft, ChevronRight, ChevronUp, X, LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const TOOLS: {
  label: string;
  icon: React.ElementType;
  link: string;
  activeClass: string;
  disabled?: boolean;
  badge?: string;
}[] = [
  { label: 'Humaniser',   icon: Sparkles,   link: '/app/humaniser',  activeClass: 'bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500' },
  { label: 'AI Detector', icon: Shield,     link: '/app/detector',   activeClass: 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500' },
  { label: 'Paraphraser', icon: RefreshCw,  link: '/app/paraphrase', activeClass: 'bg-purple-500/15 text-purple-300 border-l-2 border-purple-500' },
  { label: 'Grammar',     icon: SpellCheck, link: '/app/grammar',    activeClass: 'bg-rose-500/15 text-rose-300 border-l-2 border-rose-500' },
  { label: 'Plagiarism',  icon: BookOpen,   link: '/app/plagiarism', activeClass: 'bg-cyan-500/15 text-cyan-300 border-l-2 border-cyan-500' },
  { label: 'Summariser',  icon: Scissors,   link: '/app/summarise',  activeClass: 'bg-amber-500/15 text-amber-300 border-l-2 border-amber-500' },
];

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef       = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const inDesktop = userMenuRef.current?.contains(e.target as Node);
      const inMobile  = mobileUserMenuRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path || (path === '/app/humaniser' && location.pathname === '/app');

  const wordsUsed   = user?.wordsUsed  ?? 0;
  const wordsLimit  = user?.wordsLimit ?? 500;
  const plan        = user?.plan       ?? 'Free';
  const isUnlimited = plan === 'Unlimited' || wordsLimit >= 1_000_000;
  const usagePct    = isUnlimited ? 0 : wordsLimit > 0 ? (wordsUsed / wordsLimit) * 100 : 0;
  const progressColor = usagePct > 95 ? 'bg-red-500' : usagePct > 80 ? 'bg-amber-500' : 'bg-indigo-500';

  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');
  const userName = user?.name || user?.email || 'Account';

  // ── Render function (not a React component — avoids remount on each render)
  function renderSidebar({
    compact,
    showCollapseButton,
    showCloseButton,
    menuRef,
  }: {
    compact: boolean;
    showCollapseButton: boolean;
    showCloseButton: boolean;
    menuRef: React.RefObject<HTMLDivElement>;
  }) {
    const userMenuPopover = (
      <div className="absolute bottom-full mb-1 left-0 min-w-[160px] bg-[#0d1117] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
        {[
          { to: '/app/history', icon: History,    label: 'History' },
          { to: '/app/account', icon: Settings,   label: 'Settings' },
          { to: '/app/billing', icon: CreditCard, label: 'Billing' },
        ].map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => { setUserMenuOpen(false); onMobileClose(); }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
        <div className="border-t border-white/[0.06]" />
        <button
          onClick={() => { setUserMenuOpen(false); handleLogout(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    );

    return (
      <div className="flex flex-col h-full border-r border-white/[0.05]" style={{ background: '#0a0e1a' }}>

        {/* Header */}
        <div className="h-16 border-b border-white/[0.05] flex items-center px-4 shrink-0 relative">
          {compact ? (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="font-display font-bold text-white tracking-wide">HumaniseAI</span>
            </div>
          )}

          {showCollapseButton && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'hidden md:flex absolute top-1/2 -translate-y-1/2 text-slate-500 hover:text-white bg-[#0d1117] border border-white/[0.08] rounded-full p-1 shadow-md z-10',
                compact ? 'left-1/2 -translate-x-1/2' : '-right-3',
              )}
            >
              {compact ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}

          {showCloseButton && (
            <button onClick={onMobileClose} className="md:hidden absolute right-4 text-slate-500 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Tool list */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {!compact && (
            <p className="text-[10px] text-slate-500 uppercase tracking-widest px-5 mb-2 font-semibold">Tools</p>
          )}
          <div className="space-y-0.5 px-2 mb-6">
            {TOOLS.map((t) => {
              const active = isActive(t.link);
              if (t.disabled) {
                return (
                  <button
                    key={t.label}
                    onClick={() => toast('Coming Phase 2')}
                    className={cn(
                      'w-full h-10 px-3 rounded-lg flex items-center gap-3 text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-150',
                      compact && 'justify-center',
                    )}
                    title={compact ? t.label : undefined}
                  >
                    <t.icon size={18} />
                    {!compact && <span className="text-sm font-medium">{t.label}</span>}
                    {!compact && t.badge && (
                      <span className="ml-auto text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-semibold">{t.badge}</span>
                    )}
                  </button>
                );
              }
              return (
                <Link
                  key={t.label}
                  to={t.link}
                  onClick={onMobileClose}
                  className={cn(
                    'h-10 px-3 rounded-lg flex items-center gap-3 transition-all duration-150',
                    active ? (t.activeClass ?? 'bg-white/[0.06] text-white') : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
                    compact && 'justify-center',
                  )}
                  title={compact ? t.label : undefined}
                >
                  <t.icon size={18} />
                  {!compact && <span className="text-sm font-medium">{t.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer: user + usage */}
        <div className="border-t border-white/[0.05] shrink-0">
          <div ref={menuRef} className="relative px-2 py-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'w-full h-10 rounded-lg flex items-center gap-2.5 px-2 transition-all duration-150 text-slate-400 hover:text-white hover:bg-white/[0.04]',
                compact && 'justify-center',
              )}
              title={compact ? userName : undefined}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                {userInitials}
              </div>
              {!compact && (
                <>
                  <span className="flex-1 text-sm font-medium text-left truncate">{userName}</span>
                  <ChevronUp size={14} className={cn('shrink-0 text-slate-600 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
                </>
              )}
            </button>
            {userMenuOpen && userMenuPopover}
          </div>

          <div className="border-t border-white/[0.05] mx-3" />

          <div className="p-3">
            {!compact ? (
              <>
                <div className="mb-3 px-2">
                  <p className="text-xs text-slate-600 mb-1">Words used this month</p>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm text-white font-medium">{wordsUsed.toLocaleString()} / {wordsLimit.toLocaleString()}</p>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-500', progressColor)} style={{ width: `${Math.min(usagePct, 100)}%` }} />
                  </div>
                </div>
                {plan === 'Free' && (
                  <Link to="/app/billing" onClick={onMobileClose}>
                    <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg py-2 transition-colors shadow-lg shadow-indigo-900/40">
                      ⬆ Upgrade to Pro
                    </button>
                  </Link>
                )}
              </>
            ) : (
              plan === 'Free' ? (
                <Link
                  to="/app/billing"
                  onClick={onMobileClose}
                  className="w-full h-10 flex items-center justify-center bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 rounded-lg transition-colors"
                  title="Upgrade to Pro"
                >
                  <Sparkles size={18} />
                </Link>
              ) : (
                <div className="w-full flex justify-center py-2" title={`${wordsUsed} / ${wordsLimit}`}>
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
              )
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden md:block h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-20',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {renderSidebar({
          compact: collapsed,
          showCollapseButton: true,
          showCloseButton: false,
          menuRef: userMenuRef,
        })}
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
              onClick={onMobileClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden shadow-2xl"
            >
              {renderSidebar({
                compact: false,
                showCollapseButton: false,
                showCloseButton: true,
                menuRef: mobileUserMenuRef,
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
