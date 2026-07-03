import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Sparkles, ArrowLeft, Check, Mail, Lock, Loader2 } from 'lucide-react'
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
function getStrength(pw: string): { score: number; label: string; labelColor: string; barColor: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map: Record<number, { label: string; labelColor: string; barColor: string }> = {
    0: { label: '',            labelColor: '',                   barColor: 'bg-[#e0e0da]' },
    1: { label: 'Weak',        labelColor: 'text-red-600',       barColor: 'bg-red-500' },
    2: { label: 'Fair',        labelColor: 'text-orange-600',    barColor: 'bg-orange-500' },
    3: { label: 'Good',        labelColor: 'text-amber-600',     barColor: 'bg-amber-500' },
    4: { label: 'Strong',      labelColor: 'text-emerald-600',   barColor: 'bg-emerald-500' },
    5: { label: 'Very Strong', labelColor: 'text-emerald-600',   barColor: 'bg-emerald-400' },
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

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })
  const watchedPassword = passwordForm.watch('password', '')
  const strength = getStrength(watchedPassword)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const goTo = useCallback((next: Step, dir: number) => {
    setDirection(dir)
    setStep(next)
  }, [])

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
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-100/70 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-100/50 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors mb-5 ml-1"
        >
          <ArrowLeft size={15} /> Back to home
        </Link>

        {/* Card */}
        <div className="bg-surface-card rounded-2xl border border-border-h shadow-elevated p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-accent to-[#a855f7] flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-white" />
            </div>
            <span className="text-lg font-bold text-purple-accent">HumaniseAI</span>
          </div>

          {/* Step progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === stepIndex
                    ? 'w-8 bg-purple-accent'
                    : i < stepIndex
                    ? 'w-3 bg-[#7c3aed]/40'
                    : 'w-3 bg-[#e0e0da]',
                )}
              />
            ))}
          </div>

          {/* In-card back button */}
          {step !== 'email' && (
            <button
              type="button"
              onClick={() => goTo(step === 'otp' ? 'email' : 'otp', -1)}
              className="flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors mb-4"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}

          {/* Title / subtitle */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-pri">{titles[stepIndex]}</h1>
            <p className="text-sm text-text-sec mt-1">{subtitles[stepIndex]}</p>
          </div>

          {/* ── Animated step content ─────────────────────────────────────── */}
          <AnimatePresence mode="wait" custom={direction}>

            {/* STEP 1 — Email + name */}
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
                <GoogleButton label="Sign up with Google" />

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 border-t border-border-h" />
                  <span className="text-xs text-text-sec font-medium uppercase tracking-wider">or with email</span>
                  <div className="flex-1 border-t border-border-h" />
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-sm font-medium text-text-pri mb-1.5">
                      Name{' '}
                      <span className="text-text-sec font-normal">(optional)</span>
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
                    <label htmlFor="reg-email" className="block text-sm font-medium text-text-pri mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mut pointer-events-none"
                        aria-hidden="true"
                      />
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
                          emailForm.formState.errors.email && 'border-red-400',
                        )}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <p id="reg-email-error" role="alert" className="text-xs text-red-600 mt-1.5">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold mt-2"
                  >
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    {isSubmitting ? 'Sending code…' : 'Continue'}
                  </button>
                </form>

                <p className="text-center text-sm text-text-sec mt-5">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-purple-accent hover:text-purple-text transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* STEP 2 — OTP verification */}
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
                {/* Email confirmation pill */}
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2.5">
                  <Mail size={15} className="text-purple-accent shrink-0" />
                  <span className="text-sm text-text-pri truncate">{email}</span>
                </div>

                <OtpInput
                  value={otp}
                  onChange={(v) => { setOtp(v); setOtpError(false) }}
                  disabled={isSubmitting}
                  hasError={otpError}
                />

                {otpError && (
                  <p role="alert" className="text-center text-sm text-red-600">
                    Incorrect code. Please try again.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleOtpSubmit}
                  disabled={isSubmitting || otp.join('').length < 6}
                  className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? 'Verifying…' : 'Verify Code'}
                </button>

                {/* Resend */}
                <div className="text-center">
                  <p className="text-sm text-text-sec">Didn&apos;t receive it?</p>
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-text-sec mt-1">
                      Resend in{' '}
                      <span className="text-purple-accent font-medium">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isSubmitting}
                      className="text-sm font-medium text-purple-accent hover:text-purple-text transition-colors mt-1 underline-offset-2 hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                {/* Google fallback */}
                <div className="pt-4 border-t border-border-h">
                  <p className="text-xs text-text-sec text-center mb-3">Or skip verification entirely</p>
                  <GoogleButton label="Sign up with Google" />
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Password */}
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
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-5">
                  <Check size={15} className="text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700">{email} verified</span>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {/* Password field */}
                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-medium text-text-pri mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mut pointer-events-none"
                        aria-hidden="true"
                      />
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
                          passwordForm.formState.errors.password && 'border-red-400',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-mut hover:text-text-pri transition-colors"
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
                                strength.score >= i ? strength.barColor : 'bg-[#e0e0da]',
                              )}
                            />
                          ))}
                        </div>
                        {strength.label && (
                          <p className={cn('text-xs font-medium', strength.labelColor)}>
                            {strength.label}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Criteria checklist */}
                    {watchedPassword && (
                      <ul className="mt-2 space-y-1">
                        {[
                          { ok: watchedPassword.length >= 8,   text: 'At least 8 characters' },
                          { ok: /[A-Z]/.test(watchedPassword), text: 'One uppercase letter' },
                          { ok: /[a-z]/.test(watchedPassword), text: 'One lowercase letter' },
                          { ok: /[0-9]/.test(watchedPassword), text: 'One number' },
                        ].map(({ ok, text }) => (
                          <li
                            key={text}
                            className={cn(
                              'flex items-center gap-1.5 text-xs transition-colors',
                              ok ? 'text-emerald-600' : 'text-text-sec',
                            )}
                          >
                            <Check size={11} className={cn('shrink-0', ok ? 'opacity-100' : 'opacity-0')} />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {passwordForm.formState.errors.password && (
                      <p id="reg-password-error" role="alert" className="text-xs text-red-600 mt-1.5">
                        {passwordForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-text-pri mb-1.5">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mut pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        {...passwordForm.register('confirmPassword')}
                        id="reg-confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                        aria-describedby={
                          passwordForm.formState.errors.confirmPassword ? 'reg-confirm-error' : undefined
                        }
                        className={cn(
                          'input-base pl-9 pr-10',
                          passwordForm.formState.errors.confirmPassword && 'border-red-400',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-mut hover:text-text-pri transition-colors"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p id="reg-confirm-error" role="alert" className="text-xs text-red-600 mt-1.5">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold mt-2"
                  >
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    {isSubmitting ? 'Creating account…' : 'Finish Sign Up'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer — legal links */}
        <p className="text-center text-xs text-text-sec mt-4">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-purple-accent hover:underline">Terms</a>
          {' '}and{' '}
          <a href="/privacy" className="text-purple-accent hover:underline">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  )
}

export default RegisterPage
