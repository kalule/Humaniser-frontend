import { motion } from 'framer-motion'
import { Mail, MessageCircle, Clock, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const CONTACT_METHODS = [
  {
    icon: Mail,
    label: 'Email Support',
    detail: 'support@humaniseai.co.za',
    href: 'mailto:support@humaniseai.co.za',
    cta: 'Send an email',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp Support',
    detail: 'Chat with our South African support team',
    href: 'https://wa.me/27000000000',
    cta: 'Start a chat',
  },
]

export function ContactPage() {
  useDocumentTitle(
    'Contact HumaniseAI — South African Support Team',
    "Get in touch with HumaniseAI's South African support team by email or WhatsApp. We typically respond within a few hours.",
    '/contact',
  )

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-[#e0e0da] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-medium mb-5">
                <MessageCircle size={13} />
                Get in Touch
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-pri mb-3">
                Contact HumaniseAI
              </h1>
              <p className="text-text-sec text-base">
                Questions about the Humaniser, AI Detector, or your billing?
                Our South African support team is here to help.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Contact methods */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {CONTACT_METHODS.map((method, i) => (
              <motion.a
                key={method.label}
                href={method.href}
                target={method.href.startsWith('http') ? '_blank' : undefined}
                rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="group rounded-2xl border border-[#e0e0da] bg-white p-6 hover:border-indigo-300 hover:bg-[#f8fafc] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                  <method.icon size={18} className="text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold text-text-pri mb-1">{method.label}</h3>
                <p className="text-text-sec text-xs mb-4">{method.detail}</p>
                <span className="inline-flex items-center gap-1.5 text-indigo-600 text-xs font-medium group-hover:text-indigo-700 transition-colors">
                  {method.cta}
                  <ArrowRight size={12} />
                </span>
              </motion.a>
            ))}
          </div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#888888] mb-10"
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} />
              Typical response within a few hours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} />
              POPIA compliant, based in South Africa 🇿🇦
            </span>
          </motion.div>

          {/* Help centre pointer */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3 }}
            className="rounded-2xl border border-[#e0e0da] bg-[#f8fafc] p-6 text-center"
          >
            <HelpCircle size={22} className="text-[#888888] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-text-pri mb-1">Looking for a quick answer?</h3>
            <p className="text-text-sec text-xs mb-4">
              Check the Help Centre — most questions about word limits, tones, and billing are answered there.
            </p>
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors duration-150"
            >
              Visit the Help Centre
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ContactPage
