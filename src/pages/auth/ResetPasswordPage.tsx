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
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function PasswordStrengthIndicator({ password }: { password: string }) {
  const checks = STRENGTH_CHECKS.map((c) => ({ ...c, passed: c.test(password) }))
  const score = checks.filter((c) => c.passed).length

  const label =
    score === 0 ? '' : score === 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'

  const barColor =
    score <= 1
      ? 'bg-red-500'
      : score === 2
        ? 'bg-amber-400'
        : score === 3
          ? 'bg-yellow-400'
          : 'bg-emerald-500'

  if (!password) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-2 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(score / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
            className={cn('h-full rounded-full transition-colors duration-300', barColor)}
          />
        </div>
        {label && (
          <span className="text-xs text-muted w-12 text-right">{label}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {checks.map((c) => (
          <span
            key={c.label}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              c.passed ? 'text-emerald-400' : 'text-muted',
            )}
          >
            <CheckCircle2 size={10} className={c.passed ? 'text-emerald-400' : 'text-muted/30'} />
            {c.label}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Password field with toggle ───────────────────────────────────────────────

interface PasswordFieldProps {
  label: string
  placeholder?: string
  error?: string
  registration: React.InputHTMLAttributes<HTMLInputElement>
}

function PasswordField({ label, placeholder, error, registration }: PasswordFieldProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-main">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          <Lock size={15} />
        </div>
        <input
          {...registration}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className={cn(
            'w-full bg-card border rounded-md pl-10 pr-10 py-3 text-sm text-text-main placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all',
            error ? 'border-red-500' : 'border-border',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text-main transition-colors focus:outline-none"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
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
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={32} className="text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold text-text-main mb-2">Password Reset!</h2>
      <p className="text-sm text-muted mb-6">
        Your password has been updated successfully. You can now sign in with your new password.
      </p>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
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
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock size={28} className="text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-text-main mb-2">Invalid Reset Link</h2>
      <p className="text-sm text-muted mb-6">
        This password reset link is invalid or has expired. Please request a new one.
      </p>
      <Link
        to="/forgot-password"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
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
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
          <InvalidTokenState />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary mb-4">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-main">Reset your password</h1>
          <p className="text-sm text-muted mt-2">
            Choose a strong new password for your account
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-7 shadow-card">
          {succeeded ? (
            <SuccessState />
          ) : (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
              <PasswordField
                label="New Password"
                placeholder="Create a strong password"
                error={errors.password?.message}
                registration={register('password')}
              />

              {/* Strength indicator */}
              <PasswordStrengthIndicator password={password} />

              <PasswordField
                label="Confirm Password"
                placeholder="Repeat your new password"
                error={errors.confirmPassword?.message}
                registration={register('confirmPassword')}
              />

              {/* Error from API */}
              {mutation.isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/30 text-sm text-red-400"
                >
                  This reset link is invalid or has expired.{' '}
                  <Link
                    to="/forgot-password"
                    className="font-semibold underline underline-offset-2 hover:text-red-300 transition-colors"
                  >
                    Request a new one
                  </Link>
                  .
                </motion.div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-semibold transition-all duration-200',
                  'bg-gradient-to-r from-primary to-secondary text-white',
                  'hover:opacity-90 hover:shadow-glow',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                )}
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
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text-main transition-colors"
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
