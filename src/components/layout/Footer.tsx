import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, Twitter, Linkedin, Instagram } from 'lucide-react'

interface FooterLink {
  label: string
  href: string
  soon?: boolean
}

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'AI Humaniser', href: '/app/humaniser' },
  { label: 'AI Detector', href: '/app/detector' },
  { label: 'Paraphraser', href: '/app/paraphrase' },
  { label: 'Grammar Checker', href: '/app/grammar' },
  { label: 'Summariser', href: '/app/summarise' },
]

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'How it Works', href: '/#how-it-works' },
  { label: 'Blog', href: '/blog' },
  { label: 'Careers', href: '/careers' },
]

const SUPPORT_LINKS: FooterLink[] = [
  { label: 'FAQ', href: '/faq' },
  { label: 'WhatsApp Support', href: 'https://wa.me/27000000000' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Feature Requests', href: '/feedback' },
]

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'GDPR / POPIA Compliance', href: '/popia' },
  { label: 'Cookie Policy', href: '/cookies' },
]

const SOCIAL_LINKS = [
  { label: 'Twitter / X', href: 'https://twitter.com', icon: Twitter },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
]

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => {
          const isExternal = link.href.startsWith('http') || link.href.startsWith('https')
          const isSoon = link.soon
          const content = (
            <span className={isSoon ? 'flex items-center gap-2' : ''}>
              {link.label}
              {isSoon && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-semibold">
                  Soon
                </span>
              )}
            </span>
          )

          if (isSoon) {
            return (
              <li key={link.label}>
                <span className="text-sm text-slate-600 cursor-default flex items-center gap-2">
                  {content}
                </span>
              </li>
            )
          }

          if (isExternal) {
            return (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              </li>
            )
          }

          const isHashSection = link.href.startsWith('/#')
          if (isHashSection) {
            return (
              <li key={link.label}>
                <button
                  type="button"
                  onClick={() => {
                    const hash = link.href.replace('/#', '#')
                    if (location.pathname === '/') {
                      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      navigate(`/${hash}`)
                    }
                  }}
                  className="text-sm text-slate-400 hover:text-white transition-colors duration-200 text-left"
                >
                  {link.label}
                </button>
              </li>
            )
          }

          return (
            <li key={link.label}>
              <Link
                to={link.href}
                className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="py-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Branding */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                HumaniseAI
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">
              Make AI text sound human. Built in South Africa 🇿🇦
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Support" links={SUPPORT_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {currentYear} HumaniseAI. Made in 🇿🇦 South Africa
          </p>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
