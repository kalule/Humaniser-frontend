import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { visibleNavSections, isNavItemActive, type NavItem } from '../../config/navigation';
import { useIsToolEnabled } from '../../config/features';
import { isDetectorMeterVisible, isPlanUnlimited, showUsageBar, usageSummaryText, UNLIMITED_LIMIT_THRESHOLD } from '../../lib/usageMeter';
import { NewMenu } from './NewMenu';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

// Storage can be missing or throw (private window, blocked site data); the sidebar must still render.
function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

const COLLAPSED_SECTIONS_KEY = 'sidebar_collapsed_sections';

function readCollapsedSections(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(readStorage(COLLAPSED_SECTIONS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const sectionDomId = (prefix: string, section: string) =>
  `${prefix}-nav-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

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

  // Keep the current page's entry in view: on a short window it can sit below the fold of this list.
  // 'nearest' only scrolls when the entry is actually out of view. The old 'center' scrolled the list
  // on every route change, which left the first row half-hidden under the New document button.
  const { pathname } = useLocation();
  useEffect(() => {
    const active = ref.current?.querySelector('[aria-current="page"]') as HTMLElement | null;
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [pathname]);

  // pt/pb give the first and last rows breathing room inside the scroll box, and scroll-py keeps that
  // room when scrollIntoView brings a row to an edge. The bottom padding is taller than the fade, so
  // the last row is never left sitting under it once the list is scrolled to the end.
  return (
    <div className="relative flex-1 min-h-0">
      <div ref={ref} className="h-full overflow-y-auto pt-2 pb-8 scroll-py-3 scrollbar-thin">{children}</div>
      {more && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
          style={{ background: 'linear-gradient(to top, var(--surface-sidebar), transparent)' }}
        />
      )}
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  // Tools outside the launch set (config/features.ts) are not rendered; empty groups disappear with them.
  const isToolOn = useIsToolEnabled();
  const toolSections = visibleNavSections(isToolOn);

  const [collapsed, setCollapsed] = useState(() => readStorage('sidebar_collapsed') === 'true');
  // Per-section collapse, remembered across visits. The section holding the current page is always
  // shown open regardless (see sectionOpen below), so the active entry is never hidden.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(readCollapsedSections);
  // Prompt #7 — the three full usage blocks (each with its own heading, number line, and
  // progress bar) took ~250-300px, which is most of why the nav list above had no room and
  // clipped items on anything but a tall viewport (worsened, not caused, by the New-menu row
  // added above). Collapsed by default to one summary line; expand reveals all three.
  const [usageExpanded, setUsageExpanded] = useState(false);

  useEffect(() => {
    writeStorage('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    writeStorage(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const isActive = (tool: NavItem) => isNavItemActive(tool, location.pathname);
  const sectionHasActive = (items: NavItem[]) => items.some(t => !t.disabled && isActive(t));
  const sectionOpen = (section: string, items: NavItem[]) =>
    sectionHasActive(items) || !collapsedSections[section];
  const toggleSection = (section: string) =>
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));

  const wordsUsed   = user?.wordsUsed  ?? 0;
  const wordsLimit  = user?.wordsLimit ?? 500;
  const plan        = user?.plan       ?? 'Free';
  // From the signed-in user's plan and limits (auth store UserDto), shared with the header AccountMenu.
  const isUnlimited = isPlanUnlimited(plan, wordsLimit);
  const usagePct    = isUnlimited ? 0 : wordsLimit > 0 ? (wordsUsed / wordsLimit) * 100 : 0;
  const progressColor = usagePct > 90
    ? 'var(--color-red)'
    : usagePct > 70
    ? 'var(--color-amber)'
    : 'var(--color-purple)';

  const creditsUsed      = user?.creditsUsed  ?? 0;
  const creditsLimit     = user?.creditsLimit ?? 20;
  const creditsUnlimited = plan === 'Unlimited' || creditsLimit >= UNLIMITED_LIMIT_THRESHOLD;
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
  // limit, so the one line that's always visible is the one worth seeing. AI Content Check scans are
  // never unlimited in this data model (even on the Unlimited plan — a deliberate fair-use cap,
  // not a bug: see detectorChecksLimit above), so on an Unlimited plan this naturally surfaces
  // detector usage as the summary rather than two metrics that are permanently at 0%.
  // The AI Content Check meter only appears once it is worth the user's attention (above 70% of the
  // limit). On an Unlimited plan the badge says Unlimited while this cap still applies, so say so.
  const detectorVisible = isDetectorMeterVisible(detectorChecksUsed, detectorChecksLimit);
  const detectorLabelSuffix = isUnlimited ? ' (fair-use limit)' : '';
  const allUsageMetrics = [
    {
      key: 'words' as const, label: 'Words', used: wordsUsed, limit: wordsLimit, pct: usagePct, color: progressColor,
      unlimited: isUnlimited,
      // Factual, not marketing copy — describes what this number actually measures, since
      // "Words" / "Credits" aren't otherwise defined anywhere in the sidebar.
      description: 'Words processed this month across Humanise, Paraphraser, Grammar & Style and Summariser.',
    },
    {
      key: 'credits' as const, label: 'Credits', used: creditsUsed, limit: creditsLimit, pct: creditsPct, color: creditsColor,
      unlimited: creditsUnlimited,
      description: 'A separate per-action allowance spent by heavier AI operations (e.g. Write with AI).',
    },
    {
      key: 'detector' as const, label: 'AI Content Check scans', used: detectorChecksUsed, limit: detectorChecksLimit, pct: detectorPct, color: detectorColor,
      unlimited: false,
      // This is the one place the "Unlimited Plan" badge and a hard, non-zero limit coexist —
      // genuinely a separate fair-use cap on this one feature, not a data bug. Worth saying so
      // explicitly rather than leaving it looking contradictory.
      description: 'A fair-use limit kept separate from your plan\'s word/credit allowance, including on the Unlimited plan.',
    },
  ].filter(m => m.key !== 'detector' || detectorVisible);
  // Prompt #7 — the collapsed summary line shows whichever metric is actually closest to its
  // limit, so the one line that's always visible is the one worth seeing. AI Content Check scans are
  // never unlimited in this data model (even on the Unlimited plan — see its description above),
  // so on an Unlimited plan this naturally surfaces detector usage as the summary rather than two
  // metrics permanently at 0%.
  const usageSummary = allUsageMetrics.filter(m => !m.unlimited).sort((a, b) => b.pct - a.pct)[0]
    ?? allUsageMetrics[0];

  function renderSidebar({
    compact,
    showCollapseButton,
    showCloseButton,
    idPrefix,
  }: {
    compact: boolean;
    showCollapseButton: boolean;
    showCloseButton: boolean;
    /** Desktop and mobile copies can be in the DOM together, so element ids need a prefix. */
    idPrefix: string;
  }) {
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
          {toolSections.map((sec, i) => {
            // Icon-only mode has no section headers to click, so every entry stays visible there.
            const hasActive = sectionHasActive(sec.items);
            const open = compact || sectionOpen(sec.section, sec.items);
            const listId = sectionDomId(idPrefix, sec.section);
            return (
            <div key={sec.section} className={cn(i > 0 && 'mt-2')}>
              {!compact && (
                <>
                  {i > 0 && <div className="mx-5 mb-2" style={{ borderTop: '0.5px solid var(--border-sidebar)' }} />}
                  {/* The section with the current page stays open, so its toggle is inert (but still
                      announced as expanded) rather than collapsing nothing. */}
                  <button
                    type="button"
                    onClick={() => { if (!hasActive) toggleSection(sec.section); }}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-disabled={hasActive || undefined}
                    title={hasActive ? 'Contains the current page' : undefined}
                    className={cn(
                      'w-[calc(100%-1rem)] mx-2 mb-1 px-3 py-1 rounded-md flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]',
                      hasActive ? 'cursor-default' : 'hover:text-slate-700 hover:bg-[var(--surface-rail)]',
                    )}
                  >
                    <span>{sec.section}</span>
                    <ChevronDown
                      size={12}
                      aria-hidden="true"
                      className={cn('shrink-0 transition-transform duration-200', !open && '-rotate-90', hasActive && 'opacity-40')}
                    />
                  </button>
                </>
              )}
              <div id={listId} hidden={!open} className="space-y-0.5 px-2 mb-1">
                {sec.items.map((t) => {
                  const active = isActive(t);
                  // Badge sits on the label's line (not centred across both lines), so the
                  // description underneath gets the row's full width.
                  const textBlock = !compact && (
                    <span className="min-w-0 flex-1 flex flex-col text-left">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[15px] font-medium leading-tight truncate">{t.label}</span>
                        {t.badge && (
                          <span className="shrink-0 text-[10px] leading-none px-1.5 py-[3px] rounded-full font-semibold" style={{ background: active ? 'var(--surface-card)' : 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>{t.badge}</span>
                        )}
                      </span>
                      <span className={cn('text-[11px] font-normal leading-snug truncate', active ? 'text-slate-600' : 'text-slate-500')}>{t.description}</span>
                    </span>
                  );
                  if (t.disabled) {
                    return (
                      <button
                        key={t.label}
                        onClick={() => toast('Coming Phase 2')}
                        className={cn(
                          'w-full min-h-[38px] py-1 px-3 rounded-lg flex items-center gap-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]',
                          compact && 'justify-center',
                        )}
                        style={{ color: 'var(--text-secondary)' }}
                        title={compact ? `${t.label} — ${t.description}` : t.description}
                        aria-label={compact ? t.label : undefined}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-rail)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <t.icon size={18} className="shrink-0" />
                        {textBlock}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={t.label}
                      to={t.link}
                      onClick={onMobileClose}
                      aria-current={active ? 'page' : undefined}
                      aria-label={compact ? t.label : undefined}
                      className={cn(
                        'min-h-[38px] py-1 px-3 rounded-lg flex items-center gap-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]',
                        compact && 'justify-center',
                      )}
                      style={{
                        background: active ? 'var(--color-purple-tint)' : 'transparent',
                        color: active ? 'var(--color-purple-text)' : 'var(--text-secondary)',
                      }}
                      title={compact ? `${t.label} — ${t.description}` : t.description}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--surface-rail)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <t.icon size={18} className="shrink-0" />
                      {textBlock}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </NavScrollArea>

        {/* Footer: usage only. Account actions (Settings, Billing, History, Admin, Log out) live in
            the header's AccountMenu, the single account entry point. */}
        <div className="shrink-0" style={{ borderTop: '0.5px solid var(--border-sidebar)' }}>
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
                  className="w-full mb-1.5 px-2 py-1.5 rounded-lg transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-rail)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {usageSummaryText(usageSummary, isUnlimited)}
                    </span>
                    <ChevronUp size={12} aria-hidden="true" className={cn('shrink-0 transition-transform duration-200 ml-2 text-slate-500', !usageExpanded && 'rotate-180')} />
                  </div>
                  {showUsageBar(usageSummary) && (
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
                  )}
                  {usageSummary.key === 'detector' && (
                    <p className="text-[10px] mt-1 text-slate-500">
                      Fair-use limit, separate from your plan
                    </p>
                  )}
                </button>

                {usageExpanded && (
                  <div id="sidebar-usage-detail" className="mb-2 space-y-3 px-2 pt-1">
                    {allUsageMetrics.map(m => (
                      <div key={m.key} title={m.description}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[13px] text-slate-500">{m.label} this month{m.key === 'detector' ? detectorLabelSuffix : ''}</p>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {m.unlimited
                              ? `${m.used.toLocaleString()} used · no limit`
                              : `${m.used.toLocaleString()} of ${m.limit.toLocaleString()} used`}
                          </p>
                          {!m.unlimited && (
                            <p className="text-[13px] text-slate-500">
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
                  title={usageSummaryText({ key: 'words', used: wordsUsed, limit: wordsLimit, unlimited: isUnlimited }, isUnlimited)}
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
          idPrefix: 'sidebar',
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
                idPrefix: 'mobile-sidebar',
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
