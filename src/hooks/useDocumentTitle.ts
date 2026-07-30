import { useEffect } from 'react'

const SITE_URL = 'https://humaniseai.co.za'

export function useDocumentTitle(title: string, description?: string, path?: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    let descTag: HTMLMetaElement | null = null
    let previousDescription: string | null = null
    if (description) {
      descTag = document.querySelector('meta[name="description"]')
      if (descTag) {
        previousDescription = descTag.getAttribute('content')
        descTag.setAttribute('content', description)
      }
    }

    const canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const previousCanonical = canonicalTag?.getAttribute('href') ?? null
    if (canonicalTag) {
      canonicalTag.setAttribute('href', `${SITE_URL}${path ?? '/'}`)
    }

    return () => {
      document.title = previousTitle
      if (descTag && previousDescription !== null) {
        descTag.setAttribute('content', previousDescription)
      }
      if (canonicalTag && previousCanonical !== null) {
        canonicalTag.setAttribute('href', previousCanonical)
      }
    }
  }, [title, description, path])
}
