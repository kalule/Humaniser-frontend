import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

interface StaticPageLayoutProps {
  icon: LucideIcon
  badge: string
  title: string
  subtitle?: string
  children: ReactNode
}

export function StaticPageLayout({ icon: Icon, badge, title, subtitle, children }: StaticPageLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="border-b border-[#e0e0da] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-medium mb-5">
                <Icon size={13} />
                {badge}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-pri mb-3">{title}</h1>
              {subtitle && <p className="text-text-sec text-base max-w-xl mx-auto">{subtitle}</p>}
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="max-w-3xl mx-auto px-4 sm:px-6 py-12"
        >
          {children}
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}

export function StaticSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-pri mb-3">{heading}</h2>
      <div className="text-sm text-text-sec leading-relaxed space-y-3">{children}</div>
    </section>
  )
}
