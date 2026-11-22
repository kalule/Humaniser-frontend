import { useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Download, Loader2 } from 'lucide-react'
import { downloadSvg, downloadSvgAsPng } from '../../lib/svgDownload'

interface FigureDownloadButtonsProps {
  svgRef:   RefObject<SVGSVGElement | null>
  filename: string   // without extension
}

const BTN = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors disabled:opacity-60'

export default function FigureDownloadButtons({ svgRef, filename }: FigureDownloadButtonsProps) {
  const [busy, setBusy] = useState(false)

  const handleSvg = () => {
    if (svgRef.current) downloadSvg(svgRef.current, `${filename}.svg`)
  }

  const handlePng = async () => {
    if (!svgRef.current) return
    setBusy(true)
    try {
      await downloadSvgAsPng(svgRef.current, `${filename}.png`)
    } catch (err) {
      console.error('Failed to export PNG', err)
      toast.error("Couldn't create the PNG. Try the SVG download instead.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={handleSvg} className={BTN}>
        <Download size={13} />
        Download SVG
      </button>
      <button type="button" onClick={handlePng} disabled={busy} className={BTN}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Download PNG
      </button>
    </>
  )
}
