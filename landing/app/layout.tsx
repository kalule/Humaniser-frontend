import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://humaniseai.co.za'),
  title: {
    default: 'HumaniseAI — Make AI Text Sound Human | South Africa',
    template: '%s | HumaniseAI',
  },
  description:
    "South Africa's #1 AI text toolkit. Humanise AI writing, detect AI content, paraphrase, grammar-check, plagiarism-scan, and summarise — free tier, unlimited words on Pro.",
  keywords: [
    'AI humaniser South Africa',
    'AI detector',
    'paraphraser',
    'grammar checker',
    'plagiarism checker',
    'AI writing tool',
    'humanise AI text',
    'academic writing tool South Africa',
    'bypass AI detection',
  ],
  authors: [{ name: 'HumaniseAI', url: 'https://humaniseai.co.za' }],
  creator: 'HumaniseAI',
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: 'https://humaniseai.co.za',
    siteName: 'HumaniseAI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'HumaniseAI' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={spaceGrotesk.variable}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
