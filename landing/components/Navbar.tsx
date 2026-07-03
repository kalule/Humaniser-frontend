import Link from 'next/link'
import { APP_URL } from '../lib/config'

const NAV_LINKS = [
  { href: '/tools/humaniser',   label: 'Humaniser'  },
  { href: '/tools/ai-detector', label: 'AI Detector' },
  { href: '/tools/paraphraser', label: 'Paraphraser' },
  { href: '/tools/grammar',     label: 'Grammar'     },
  { href: '/tools/plagiarism',  label: 'Plagiarism'  },
  { href: '/tools/summariser',  label: 'Summariser'  },
  { href: '/pricing',           label: 'Pricing'     },
]

export default function Navbar() {
  return (
    <div className="sticky top-0 z-50">
      {/* Announcement bar — soft violet tint, dark text (platform token: --color-purple-tint) */}
      <div className="bg-[#ede9fe] border-b border-violet-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-center gap-3 text-center">
          <span className="text-sm font-medium text-[#5b21b6]">
            🎉 Now live: Academic Summariser with Unisa, UCT &amp; Wits format support
          </span>
          <Link
            href={`${APP_URL}/register`}
            className="text-sm font-semibold text-[#4c1d95] hover:text-[#1a1a18] underline underline-offset-2 transition-colors whitespace-nowrap"
          >
            Try free →
          </Link>
        </div>
      </div>

      {/* Nav bar — white surface, hairline border (platform token: --surface-card / --border-hairline) */}
      <header className="border-b border-[#e0e0da] bg-white/95 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-[#1a1a18]">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-black text-white">H</span>
            HumaniseAI
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3.5 py-2 text-sm text-[#555555] hover:text-[#1a1a18] rounded-lg hover:bg-[#f1f5f9] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`${APP_URL}/login`}
              className="text-sm text-[#555555] hover:text-[#1a1a18] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href={`${APP_URL}/register`}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#7c3aed] text-white hover:bg-[#4c1d95] transition-colors"
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>
    </div>
  )
}
