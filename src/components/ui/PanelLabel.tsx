interface PanelLabelProps {
  label: string
  count?: number
  countLabel?: string
  colorOverride?: string
}

/**
 * Input/output panel header label — sentence-case style, matching the
 * dominant pattern across tool pages (Detector, Paraphraser, Grammar,
 * Source Check) rather than Rewrite's small-caps "ORIGINAL" treatment.
 */
export function PanelLabel({ label, count, countLabel = 'words', colorOverride }: PanelLabelProps) {
  return (
    <span className="text-[18px] font-semibold text-gray-700" style={colorOverride ? { color: colorOverride } : undefined}>
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-2 text-xs font-normal text-gray-400">
          {count.toLocaleString()} {countLabel}
        </span>
      )}
    </span>
  )
}
