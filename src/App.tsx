import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { AppShell } from './components/layout/AppShell'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))
const EditorPage = lazy(() => import('./pages/app/EditorPage'))
const HistoryPage = lazy(() => import('./pages/app/HistoryPage'))
const AccountPage = lazy(() => import('./pages/app/AccountPage'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const DetectorPage = lazy(() => import('./pages/DetectorPage'))
const DetectorHistoryPage = lazy(() => import('./pages/DetectorHistoryPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ParaphrasePage = lazy(() => import('./pages/app/ParaphrasePage'))
const GrammarPage    = lazy(() => import('./pages/app/GrammarPage'))
const PlagiarismPage  = lazy(() => import('./pages/app/PlagiarismPage'))
const SummarisePage   = lazy(() => import('./pages/app/SummarisePage'))

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
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

  useEffect(() => {
    void initialize()
  }, [initialize])

  // Show loader while the silent refresh is in flight so protected routes
  // don't flash the login page before the cookie exchange completes.
  if (isLoading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/faq" element={<FaqPage />} />

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
            <Route path="billing" element={<AccountPage />} />
            <Route path="upgrade" element={<PricingPage />} />
            <Route path="detector/history" element={<DetectorHistoryPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminDashboard />} />
          <Route path="/admin/stats" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: '#1E293B' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#1E293B' },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}
