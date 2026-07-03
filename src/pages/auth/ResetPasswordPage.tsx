import React, { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { authApi } from '../../api/auth'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

// ─── Password strength indicator ──────────────────────────────────────────────

const STRENGTH_CHECKS = [
  { label: '8+ characters',    test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number',           test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character',test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function PasswordStrengthIndicator({ password }: { password: string }) {
  const checks = STRENGTH_CHECKS.map((c) => ({ ...c, passed: c.test(password) }))
  const score = checks.filter((c) => c.passed).length

  const label =
    score === 0 ? '' : score === 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'

  const barColor =
    score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-yellow-400' : 'bg-emerald-500'

  const labelColor =
    score <= 1 ? 'text-red-600' : score === 2 ? 'text-amber-600' : score === 3 ? 'text-yellow-600' : 'text-emerald-600'

  if (!password) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-2 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#e0e0da] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(score / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
            className={cn('h-full rounded-full transition-colors duration-300', barColor)}
          />
        </div>
        {label && (
          <span className={cn('text-xs font-medium w-14 text-right', labelColor)}>{label}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {checks.map((c) => (
          <span
            key={c.label}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              c.passed ? 'text-emerald-600' : 'text-text-sec',
            )}
          >
            <CheckCircle2
              size={10}
              className={c.passed ? 'text-emerald-600' : 'text-[#d1d5db]'}
            />
            {c.label}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Password field with toggle ───────────────────────────────────────────────

interface PasswordFieldProps {
  id: string
  label: string
  placeholder?: string
  error?: string
  errorId?: string
  registration: React.InputHTMLAttributes<HTMLInputElement>
}

function PasswordField({ id, label, placeholder, error, errorId, registration }: PasswordFieldProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-pri">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-mut pointer-events-none">
          <Lock size={15} />
        </div>
        <input
          {...registration}
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error && errorId ? errorId : undefined}
          className={cn(
            'input-base pl-10 pr-10',
            error && 'border-red-400',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-text-mut hover:text-text-pri transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && errorId && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={32} className="text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-text-pri mb-2">Password Reset!</h2>
      <p className="text-sm text-text-sec mb-6">
        Your password has been updated successfully. You can now sign in with your new password.
      </p>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-accent to-[#a855f7] text-white hover:opacity-90 transition-opacity"
      >
        Sign In
        <ArrowLeft size={14} className="rotate-180" />
      </Link>
    </motion.div>
  )
}

// ─── Invalid token state ──────────────────────────────────────────────────────

function InvalidTokenState() {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
        <Lock size={28} className="text-red-600" />
      </div>
      <h2 className="text-xl font-bold text-text-pri mb-2">Invalid Reset Link</h2>
      <p className="text-sm text-text-sec mb-6">
        This password reset link is invalid or has expired. Please request a new one.
      </p>
      <Link
        to="/forgot-password"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-accent to-[#a855f7] text-white hover:opacity-90 transition-opacity"
      >
        Request New Link
      </Link>
    </div>
  )
}

// ─── Main ResetPasswordPage ───────────────────────────────────────────────────

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [succeeded, setSucceeded] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const password = watch('password', '')

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!token) throw new Error('Missing token')
      return authApi.resetPassword(token, data.password)
    },
    onSuccess: () => {
      setSucceeded(true)
      toast.success('Password reset successfully!')
      setTimeout(() => navigate('/login'), 2000)
    },
    onError: () => {
      toast.error('This reset link is invalid or has expired. Please try again.')
    },
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface-card border border-border-h rounded-2xl p-8 shadow-elevated">
          <InvalidTokenState />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-100/70 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-100/50 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-accent to-[#a855f7] mb-4">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-pri">Reset your password</h1>
          <p className="text-sm text-text-sec mt-2">
            Choose a strong new password for your account
          </p>
        </div>

        <div className="bg-surface-card border border-border-h rounded-2xl p-7 shadow-elevated">
          {succeeded ? (
            <SuccessState />
          ) : (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
              <PasswordField
                id="reset-password"
                label="New Password"
                placeholder="Create a strong password"
                error={errors.password?.message}
                errorId="reset-password-error"
                registration={register('password')}
              />

              <PasswordStrengthIndicator password={password} />

              <PasswordField
                id="reset-confirm"
                label="Confirm Password"
                placeholder="Repeat your new password"
                error={errors.confirmPassword?.message}
                errorId="reset-confirm-error"
                registration={register('confirmPassword')}
              />

              {/* API error banner */}
              {mutation.isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
                >
                  This reset link is invalid or has expired.{' '}
                  <Link
                    to="/forgot-password"
                    className="font-semibold underline underline-offset-2 hover:text-red-900 transition-colors"
                  >
                    Request a new one
                  </Link>
                  .
                </motion.div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2 !h-11 text-sm font-semibold"
              >
                {mutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {mutation.isPending ? 'Resetting…' : 'Reset Password'}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors"
                >
                  <ArrowLeft size={13} />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPasswordPage
