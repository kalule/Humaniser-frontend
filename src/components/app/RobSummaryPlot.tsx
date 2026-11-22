import { useMemo, useRef } from 'react'
import {
  layoutLegend, levelsPresent, robSwatch, roundedPercents, summariseRob,
  type RobColourScheme, type RobFigureData,
} from '../../lib/robFigures'
import { SVG_FONT_FAMILY, estimateTextWidth, wrapText } from '../../lib/svgText'
import FigureDownloadButtons from './FigureDownloadButtons'

interface RobSummaryPlotProps {
  data:      RobFigureData
  scheme:    RobColourScheme
  filename?: string
}

const M = 14
const LABEL_W = 230
const BAR_W = 380
const BAR_H = 22
const LINE_H = 14
const ROW_PAD = 10
const INK = '#1f2937'
const AXIS = '#9ca3af'

export default function RobSummaryPlot({ data, scheme, filename = 'risk-of-bias-summary' }: RobSummaryPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const geo = useMemo(() => {
    const rows = summariseRob(data)
    const barX = M + LABEL_W + 12
    const width = barX + BAR_W + M + 8
    let y = M + 24
    const laid = rows.map(row => {
      const lines = wrapText(row.code === 'Overall' ? row.label : `${row.code}: ${row.label}`, LABEL_W - 4, 11, row.code === 'Overall')
      const h = Math.max(BAR_H + ROW_PAD, lines.length * LINE_H + ROW_PAD)
      const top = y
      y += h
      const percents = roundedPercents(row.segments.map(s => s.proportion))
      let x = barX
      const segments = row.segments.map((s, i) => {
        const w = s.proportion * BAR_W
        const seg = { ...s, x, w, percent: percents[i] }
        x += w
        return seg
      })
      return { row, lines, top, h, cy: top + h / 2, segments }
    })
    const axisY = y + 4
    const legendTop = axisY + 34
    const legend = layoutLegend(levelsPresent(data), data.levelLabels, M, legendTop, width - M * 2)
    const height = legendTop + legend.height + M
    return { laid, barX, width, axisY, legend, height }
  }, [data])

  const studies = data.studies.length

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          width="100%"
          role="img"
          aria-label={`${data.toolName} risk of bias summary plot`}
          fontFamily={SVG_FONT_FAMILY}
          style={{ maxWidth: geo.width, height: 'auto', display: 'block' }}
        >
          <title>{`${data.toolName} risk of bias: summary plot`}</title>
          <rect x={0} y={0} width={geo.width} height={geo.height} fill="#ffffff" />
          <text x={M} y={M + 8} fontSize={12} fontWeight={700} fill={INK}>
            {`Proportion of studies at each judgement (n = ${studies} ${studies === 1 ? 'study' : 'studies'}, unweighted)`}
          </text>

          {geo.laid.map(({ row, lines, cy, segments }) => (
            <g key={row.code}>
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={M + LABEL_W}
                  y={cy - ((lines.length - 1) * LINE_H) / 2 + i * LINE_H}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={row.code === 'Overall' ? 700 : 400}
                  fill={INK}
                >
                  {line}
                </text>
              ))}
              <rect x={geo.barX} y={cy - BAR_H / 2} width={BAR_W} height={BAR_H} fill="#f3f4f6" />
              {segments.map(seg => {
                const sw = robSwatch(seg.level, scheme)
                const label = `${seg.percent}%`
                const fits = estimateTextWidth(label, 10, true) + 6 <= seg.w
                return (
                  <g key={seg.level}>
                    <title>{`${row.code === 'Overall' ? 'Overall' : row.code}: ${data.levelLabels[seg.level] ?? seg.level}, ${seg.count} of ${row.total} (${seg.percent}%)`}</title>
                    <rect x={seg.x} y={cy - BAR_H / 2} width={seg.w} height={BAR_H} fill={sw.fill}
                      stroke={sw.stroke ?? '#ffffff'} strokeWidth={sw.stroke ? 1 : 0.6} />
                    {fits && (
                      <text x={seg.x + seg.w / 2} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={sw.symbolFill}>
                        {label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          ))}

          {/* X axis */}
          <line x1={geo.barX} x2={geo.barX + BAR_W} y1={geo.axisY} y2={geo.axisY} stroke={AXIS} />
          {[0, 25, 50, 75, 100].map(t => (
            <g key={t}>
              <line x1={geo.barX + (t / 100) * BAR_W} x2={geo.barX + (t / 100) * BAR_W} y1={geo.axisY} y2={geo.axisY + 4} stroke={AXIS} />
              <text x={geo.barX + (t / 100) * BAR_W} y={geo.axisY + 16} textAnchor="middle" fontSize={10} fill="#4b5563">{`${t}%`}</text>
            </g>
          ))}

          {geo.legend.items.map(item => {
            const sw = robSwatch(item.level, scheme)
            return (
              <g key={item.level}>
                <rect x={item.x - 7} y={item.y - 7} width={14} height={14} fill={sw.fill} stroke={sw.stroke ?? 'none'} />
                <text x={item.x + 13} y={item.y} dominantBaseline="central" fontSize={11} fill={INK}>{item.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap justify-end gap-2 mt-3">
        <FigureDownloadButtons svgRef={svgRef} filename={filename} />
      </div>
    </div>
  )
}
