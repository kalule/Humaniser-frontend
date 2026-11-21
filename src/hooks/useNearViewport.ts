import { useEffect, useState, type RefObject } from 'react'

/**
 * True while `target` is inside, or within `margin` of, the scroll container `root`. Used to mount
 * heavy section bodies only near the viewport, so a long thesis keeps a small DOM. Without
 * IntersectionObserver (tests, very old browsers) everything counts as near.
 */
export function useNearViewport(
  target: RefObject<Element | null>,
  root: RefObject<Element | null>,
  margin = '1200px 0px',
): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !target.current) return
    const observer = new IntersectionObserver(
      entries => { for (const entry of entries) setNear(entry.isIntersecting) },
      { root: root.current, rootMargin: margin },
    )
    observer.observe(target.current)
    return () => observer.disconnect()
  }, [target, root, margin])

  return near
}
