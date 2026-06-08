import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react'
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
      // Show success regardless — don't leak whether email exists
      setSuccess(true)
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass rounded-xl p-8 shadow-elevated border border-white/10">
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
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary mb-4">
                    <Sparkles size={22} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-text-main">Reset password</h1>
                  <p className="text-muted mt-1 text-sm">
                    Enter your email and we&apos;ll send a reset link
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1.5">
                      Email address
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn(
                        'input-base',
                        errors.email && 'border-error focus:ring-error/50 focus:border-error',
                      )}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-error">{errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        Send reset link
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center mt-6">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text-main transition-colors"
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
                {/* Checkmark animation */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 border border-success/30 mb-5"
                >
                  <CheckCircle size={32} className="text-success" />
                </motion.div>

                <h2 className="text-2xl font-bold text-text-main mb-2">Check your email</h2>
                <p className="text-muted text-sm leading-relaxed">
                  We&apos;ve sent a password reset link to{' '}
                  <span className="text-text-main font-medium">{getValues('email')}</span>.
                  <br />
                  Check your inbox and follow the instructions.
                </p>

                <div className="mt-6 p-3 rounded-md bg-white/5 border border-border text-xs text-muted text-left">
                  Didn&apos;t get the email? Check your spam folder, or{' '}
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-primary hover:text-secondary transition-colors underline-offset-2 underline"
                  >
                    try again
                  </button>
                  .
                </div>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text-main transition-colors mt-6"
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
