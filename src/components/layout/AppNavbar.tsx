import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLibraryStore } from '../../store/libraryStore';
import { useEditorFlushStore } from '../../store/editorFlushStore';
import { resolvePageTitle, resolvePageSubtitle, matchEditorDocumentId, resolveEditorHeaderTitle } from '../../config/navigation';
import { AccountMenu } from './AccountMenu';

export function AppNavbar({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const editorDocumentId = matchEditorDocumentId(location.pathname);
  const libraryHasLoaded = useLibraryStore(s => s.hasLoaded);
  const libraryDocuments = useLibraryStore(s => s.documents);
  const editorTitle = editorDocumentId
    ? resolveEditorHeaderTitle(editorDocumentId, libraryHasLoaded, libraryDocuments)
    : null;

  const pageTitle = resolvePageTitle(location.pathname);
  const pageSubtitle = resolvePageSubtitle(location.pathname);
  const tabTitle = editorTitle ? editorTitle.tabTitle : `${pageTitle} · HumaniseAI`;

  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);

  // Same flush DocumentEditorPage's own "← Back to Library" button uses (registered
  // via useEditorFlushStore while an editor is mounted) — without this, leaving via
  // the breadcrumb instead of the in-editor button would silently skip it.
  const handleDocumentsBreadcrumbClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const flush = useEditorFlushStore.getState().flush;
    if (flush) await flush();
    navigate('/app/library');
  };

  return (
    <header
      // On an editor route, DocumentEditorPage's own header row becomes the sole
      // header on desktop (it renders its own "Documents / {title}" breadcrumb plus
      // <AccountMenu /> directly) — this bar collapses to nothing there instead of
      // stacking a second row above it. Mobile is untouched: this bar still renders
      // in full (hamburger, logo, breadcrumb, account menu) exactly as before, since
      // the editor's own row doesn't duplicate any of that below `md`.
      className={cn('h-16 sticky top-0 z-30 flex items-center justify-between px-6', editorTitle && 'md:hidden')}
      style={{
        background: 'var(--surface-card)',
        borderBottom: '0.5px solid var(--border-hairline)',
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onMobileMenuClick}
          aria-label="Open menu"
          className="md:hidden transition-colors text-slate-500 hover:text-[var(--text-primary)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-purple)]"
        >
          <Menu size={24} />
        </button>
        {editorTitle ? (
          <h1 className="font-semibold text-[22px] hidden sm:flex items-center gap-2 min-w-0" style={{ color: 'var(--text-primary)' }}>
            <a
              href="/app/library"
              onClick={handleDocumentsBreadcrumbClick}
              className="shrink-0 hover:underline text-slate-500"
            >
              Documents
            </a>
            <span className="shrink-0 text-slate-500">/</span>
            {editorTitle.breadcrumbTitle === null ? (
              <span
                className="inline-block h-5 w-40 rounded animate-pulse"
                style={{ background: 'var(--surface-rail)' }}
                aria-label="Loading document title"
              />
            ) : (
              <span className="truncate" title={editorTitle.breadcrumbTitle}>
                {editorTitle.breadcrumbTitle}
              </span>
            )}
          </h1>
        ) : (
          // The tool's own description already sits beside it in the sidebar, so the header only adds a
          // subtitle when it says something the sidebar doesn't (a tab within the tool).
          <div className="hidden sm:flex items-baseline gap-3 min-w-0">
            <h1 className="font-semibold text-[22px] truncate shrink-0" style={{ color: 'var(--text-primary)' }}>
              {pageTitle}
            </h1>
            {pageSubtitle && <p className="truncate text-[13.5px] text-slate-600">{pageSubtitle}</p>}
          </div>
        )}
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
      <AccountMenu />
    </header>
  );
}
