import { useEffect, lazy, Suspense, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useLibraryStore, migrateLocalLibraryIfPresent } from './store/libraryStore'
import { useWebLibraryStore, migrateLocalWebLibraryIfPresent } from './store/webLibraryStore'
import { useStudioStore, migrateLocalStudioIfPresent } from './store/studioStore'
import { useWorkbenchStore, migrateLocalPinnedChartsIfPresent } from './store/workbenchStore'
import { AppShell } from './components/layout/AppShell'
import { ScrollToTop } from './components/layout/ScrollToTop'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const EditorPage = lazy(() => import('./pages/app/EditorPage'))
const HistoryPage = lazy(() => import('./pages/app/HistoryPage'))
const AccountPage = lazy(() => import('./pages/app/AccountPage'))
const BillingPage = lazy(() => import('./pages/app/BillingPage'))
const MockCheckoutPage = lazy(() => import('./pages/app/MockCheckoutPage'))
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'))
const AdminSubscriptionsPage = lazy(() => import('./pages/admin/AdminSubscriptionsPage'))
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'))
const AdminPlansPage = lazy(() => import('./pages/admin/AdminPlansPage'))
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage'))
const DetectorPage = lazy(() => import('./pages/DetectorPage'))
const DetectorHistoryPage = lazy(() => import('./pages/DetectorHistoryPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const CareersPage = lazy(() => import('./pages/CareersPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PopiaPage = lazy(() => import('./pages/PopiaPage'))
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'))
const ParaphrasePage = lazy(() => import('./pages/app/ParaphrasePage'))
const GrammarPage    = lazy(() => import('./pages/app/GrammarPage'))
const PlagiarismPage  = lazy(() => import('./pages/app/PlagiarismPage'))
const SummarisePage   = lazy(() => import('./pages/app/SummarisePage'))
const AnalystPage     = lazy(() => import('./pages/app/AnalystPage'))
const WorkbenchPage   = lazy(() => import('./pages/app/WorkbenchPage'))
const DocumentChatPage = lazy(() => import('./pages/app/DocumentChatPage'))
const CitationPage     = lazy(() => import('./pages/app/CitationPage'))
const FlashcardPage    = lazy(() => import('./pages/app/FlashcardPage'))
const LecturePage      = lazy(() => import('./pages/app/LecturePage'))
const LibraryPage      = lazy(() => import('./pages/app/LibraryPage'))
const DocumentEditorPage = lazy(() => import('./pages/app/DocumentEditorPage'))
const WebLibraryPage      = lazy(() => import('./pages/app/WebLibraryPage'))
const FindPapersPage      = lazy(() => import('./pages/app/FindPapersPage'))
const CollectionsPage     = lazy(() => import('./pages/app/CollectionsPage'))
const CollectionDetailPage = lazy(() => import('./pages/app/CollectionDetailPage'))
const WebLibraryPdfViewerPage = lazy(() => import('./pages/app/WebLibraryPdfViewerPage'))
const ProposalStudioPage  = lazy(() => import('./pages/app/ProposalStudioPage'))
const ThesisStudioPage    = lazy(() => import('./pages/app/ThesisStudioPage'))
const ResearchAgentPage   = lazy(() => import('./pages/app/ResearchAgentPage'))
const DocumentViewPage    = lazy(() => import('./pages/app/DocumentViewPage'))
const ResearchDashboardPage = lazy(() => import('./pages/app/ResearchDashboardPage'))
const SystematicReviewPage          = lazy(() => import('./pages/app/SystematicReviewPage'))
const SystematicReviewWorkspacePage = lazy(() => import('./pages/app/SystematicReviewWorkspacePage'))
const LiteratureReviewPage          = lazy(() => import('./pages/app/LiteratureReviewPage'))
const LiteratureDiscoveryProgressPage = lazy(() => import('./pages/app/LiteratureDiscoveryProgressPage'))
const ReviewerPage                  = lazy(() => import('./pages/app/ReviewerPage'))
const ReviewerWorkspacePage         = lazy(() => import('./pages/app/ReviewerWorkspacePage'))
const CitationIntegrityPage         = lazy(() => import('./pages/app/CitationIntegrityPage'))

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(_: Error, info: ErrorInfo) { console.error('Chunk load error:', info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-page)' }}>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>A page failed to load — this is usually a network blip.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--color-purple)' }}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-page)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--color-purple)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    </div>
  )
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  return <Outlet />
}

function AdminRoute() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'Admin') return <Navigate to="/app" replace />
  return <Outlet />
}

function GuestRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/app" replace />
  return <Outlet />
}

function AppInner() {
  const initialize = useAuthStore((s) => s.initialize)
  const isLoading = useAuthStore((s) => s.isLoading)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  useEffect(() => {
    void initialize()
  }, [initialize])

  // Documents are API-backed now, scoped server-side by the authenticated user —
  // load this account's library on login/switch, and drop it from memory on logout
  // so a shared browser never shows a signed-out state with stale data lingering.
  useEffect(() => {
    if (userId) {
      void (async () => {
        await migrateLocalLibraryIfPresent(userId)
        await useLibraryStore.getState().loadDocuments()
      })()
      void (async () => {
        await migrateLocalWebLibraryIfPresent(userId)
        await useWebLibraryStore.getState().loadDocuments()
      })()
      void (async () => {
        await migrateLocalStudioIfPresent(userId)
        await useStudioStore.getState().loadDocuments()
      })()
      void (async () => {
        await migrateLocalPinnedChartsIfPresent(userId)
        await useWorkbenchStore.getState().loadPinnedCharts()
      })()
    } else {
      useLibraryStore.getState().clear()
      useWebLibraryStore.getState().clear()
      useStudioStore.getState().clear()
      useWorkbenchStore.getState().clearPinnedCharts()
    }
  }, [userId])

  // Show loader while the silent refresh is in flight so protected routes
  // don't flash the login page before the cookie exchange completes.
  if (isLoading) return <PageLoader />

  return (
    <ChunkErrorBoundary>
    <ScrollToTop />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/popia" element={<PopiaPage />} />
        <Route path="/cookies" element={<CookiePolicyPage />} />

        {/* Guest only */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Route>

        {/* Protected app routes — all share AppShell (sidebar + navbar) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/humaniser" replace />} />
            <Route path="humaniser" element={<EditorPage />} />
            <Route path="paraphrase" element={<ParaphrasePage />} />
            <Route path="grammar"    element={<GrammarPage />} />
            <Route path="plagiarism" element={<PlagiarismPage />} />
            <Route path="summarise"  element={<SummarisePage />} />
            <Route path="detector" element={<DetectorPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="upgrade" element={<PricingPage />} />
            <Route path="checkout/mock/:sessionId" element={<MockCheckoutPage />} />
            <Route path="detector/history" element={<DetectorHistoryPage />} />
            <Route path="analyst"       element={<AnalystPage />} />
            <Route path="document-chat" element={<DocumentChatPage />} />
            <Route path="citations"     element={<CitationPage />} />
            <Route path="flashcards"    element={<FlashcardPage />} />
            <Route path="lecture"       element={<LecturePage />} />
            <Route path="workbench"     element={<WorkbenchPage />} />
            <Route path="library"       element={<LibraryPage />} />
            <Route path="editor/new"              element={<DocumentEditorPage />} />
            <Route path="editor/:documentId"      element={<DocumentEditorPage />} />
            <Route path="web-library"             element={<WebLibraryPage />} />
            <Route path="web-library/find"        element={<FindPapersPage />} />
            <Route path="web-library/collections" element={<CollectionsPage />} />
            <Route path="web-library/collections/:collectionId" element={<CollectionDetailPage />} />
            <Route path="web-library/papers/:workId/pdf" element={<WebLibraryPdfViewerPage />} />
            <Route path="proposal-studio"           element={<ProposalStudioPage />} />
            <Route path="thesis-studio"              element={<ThesisStudioPage />} />
            <Route path="research-agent/:projectId" element={<ResearchAgentPage />} />
            <Route path="research-agent/:projectId/document" element={<DocumentViewPage />} />
            <Route path="research-agent/:projectId/dashboard" element={<ResearchDashboardPage />} />
            <Route path="systematic-review"     element={<SystematicReviewPage />} />
            <Route path="systematic-review/:id" element={<SystematicReviewWorkspacePage />} />
            <Route path="literature-review"     element={<LiteratureReviewPage />} />
            <Route path="literature-review/discovery" element={<LiteratureDiscoveryProgressPage />} />
            <Route path="reviewer"     element={<ReviewerPage />} />
            <Route path="reviewer/:id" element={<ReviewerWorkspacePage />} />
            <Route path="citation-integrity" element={<CitationIntegrityPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/plans" element={<AdminPlansPage />} />
          <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ChunkErrorBoundary>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppInner />
          <Toaster
            position="top-right"
            containerStyle={{ top: 80 }}
            toastOptions={{
              duration: 4000,
              style: {
                background: '#ffffff',
                color: '#1a1a18',
                border: '0.5px solid #e0e0da',
                borderRadius: '10px',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#ffffff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}
