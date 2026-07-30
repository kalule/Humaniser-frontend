import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router's client-side navigation doesn't reset scroll position the way
// a full page load does. Without this, navigating to a shorter page while
// scrolled down on a taller one lands you mid-page (or at the footer) instead
// of the top. Hash links (e.g. "/#how-it-works") are left alone so the
// target page's own hash-scroll effect can bring that section into view.
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    // `scroll-behavior: smooth` on <html> applies to scrollTo() *and* direct
    // scrollTop assignment in Chrome, so both would otherwise animate the
    // reset across the newly-loaded page's content. Toggle it off for this
    // one synchronous jump, then restore it for normal in-page smooth scrolling.
    const html = document.documentElement
    const previous = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    html.style.scrollBehavior = previous
  }, [pathname, hash])

  return null
}
