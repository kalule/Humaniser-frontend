import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, History, Settings, CreditCard, ChevronLeft, ChevronRight, ChevronUp, X, LogOut, ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { NAV_SECTIONS, isNavItemActive, type NavItem } from '../../config/navigation';
import { NewMenu } from './NewMenu';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const TOOL_SECTIONS = NAV_SECTIONS;

// The tool list scrolls inside the sidebar (the footer is pinned), so on a shorter window the last
// entries sit out of sight with nothing hinting that there is more. Fade the bottom edge while
// there is content below the fold.
function NavScrollArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c));
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={ref} className="h-full overflow-y-auto py-4 scrollbar-thin">{children}</div>
      {more && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          style={{ background: 'linear-gradient(to top, var(--surface-sidebar), transparent)' }}
        />
      )}
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Prompt #7 — the three full usage blocks (each with its own heading, number line, and
  // progress bar) took ~250-300px, which is most of why the nav list above had no room and
  // clipped items on anything but a tall viewport (worsened, not caused, by the New-menu row
  // added above). Collapsed by default to one summary line; expand reveals all three.
  const [usageExpanded, setUsageExpanded] = useState(false);

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

  const isActive = (tool: NavItem) => isNavItemActive(tool, location.pathname);

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

  const creditsUsed      = user?.creditsUsed  ?? 0;
  const creditsLimit     = user?.creditsLimit ?? 20;
  const creditsUnlimited = plan === 'Unlimited' || creditsLimit >= 1_000_000;
  const creditsPct       = creditsUnlimited ? 0 : creditsLimit > 0 ? (creditsUsed / creditsLimit) * 100 : 0;
  const creditsColor = creditsPct > 90
    ? 'var(--color-red)'
    : creditsPct > 70
    ? 'var(--color-amber)'
    : 'var(--color-purple)';

  const detectorChecksUsed  = user?.detectorChecksUsed  ?? 0;
  const detectorChecksLimit = user?.detectorChecksLimit ?? 8;
  const detectorPct = detectorChecksLimit > 0 ? (detectorChecksUsed / detectorChecksLimit) * 100 : 0;
  const detectorColor = detectorPct > 90
    ? 'var(--color-red)'
    : detectorPct > 70
    ? 'var(--color-amber)'
    : 'var(--color-purple)';

  // Prompt #7 — the collapsed summary line shows whichever metric is actually closest to its
  // limit, so the one line that's always visible is the one worth seeing. AI Detector checks are
  // never unlimited in this data model (even on the Unlimited plan — a deliberate fair-use cap,
  // not a bug: see detectorChecksLimit above), so on an Unlimited plan this naturally surfaces
  // detector usage as the summary rather than two metrics that are permanently at 0%.
  const allUsageMetrics = [
    {
      key: 'words', label: 'Words', used: wordsUsed, limit: wordsLimit, pct: usagePct, color: progressColor,
      unlimited: isUnlimited,
      // Factual, not marketing copy — describes what this number actually measures, since
      // "Words" / "Credits" aren't otherwise defined anywhere in the sidebar.
      description: 'Words processed this month across Humaniser, Paraphraser, Grammar and Summariser.',
    },
    {
      key: 'credits', label: 'Credits', used: creditsUsed, limit: creditsLimit, pct: creditsPct, color: creditsColor,
      unlimited: creditsUnlimited,
      description: 'A separate per-action allowance spent by heavier AI operations (e.g. Write with AI).',
    },
    {
      key: 'detector', label: 'AI Detector checks', used: detectorChecksUsed, limit: detectorChecksLimit, pct: detectorPct, color: detectorColor,
      unlimited: false,
      // This is the one place the "Unlimited Plan" badge and a hard, non-zero limit coexist —
      // genuinely a separate fair-use cap on this one feature, not a data bug. Worth saying so
      // explicitly rather than leaving it looking contradictory.
      description: 'A fair-use limit kept separate from your plan\'s word/credit allowance, including on the Unlimited plan.',
    },
  ]
  // Prompt #7 — the collapsed summary line shows whichever metric is actually closest to its
  // limit, so the one line that's always visible is the one worth seeing. AI Detector checks are
  // never unlimited in this data model (even on the Unlimited plan — see its description above),
  // so on an Unlimited plan this naturally surfaces detector usage as the summary rather than two
  // metrics permanently at 0%.
  const usageSummary = allUsageMetrics.filter(m => !m.unlimited).sort((a, b) => b.pct - a.pct)[0]
    ?? allUsageMetrics[allUsageMetrics.length - 1];

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
        {user?.role === 'Admin' && (
          <Link
            to="/admin"
            onClick={() => { setUserMenuOpen(false); onMobileClose(); }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ShieldCheck size={15} /> Admin
          </Link>
        )}
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
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
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
              aria-label="Close menu"
              className="md:hidden absolute right-4 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* New-document flow prompt #4 — global entry point, reachable from every screen this
            sidebar renders on, not just the Library. Kept deliberately compact (no extra top
            padding beyond the header's own border, a shorter button) — the tool list below is
            already tight for vertical space on short viewports (see its own comment), and this
            row takes space from that budget permanently rather than scrolling away with it. */}
        <NewMenu compact={compact} />

        {/* Tool list — min-h-0 lets this shrink below its content height so it
            scrolls internally instead of pushing the footer past the h-screen
            sidebar (which clipped bottom items like "Citations" on short viewports) */}
        <NavScrollArea>
          {TOOL_SECTIONS.map((sec, i) => (
            <div key={sec.section} className={cn(i > 0 && 'mt-5')}>
              {!compact && (
                <>
                  {i > 0 && <div className="mx-5 mb-3" style={{ borderTop: '0.5px solid var(--border-sidebar)' }} />}
                  <p className="text-[10px] uppercase tracking-widest px-5 mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{sec.section}</p>
                </>
              )}
              <div className="space-y-0.5 px-2 mb-2">
                {sec.items.map((t) => {
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
                        {!compact && <span className="text-[15px] font-medium">{t.label}</span>}
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
                      {!compact && <span className="text-[15px] font-medium">{t.label}</span>}
                      {!compact && t.badge && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>{t.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </NavScrollArea>

        {/* Footer: user + usage */}
        <div className="shrink-0" style={{ borderTop: '0.5px solid var(--border-sidebar)' }}>
          <div ref={menuRef} className="relative px-2 py-2">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
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
                {/* Prompt #7 — one summary line (the metric closest to its limit) replaces three
                    always-expanded blocks; "Details" reveals all three, each still with a label,
                    used/limit text and a progress bar, same as before. */}
                <button
                  onClick={() => setUsageExpanded(v => !v)}
                  aria-expanded={usageExpanded}
                  aria-controls="sidebar-usage-detail"
                  title={usageSummary.description}
                  className="w-full mb-1.5 px-2 py-1.5 rounded-lg transition-colors text-left"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                      {usageSummary.label}: {usageSummary.used.toLocaleString()} / {usageSummary.limit.toLocaleString()}
                    </span>
                    <ChevronUp size={12} className={cn('shrink-0 transition-transform duration-200 ml-2', !usageExpanded && 'rotate-180')} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(usageSummary.pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${usageSummary.label} used`}
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--border-hairline)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(usageSummary.pct, 100)}%`, background: usageSummary.color }}
                    />
                  </div>
                  {usageSummary.key === 'detector' && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Fair-use limit, separate from your plan
                    </p>
                  )}
                </button>

                {usageExpanded && (
                  <div id="sidebar-usage-detail" className="mb-2 space-y-3 px-2 pt-1">
                    {allUsageMetrics.map(m => (
                      <div key={m.key} title={m.description}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{m.label} this month</p>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {m.unlimited
                              ? `${m.used.toLocaleString()} used`
                              : `${m.used.toLocaleString()} of ${m.limit.toLocaleString()} used`}
                          </p>
                          {!m.unlimited && (
                            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                              {Math.max(m.limit - m.used, 0).toLocaleString()} remaining
                            </p>
                          )}
                        </div>
                        {!m.unlimited && (
                          <div
                            role="progressbar"
                            aria-valuenow={Math.round(m.pct)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${m.label} used`}
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: 'var(--border-hairline)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(m.pct, 100)}%`, background: m.color }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
