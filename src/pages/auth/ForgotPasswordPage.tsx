import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowLeft, CheckCircle, Loader2, Mail, AlertCircle } from 'lucide-react'
import { authApi } from '../../api/auth'
import { cn } from '../../lib/utils'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      await authApi.forgotPassword(data.email)
      setSuccess(true)
    } catch {
      // Always show success — don't leak whether the email exists
      setSuccess(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-100/70 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-100/50 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-surface-card rounded-2xl p-8 shadow-elevated border border-border-h">
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-accent to-[#a855f7] mb-4">
                    <Sparkles size={22} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-text-pri">Reset password</h1>
                  <p className="text-text-sec mt-1 text-sm">
                    Enter your email and we&apos;ll send a reset link
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-text-pri mb-1.5">
                      Email address
                    </label>
                    <input
                      {...register('email')}
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                      className={cn('input-base', errors.email && 'border-red-400')}
                    />
                    {errors.email && (
                      <p
                        id="forgot-email-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1 text-xs text-red-600"
                      >
                        <AlertCircle size={12} className="shrink-0" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold mt-2"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Mail size={16} />
                    )}
                    {isLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <div className="text-center mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to login
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 mb-5"
                >
                  <CheckCircle size={32} className="text-emerald-600" />
                </motion.div>

                <h2 className="text-2xl font-bold text-text-pri mb-2">Check your email</h2>
                <p className="text-text-sec text-sm leading-relaxed">
                  We&apos;ve sent a password reset link to{' '}
                  <span className="text-text-pri font-medium">{getValues('email')}</span>.
                  <br />
                  Check your inbox and follow the instructions.
                </p>

                <div className="mt-6 p-3 rounded-lg bg-[#f8fafc] border border-border-h text-xs text-text-sec text-left">
                  Didn&apos;t get the email? Check your spam folder, or{' '}
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-purple-accent hover:text-purple-text transition-colors underline-offset-2 underline"
                  >
                    try again
                  </button>
                  .
                </div>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors mt-6"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

export default ForgotPasswordPage
