// Two-way linking between a citation in the document and its result card, done through the DOM rather than React state so that
// hovering a card or clicking a mark never re-renders a 100,000-word document.
//   mark  : <mark data-card-ids="id1 id2">   (one mark can stand for several cards)
//   card  : <div id="cc-card-{id}">

export const cardElementId = (cardId: string) => `cc-card-${cardId}`

export const findMark = (cardId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-card-ids~="${CSS.escape(cardId)}"]`)

export const findCard = (cardId: string): HTMLElement | null => document.getElementById(cardElementId(cardId))

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function flash(el: HTMLElement) {
  el.classList.remove('cc-flash')
  void el.offsetWidth   // restart the animation if it is already running
  el.classList.add('cc-flash')
  window.setTimeout(() => el.classList.remove('cc-flash'), 1500)
}

function reveal(el: HTMLElement) {
  // A paragraph far off screen is not laid out yet (content-visibility), so bring its paragraph in first, then the mark itself.
  const paragraph = el.closest<HTMLElement>('[data-para]')
  paragraph?.scrollIntoView({ block: 'center', behavior: 'auto' })
  el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
}

/** Result card for a clicked highlight: scroll to it, move keyboard focus onto it, flash it. Returns how long it took (ms), or null if absent. */
export function goToCard(cardId: string): number | null {
  const card = findCard(cardId)
  if (!card) return null
  const t0 = performance.now()
  reveal(card)
  card.focus({ preventScroll: true })
  flash(card)
  return performance.now() - t0
}

/** Passage for a clicked card: scroll to it and flash it. */
export function goToMark(cardId: string): number | null {
  const mark = findMark(cardId)
  if (!mark) return null
  const t0 = performance.now()
  reveal(mark)
  flash(mark)
  return performance.now() - t0
}

/** Subtle tint on a passage while its card is hovered or focused. */
export function tintMark(cardId: string, on: boolean) {
  findMark(cardId)?.classList.toggle('cc-mark--hover', on)
}
