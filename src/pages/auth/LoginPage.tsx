import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      // Try extracting message, custom error text, or fallback
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
  const { login } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [apiError, setApiError] = useState<string | null>(null)

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
      navigate('/app')
    } catch (err: unknown) {
      setApiError(getLoginErrorMessage(err))
      setShakeKey((k) => k + 1)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen animated-gradient-bg grid-pattern flex items-center justify-center px-4">
      {/* Decorative orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-secondary/20 blur-[100px]" />
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
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4 ml-1"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>
        
        <div className="glass rounded-xl p-8 shadow-elevated border border-white/10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary mb-4">
              <Sparkles size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-text-main">HumaniseAI</h1>
            <p className="text-muted mt-1 text-sm">Welcome back</p>
          </div>

          {/* Social Sign In Options First */}
          <div className="space-y-4">
            <GoogleButton label="Continue with Google" />
          </div>

          {/* Correctly Positioned Visual Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-xs text-muted font-medium uppercase tracking-wider">Or email login</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Inline API error banner */}
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
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{apiError}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-text-main mb-1.5">
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
                  errors.email && 'border-error focus:ring-error/50 focus:border-error',
                )}
              />
              {errors.email && (
                <p id="login-email-error" role="alert" className="mt-1 text-xs text-error">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-sm font-medium text-text-main">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:text-secondary transition-colors"
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
                    errors.password && 'border-error focus:ring-error/50 focus:border-error',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text-main transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" role="alert" className="mt-1 text-xs text-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary bg-slate-900 border-white/10"
                />
                <span className="text-sm text-muted">Remember me</span>
              </label>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
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

          {/* Secondary CTA Route */}
          <p className="text-center text-sm text-muted mt-6">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-primary hover:text-secondary font-medium transition-colors"
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