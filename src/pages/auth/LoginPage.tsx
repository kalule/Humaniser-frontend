import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleButton } from '../../components/ui/GoogleButton'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

function getLoginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status

    if (status === 401 || status === 400) {
      const data = err.response?.data
      const serverMsg = data?.message || data?.error || data?.title
      if (serverMsg && typeof serverMsg === 'string' && serverMsg.length < 120) {
        return serverMsg
      }
      return 'Invalid email or password.'
    }

    if (status === 429) {
      return 'Too many login attempts. Please wait a moment and try again.'
    }

    if (!err.response || (status && status >= 500)) {
      return 'Something went wrong on our end. Please try again in a moment.'
    }
  }
  return 'Unable to sign in. Please try again.'
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [apiError, setApiError] = useState<string | null>(null)

  // Authentication is the source of truth for leaving this page. Keeping the
  // redirect reactive covers email login, Google login, and a session restored
  // while /login is already mounted; it also avoids coupling navigation to the
  // lifetime of one submit callback.
  useEffect(() => {
    if (!isAuthenticated) return

    const requestedPath = (location.state as { from?: unknown } | null)?.from
    const destination = typeof requestedPath === 'string' &&
      (requestedPath === '/app' || requestedPath.startsWith('/app/'))
      ? requestedPath
      : '/app'

    navigate(destination, { replace: true })
  }, [isAuthenticated, location.state, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  })

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null)
    setIsLoading(true)
    try {
      const res = await authApi.login({ email: data.email, password: data.password })
      login(res.data)
      toast.success('Welcome back!')
    } catch (err: unknown) {
      setApiError(getLoginErrorMessage(err))
      setShakeKey((k) => k + 1)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background orbs — light purple tint on the page surface */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-100/70 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-100/50 blur-[120px]" />
      </div>

      <motion.div
        key={shakeKey}
        animate={
          shakeKey > 0
            ? { x: [0, -10, 10, -10, 10, -6, 6, -3, 3, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="w-full max-w-md relative z-10"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors mb-5 ml-1"
        >
          <ArrowLeft size={15} />
          Back to home
        </Link>

        {/* Card — white surface matching app-wide light theme */}
        <div className="bg-surface-card rounded-2xl p-8 shadow-elevated border border-border-h">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-accent to-[#a855f7] mb-4">
              <Sparkles size={22} className="text-white" />
            </div>
            {/* Wordmark at full brand purple — #7c3aed = 5.26:1 on white, passes WCAG AA */}
            <h1 className="text-2xl font-bold text-purple-accent">HumaniseAI</h1>
            {/* Subtitle at #555555 = 7.46:1 on white */}
            <p className="text-text-sec mt-1 text-sm">Welcome back</p>
          </div>

          {/* Social sign-in — kept first per UX pattern */}
          <GoogleButton label="Continue with Google" />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-border-h" />
            <span className="text-xs text-text-sec font-medium uppercase tracking-wider">
              or email
            </span>
            <div className="flex-1 border-t border-border-h" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Server-side / rate-limit error banner */}
            <AnimatePresence>
              {apiError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{apiError}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-text-pri mb-1.5"
              >
                Email address
              </label>
              <input
                {...register('email', { onChange: () => setApiError(null) })}
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                className={cn(
                  'input-base',
                  errors.email && 'border-red-400',
                )}
              />
              {errors.email && (
                <p
                  id="login-email-error"
                  role="alert"
                  className="mt-1.5 flex items-center gap-1 text-xs text-red-600"
                >
                  <AlertCircle size={12} className="shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium text-text-pri"
                >
                  Password
                </label>
                {/* Right-aligned "Forgot password?" — clear vertical separation from label */}
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-purple-accent hover:text-purple-text transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password', { onChange: () => setApiError(null) })}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  className={cn(
                    'input-base pr-11',
                    errors.password && 'border-red-400',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-mut hover:text-text-pri transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p
                  id="login-password-error"
                  role="alert"
                  className="mt-1.5 flex items-center gap-1 text-xs text-red-600"
                >
                  <AlertCircle size={12} className="shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="w-4 h-4 rounded accent-purple-accent"
                />
                <span className="text-sm text-text-sec">Remember me</span>
              </label>
            </div>

            {/* Submit — loading state prevents double-submit; !h-11 = 44px touch target */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register CTA */}
          <p className="text-center text-sm text-text-sec mt-6">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-purple-accent hover:text-purple-text transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
