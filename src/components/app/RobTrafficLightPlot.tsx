import { useMemo, useRef } from 'react'
import {
  layoutLegend, levelsPresent, robSwatch,
  type RobColourScheme, type RobFigureData, type RobLevel,
} from '../../lib/robFigures'
import { SVG_FONT_FAMILY, truncateText, wrapText } from '../../lib/svgText'
import FigureDownloadButtons from './FigureDownloadButtons'

interface RobTrafficLightPlotProps {
  data:     RobFigureData
  scheme:   RobColourScheme
  filename?: string
}

const M = 14
const LABEL_W = 170
const COL_W = 42
const OVERALL_GAP = 12
const ROW_H = 34
const R = 13
const HEADER_H = 46
const INK = '#1f2937'
const GRID = '#d1d5db'

export function RobCircle({ cx, cy, r, level, scheme, label }: { cx: number; cy: number; r: number; level: RobLevel; scheme: RobColourScheme; label?: string }) {
  const s = robSwatch(level, scheme)
  return (
    <g>
      {label && <title>{label}</title>}
      <circle cx={cx} cy={cy} r={r} fill={s.fill} stroke={s.stroke ?? 'none'} strokeWidth={s.stroke ? 1.2 : 0} />
      {s.symbol && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, r * 1.15)} fontWeight={700} fill={s.symbolFill}>
          {s.symbol}
        </text>
      )}
    </g>
  )
}

export default function RobTrafficLightPlot({ data, scheme, filename = 'risk-of-bias-traffic-light' }: RobTrafficLightPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const geo = useMemo(() => {
    const nd = data.domains.length
    const gridX = M + LABEL_W
    const overallX = gridX + nd * COL_W + OVERALL_GAP
    const width = Math.max(overallX + COL_W + M, 460)
    const gridTop = M + HEADER_H
    const gridBottom = gridTop + data.studies.length * ROW_H

    // Legend: domain key lines, then judgement swatches.
    const legendW = width - M * 2
    let y = gridBottom + 18
    const domainLines: { text: string; y: number; bold: boolean }[] = []
    domainLines.push({ text: 'Domains:', y, bold: true })
    y += 15
    for (const d of data.domains) {
      for (const line of wrapText(`${d.code}: ${d.label}`, legendW, 11)) {
        domainLines.push({ text: line, y, bold: false })
        y += 15
      }
    }
    y += 6
    const judgementTitleY = y
    const legend = layoutLegend(levelsPresent(data), data.levelLabels, M, y + 4, legendW)
    const height = y + 4 + legend.height + M
    return { nd, gridX, overallX, width, gridTop, gridBottom, domainLines, judgementTitleY, legend, height }
  }, [data])

  const colCx = (i: number) => geo.gridX + i * COL_W + COL_W / 2
  const overallCx = geo.overallX + COL_W / 2

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          width="100%"
          role="img"
          aria-label={`${data.toolName} traffic-light plot`}
          fontFamily={SVG_FONT_FAMILY}
          style={{ maxWidth: geo.width, height: 'auto', display: 'block' }}
        >
          <title>{`${data.toolName} risk of bias: traffic-light plot`}</title>
          <rect x={0} y={0} width={geo.width} height={geo.height} fill="#ffffff" />

          <text x={(geo.gridX + geo.overallX + COL_W) / 2} y={M + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
            Risk of bias domains
          </text>
          <text x={M + LABEL_W - 10} y={M + HEADER_H - 12} textAnchor="end" fontSize={12} fontWeight={700} fill={INK}>Study</text>
          {data.domains.map((d, i) => (
            <text key={d.code} x={colCx(i)} y={M + HEADER_H - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
              <title>{d.label}</title>
              {d.code}
            </text>
          ))}
          <text x={overallCx} y={M + HEADER_H - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>Overall</text>

          {/* Grid */}
          <rect x={geo.gridX} y={geo.gridTop} width={geo.nd * COL_W} height={geo.gridBottom - geo.gridTop} fill="#f3f4f6" stroke={GRID} />
          <rect x={geo.overallX} y={geo.gridTop} width={COL_W} height={geo.gridBottom - geo.gridTop} fill="#f3f4f6" stroke={GRID} />
          {data.studies.map((_, r) => r > 0 && (
            <g key={`h${r}`}>
              <line x1={geo.gridX} x2={geo.gridX + geo.nd * COL_W} y1={geo.gridTop + r * ROW_H} y2={geo.gridTop + r * ROW_H} stroke={GRID} />
              <line x1={geo.overallX} x2={geo.overallX + COL_W} y1={geo.gridTop + r * ROW_H} y2={geo.gridTop + r * ROW_H} stroke={GRID} />
            </g>
          ))}
          {data.domains.map((_, i) => i > 0 && (
            <line key={`v${i}`} x1={geo.gridX + i * COL_W} x2={geo.gridX + i * COL_W} y1={geo.gridTop} y2={geo.gridBottom} stroke={GRID} />
          ))}

          {data.studies.map((s, r) => {
            const cy = geo.gridTop + r * ROW_H + ROW_H / 2
            return (
              <g key={s.id}>
                <text x={M + LABEL_W - 10} y={cy} textAnchor="end" dominantBaseline="central" fontSize={11} fill={INK}>
                  <title>{s.fullTitle}</title>
                  {truncateText(s.label, LABEL_W - 14, 11)}
                </text>
                {s.judgements.map((j, i) => (
                  <RobCircle key={i} cx={colCx(i)} cy={cy} r={R} level={j} scheme={scheme}
                    label={`${s.label}, ${data.domains[i].code}: ${data.levelLabels[j] ?? j}`} />
                ))}
                <RobCircle cx={overallCx} cy={cy} r={R} level={s.overall} scheme={scheme}
                  label={`${s.label}, overall: ${data.levelLabels[s.overall] ?? s.overall}`} />
              </g>
            )
          })}

          {geo.domainLines.map((l, i) => (
            <text key={i} x={M} y={l.y} fontSize={11} fontWeight={l.bold ? 700 : 400} fill={INK}>{l.text}</text>
          ))}
          <text x={M} y={geo.judgementTitleY} fontSize={11} fontWeight={700} fill={INK}>Judgement:</text>
          {geo.legend.items.map(item => (
            <g key={item.level}>
              <RobCircle cx={item.x} cy={item.y + 6} r={8} level={item.level} scheme={scheme} />
              <text x={item.x + 14} y={item.y + 6} dominantBaseline="central" fontSize={11} fill={INK}>{item.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap justify-end gap-2 mt-3">
        <FigureDownloadButtons svgRef={svgRef} filename={filename} />
      </div>
    </div>
  )
}
