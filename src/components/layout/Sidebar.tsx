import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Shield, RefreshCw, BookOpen, Scissors, SpellCheck, BarChart2,
  History, Settings, CreditCard, ChevronLeft, ChevronRight, ChevronUp, X, LogOut,
  Layers, MessageSquare, BookMarked, Brain, Mic, Library, FileText, Globe, ScrollText,
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
  matchPrefix?: string;
  disabled?: boolean;
  badge?: string;
}[] = [
  { label: 'My Library',      icon: Library,       link: '/app/library',         badge: 'New' },
  { label: 'Web Library',     icon: Globe,          link: '/app/web-library',     badge: 'New' },
  { label: 'Doc Writer',      icon: FileText,       link: '/app/editor/new',      badge: 'New' },
  { label: 'Proposal Studio', icon: ScrollText,     link: '/app/proposal-studio', matchPrefix: '/app/research-agent', badge: 'New' },
  { label: 'Voice Editor',    icon: Sparkles,       link: '/app/humaniser' },
  { label: 'AI Detector',     icon: Shield,         link: '/app/detector' },
  { label: 'Paraphraser',     icon: RefreshCw,      link: '/app/paraphrase' },
  { label: 'Grammar',         icon: SpellCheck,     link: '/app/grammar' },
  { label: 'Source Check',    icon: BookOpen,       link: '/app/plagiarism' },
  { label: 'Summariser',      icon: Scissors,       link: '/app/summarise' },
  { label: 'Data Analyst',    icon: BarChart2,      link: '/app/analyst',         badge: 'New' },
  { label: 'Document Chat',   icon: MessageSquare,  link: '/app/document-chat',   badge: 'New' },
  { label: 'Citations',       icon: BookMarked,     link: '/app/citations',       badge: 'New' },
  { label: 'Flashcards',      icon: Brain,          link: '/app/flashcards',      badge: 'New' },
  { label: 'Lecture Notes',   icon: Mic,            link: '/app/lecture',         badge: 'New' },
  { label: 'Workbench',       icon: Layers,         link: '/app/workbench',       badge: 'Beta' },
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

  const isActive = (tool: typeof TOOLS[0]) => {
    if (tool.matchPrefix && location.pathname.startsWith(tool.matchPrefix)) return true;
    return location.pathname === tool.link || (tool.link === '/app/humaniser' && location.pathname === '/app');
  };

  const wordsUsed   = user?.wordsUsed  ?? 0;
  const wordsLimit  = user?.wordsLimit ?? 500;
  const plan        = user?.plan       ?? 'Free';
  const isUnlimited = plan === 'Unlimited' || wordsLimit >= 1_000_000;
  const usagePct    = isUnlimited ? 0 : wordsLimit > 0 ? (wordsUsed / wordsLimit) * 100 : 0;
  const progressColor = usagePct > 90
    ? 'var(--color-red)'
    : usagePct > 70
    ? 'var(--color-amber)'
    : 'var(--color-purple)';

  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');
  const userName = user?.name || user?.email || 'Account';

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
      <div
        className="absolute bottom-full mb-1 left-0 min-w-[160px] rounded-xl shadow-elevated overflow-hidden z-50"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hairline)',
        }}
      >
        {[
          { to: '/app/history', icon: History,    label: 'History' },
          { to: '/app/account', icon: Settings,   label: 'Settings' },
          { to: '/app/billing', icon: CreditCard, label: 'Billing' },
        ].map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => { setUserMenuOpen(false); onMobileClose(); }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
        <div style={{ borderTop: '0.5px solid var(--border-hairline)' }} />
        <button
          onClick={() => { setUserMenuOpen(false); handleLogout(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left"
          style={{ color: 'var(--color-red)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-red-tint)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    );

    return (
      <div
        className="flex flex-col h-full"
        style={{
          background: 'var(--surface-sidebar)',
          borderRight: '0.5px solid var(--border-sidebar)',
        }}
      >

        {/* Header */}
        <div
          className="h-16 flex items-center px-4 shrink-0 relative"
          style={{ borderBottom: '0.5px solid var(--border-sidebar)' }}
        >
          {compact ? (
            <div className="w-full flex justify-center">
              <div style={{
                width: 32, height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600,
              }}>H</div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div style={{
                width: 32, height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>H</div>
              <span className="font-display font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>HumaniseAI</span>
            </div>
          )}

          {showCollapseButton && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'hidden md:flex absolute top-1/2 -translate-y-1/2 rounded-full p-1 shadow-md z-10 transition-colors',
                compact ? 'left-1/2 -translate-x-1/2' : '-right-3',
              )}
              style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-hairline)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {compact ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}

          {showCloseButton && (
            <button
              onClick={onMobileClose}
              className="md:hidden absolute right-4 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Tool list */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {!compact && (
            <p className="text-[10px] uppercase tracking-widest px-5 mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Tools</p>
          )}
          <div className="space-y-0.5 px-2 mb-6">
            {TOOLS.map((t) => {
              const active = isActive(t);
              if (t.disabled) {
                return (
                  <button
                    key={t.label}
                    onClick={() => toast('Coming Phase 2')}
                    className={cn(
                      'w-full h-10 px-3 rounded-lg flex items-center gap-3 transition-all duration-150',
                      compact && 'justify-center',
                    )}
                    style={{ color: 'var(--text-muted)' }}
                    title={compact ? t.label : undefined}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-rail)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <t.icon size={18} />
                    {!compact && <span className="text-sm font-medium">{t.label}</span>}
                    {!compact && t.badge && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>{t.badge}</span>
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
                    compact && 'justify-center',
                  )}
                  style={{
                    background: active ? 'var(--color-purple-tint)' : 'transparent',
                    color: active ? 'var(--color-purple)' : 'var(--text-muted)',
                  }}
                  title={compact ? t.label : undefined}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--surface-rail)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <t.icon size={18} />
                  {!compact && <span className="text-sm font-medium">{t.label}</span>}
                  {!compact && t.badge && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>{t.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer: user + usage */}
        <div className="shrink-0" style={{ borderTop: '0.5px solid var(--border-sidebar)' }}>
          <div ref={menuRef} className="relative px-2 py-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'w-full h-10 rounded-lg flex items-center gap-2.5 px-2 transition-all duration-150',
                compact && 'justify-center',
              )}
              style={{ color: 'var(--text-secondary)' }}
              title={compact ? userName : undefined}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: 'var(--color-purple)' }}
              >
                {userInitials}
              </div>
              {!compact && (
                <>
                  <span className="flex-1 text-sm font-medium text-left truncate">{userName}</span>
                  <ChevronUp size={14} className={cn('shrink-0 transition-transform duration-200', userMenuOpen && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
                </>
              )}
            </button>
            {userMenuOpen && userMenuPopover}
          </div>

          <div className="mx-3" style={{ borderTop: '0.5px solid var(--border-hairline)' }} />

          <div className="p-3">
            {!compact ? (
              <>
                <div className="mb-3 px-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Words used this month</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {wordsUsed.toLocaleString()} / {isUnlimited ? 'Unlimited' : wordsLimit.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-hairline)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(usagePct, 100)}%`, background: progressColor }}
                    />
                  </div>
                </div>
                {plan === 'Free' && (
                  <Link to="/app/billing" onClick={onMobileClose}>
                    <button
                      className="w-full text-white text-sm font-medium rounded-lg py-2 transition-colors"
                      style={{ background: 'var(--color-purple)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-deep)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-purple)')}
                    >
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
                  className="w-full h-10 flex items-center justify-center rounded-lg transition-colors"
                  style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple)' }}
                  title="Upgrade to Pro"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-tint)')}
                >
                  <Sparkles size={18} />
                </Link>
              ) : (
                <div
                  className="w-full flex justify-center py-2"
                  title={`${wordsUsed.toLocaleString()} / ${isUnlimited ? 'Unlimited' : wordsLimit.toLocaleString()}`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-purple)' }} />
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
              className="fixed inset-0 z-40 md:hidden backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={onMobileClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden shadow-elevated"
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
