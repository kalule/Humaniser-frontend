import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Sparkles, ArrowLeft, Check, Mail, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { OtpInput } from '../../components/ui/OtpInput'
import { GoogleButton } from '../../components/ui/GoogleButton'
import { cn } from '../../lib/utils'

// ── Step 1: Email ──────────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  name: z.string().max(100).optional(),
})
type EmailForm = z.infer<typeof emailSchema>

// ── Step 3: Password ───────────────────────────────────────────────────────
const passwordSchema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter required')
    .regex(/[a-z]/, 'One lowercase letter required')
    .regex(/[0-9]/, 'One number required'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type PasswordForm = z.infer<typeof passwordSchema>

// ── Password strength helpers ──────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map: Record<number, { label: string; color: string }> = {
    0: { label: '', color: 'bg-border' },
    1: { label: 'Weak', color: 'bg-red-500' },
    2: { label: 'Fair', color: 'bg-orange-500' },
    3: { label: 'Good', color: 'bg-amber-400' },
    4: { label: 'Strong', color: 'bg-emerald-500' },
    5: { label: 'Very Strong', color: 'bg-emerald-400' },
  }
  return { score, ...map[score] }
}

type Step = 'email' | 'otp' | 'password'

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 40, opacity: 0 }),
}

export function RegisterPage() {
  const navigate = useNavigate()
  const loginStore = useAuthStore((s) => s.login)

  const [step, setStep] = useState<Step>('email')
  const [direction, setDirection] = useState(1)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [otpError, setOtpError] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Email form ──────────────────────────────────────────────────────────
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })

  // ── Password form ───────────────────────────────────────────────────────
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })
  const watchedPassword = passwordForm.watch('password', '')
  const strength = getStrength(watchedPassword)

  // ── Resend cooldown timer ───────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const goTo = useCallback((next: Step, dir: number) => {
    setDirection(dir)
    setStep(next)
  }, [])

  // ── Step 1 submit ───────────────────────────────────────────────────────
  const handleEmailSubmit = emailForm.handleSubmit(async (data) => {
    setIsSubmitting(true)
    try {
      await authApi.sendOtp(data.email)
      setEmail(data.email)
      setName(data.name ?? '')
      setResendCooldown(60)
      goTo('otp', 1)
      toast.success('Verification code sent! Check your inbox.')
    } catch {
      toast.error('Failed to send code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  })

  // ── Resend OTP ──────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return
    setIsSubmitting(true)
    try {
      await authApi.sendOtp(email)
      setOtp(Array(6).fill(''))
      setOtpError(false)
      setResendCooldown(60)
      toast.success('New code sent!')
    } catch {
      toast.error('Failed to resend. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step 2 submit ───────────────────────────────────────────────────────
  const handleOtpSubmit = async () => {
    const code = otp.join('')
    if (code.length < 6) {
      setOtpError(true)
      toast.error('Enter all 6 digits.')
      return
    }
    setIsSubmitting(true)
    setOtpError(false)
    try {
      const res = await authApi.verifyOtp(email, code)
      setVerificationToken(res.data.verificationToken)
      goTo('password', 1)
    } catch (err: unknown) {
      setOtpError(true)
      const msg = (err as { message?: string })?.message ?? 'Invalid code. Try again.'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step 3 submit ───────────────────────────────────────────────────────
  const handlePasswordSubmit = passwordForm.handleSubmit(async (data) => {
    setIsSubmitting(true)
    try {
      const res = await authApi.registerWithOtp({
        email,
        password: data.password,
        name: name || undefined,
        verificationToken,
      })
      loginStore(res.data)
      toast.success('Account created! Welcome to HumaniseAI.')
      navigate('/app')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Registration failed. Please try again.'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  })

  const stepIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2
  const titles = ['Create your account', 'Verify your email', 'Set your password']
  const subtitles = [
    'Join thousands of writers using HumaniseAI',
    `We sent a 6-digit code to ${email}. It expires in 15 minutes.`,
    'Choose a strong password to protect your account.',
  ]

  return (
    <div className="min-h-screen animated-gradient-bg grid-pattern flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4 ml-1 relative z-10"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>
        {/* Card */}
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-elevated p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-3 shadow-glow">
              <Sparkles size={22} className="text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">HumaniseAI</span>
          </div>

          {/* Step progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === stepIndex ? 'w-8 bg-primary' : i < stepIndex ? 'w-3 bg-primary/40' : 'w-3 bg-border',
                )}
              />
            ))}
          </div>

          {/* Back button */}
          {step !== 'email' && (
            <button
              type="button"
              onClick={() => goTo(step === 'otp' ? 'email' : 'otp', -1)}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-4"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-main">{titles[stepIndex]}</h1>
            <p className="text-sm text-muted mt-1">{subtitles[stepIndex]}</p>
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
            {step === 'email' && (
              <motion.div
                key="email"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {/* Google first */}
                <GoogleButton label="Sign up with Google" />

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted">or with email</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-sm font-medium text-text-main mb-1.5">
                      Name <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      {...emailForm.register('name')}
                      id="reg-name"
                      autoComplete="name"
                      placeholder="Your name"
                      className="input-base"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-medium text-text-main mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                      <input
                        {...emailForm.register('email')}
                        id="reg-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={!!emailForm.formState.errors.email}
                        aria-describedby={emailForm.formState.errors.email ? 'reg-email-error' : undefined}
                        className={cn(
                          'input-base pl-9',
                          emailForm.formState.errors.email && 'border-red-500 focus:ring-red-500/40',
                        )}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <p id="reg-email-error" role="alert" className="text-xs text-red-400 mt-1">{emailForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {isSubmitting ? 'Sending code…' : 'Continue'}
                  </button>
                </form>

                <p className="text-center text-sm text-muted mt-5">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:text-secondary font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div
                key="otp"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-6"
              >
                {/* Email display */}
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-4 py-2.5">
                  <Mail size={15} className="text-primary shrink-0" />
                  <span className="text-sm text-text-main truncate">{email}</span>
                </div>

                {/* OTP boxes */}
                <OtpInput
                  value={otp}
                  onChange={(v) => { setOtp(v); setOtpError(false) }}
                  disabled={isSubmitting}
                  hasError={otpError}
                />

                {otpError && (
                  <p className="text-center text-sm text-red-400">Incorrect code. Please try again.</p>
                )}

                <button
                  type="button"
                  onClick={handleOtpSubmit}
                  disabled={isSubmitting || otp.join('').length < 6}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : null}
                  {isSubmitting ? 'Verifying…' : 'Verify Code'}
                </button>

                {/* Resend */}
                <div className="text-center">
                  <p className="text-sm text-muted">Didn't receive it?</p>
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-muted mt-1">
                      Resend in <span className="text-primary font-medium">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isSubmitting}
                      className="text-sm text-primary hover:text-secondary font-medium transition-colors mt-1 underline-offset-2 hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                {/* Google as fallback */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted text-center mb-3">Or skip verification entirely</p>
                  <GoogleButton label="Sign up with Google" />
                </div>
              </motion.div>
            )}

            {step === 'password' && (
              <motion.div
                key="password"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {/* Verified badge */}
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-4 py-2.5 mb-5">
                  <Check size={15} className="text-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-300">{email} verified</span>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {/* Password field */}
                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-medium text-text-main mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                      <input
                        {...passwordForm.register('password')}
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        aria-invalid={!!passwordForm.formState.errors.password}
                        aria-describedby={passwordForm.formState.errors.password ? 'reg-password-error' : undefined}
                        className={cn(
                          'input-base pl-9 pr-10',
                          passwordForm.formState.errors.password && 'border-red-500',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {watchedPassword && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex-1 h-1 rounded-full transition-all duration-300',
                                strength.score >= i ? strength.color : 'bg-border',
                              )}
                            />
                          ))}
                        </div>
                        <p className={cn('text-xs font-medium', {
                          'text-red-400': strength.score <= 1,
                          'text-orange-400': strength.score === 2,
                          'text-amber-400': strength.score === 3,
                          'text-emerald-400': strength.score >= 4,
                        })}>
                          {strength.label}
                        </p>
                      </div>
                    )}

                    {/* Criteria checklist */}
                    {watchedPassword && (
                      <ul className="mt-2 space-y-1">
                        {[
                          { ok: watchedPassword.length >= 8, text: 'At least 8 characters' },
                          { ok: /[A-Z]/.test(watchedPassword), text: 'One uppercase letter' },
                          { ok: /[a-z]/.test(watchedPassword), text: 'One lowercase letter' },
                          { ok: /[0-9]/.test(watchedPassword), text: 'One number' },
                        ].map(({ ok, text }) => (
                          <li key={text} className={cn('flex items-center gap-1.5 text-xs transition-colors', ok ? 'text-emerald-400' : 'text-muted')}>
                            <Check size={11} className={cn('shrink-0', ok ? 'opacity-100' : 'opacity-0')} />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {passwordForm.formState.errors.password && (
                      <p id="reg-password-error" role="alert" className="text-xs text-red-400 mt-1">{passwordForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-text-main mb-1.5">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
                      <input
                        {...passwordForm.register('confirmPassword')}
                        id="reg-confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                        aria-describedby={passwordForm.formState.errors.confirmPassword ? 'reg-confirm-error' : undefined}
                        className={cn(
                          'input-base pl-9 pr-10',
                          passwordForm.formState.errors.confirmPassword && 'border-red-500',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p id="reg-confirm-error" role="alert" className="text-xs text-red-400 mt-1">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {isSubmitting ? 'Creating account…' : 'Finish Sign Up'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-primary hover:underline">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  )
}

export default RegisterPage
