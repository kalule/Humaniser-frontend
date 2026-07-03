import Link from 'next/link'
import { APP_URL } from '../lib/config'

const TOOLS = [
  { href: '/tools/humaniser',   label: 'AI Humaniser'    },
  { href: '/tools/ai-detector', label: 'AI Detector'     },
  { href: '/tools/paraphraser', label: 'Paraphraser'     },
  { href: '/tools/grammar',     label: 'Grammar Checker' },
  { href: '/tools/plagiarism',  label: 'Plagiarism Check'},
  { href: '/tools/summariser',  label: 'Summariser'      },
]

export default function Footer() {
  return (
    /* Section surface (#f1f5f9) with top hairline border — matches main app footer pattern */
    <footer className="border-t border-[#e0e0da] bg-[#f1f5f9] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-[#1a1a18] mb-3">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-black text-white">H</span>
              HumaniseAI
            </Link>
            <p className="text-sm text-[#888888] leading-relaxed">
              South Africa&apos;s elite AI text workspace. Built for students, professionals, and creators.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-3">Tools</p>
            <ul className="space-y-2">
              {TOOLS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-[#555555] hover:text-[#1a1a18] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-3">Product</p>
            <ul className="space-y-2">
              {[
                { href: '/pricing',              label: 'Pricing'       },
                { href: `${APP_URL}/register`,   label: 'Sign up free'  },
                { href: `${APP_URL}/login`,      label: 'Sign in'       },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-[#555555] hover:text-[#1a1a18] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-3">Legal</p>
            <ul className="space-y-2">
              {[
                { href: '/privacy', label: 'Privacy Policy'   },
                { href: '/terms',   label: 'Terms of Service' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-[#555555] hover:text-[#1a1a18] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#e0e0da] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#888888]">© {new Date().getFullYear()} HumaniseAI. All rights reserved.</p>
          <p className="text-xs text-[#888888]">Made in South Africa 🇿🇦</p>
        </div>
      </div>
    </footer>
  )
}
