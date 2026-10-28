export function safeSourceUrl(url?: string | null, doi?: string | null): string | null {
  const normalizedDoi = doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  const candidates = [url, normalizedDoi && /^10\.\d{4,9}\/\S+$/i.test(normalizedDoi) ? `https://doi.org/${normalizedDoi}` : null]
  for (const candidate of candidates) {
    if (!candidate) continue
    try { const parsed = new URL(candidate); if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href } catch { /* No safe destination. */ }
  }
  return null
}

export function citationPopoverContentHeight(headerHeight: number, sourceListHeight: number, footerHeight: number): number {
  // Measure the unconstrained source list, not the flex panel after it has been capped.
  return headerHeight + sourceListHeight + footerHeight + 2
}

export function citationPopoverPosition(anchor: { left: number; top: number; bottom: number }, viewportWidth: number, viewportHeight: number, contentHeight: number, panelWidth = 520) {
  const margin = 8; const gap = 8
  const maxHeight = Math.max(80, viewportHeight - margin * 2)
  if (viewportWidth < 640) {
    const height = Math.min(contentHeight, viewportHeight * 0.78, maxHeight)
    return { left: margin, top: viewportHeight - margin - height, maxHeight: height }
  }
  const below = viewportHeight - anchor.bottom - gap - margin
  const above = anchor.top - gap - margin
  const useBelow = below >= Math.min(contentHeight, 360) || below >= above
  const height = Math.min(contentHeight, maxHeight, Math.max(120, useBelow ? below : above))
  return { left: Math.max(margin, Math.min(anchor.left, viewportWidth - panelWidth - margin)), top: Math.max(margin, Math.min(useBelow ? anchor.bottom + gap : anchor.top - gap - height, viewportHeight - height - margin)), maxHeight: height }
}
