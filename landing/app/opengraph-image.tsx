import { ImageResponse } from 'next/og'

export const alt = 'HumaniseAI — Make AI Text Sound Human'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f19',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(109,40,217,0.25) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
              color: 'white',
            }}
          >
            H
          </div>
          <span style={{ fontSize: 40, fontWeight: 700, color: 'white', letterSpacing: '-1px' }}>
            HumaniseAI
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            letterSpacing: '-2px',
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          Make AI Text Sound
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: '-2px',
            lineHeight: 1.1,
            marginBottom: 36,
            background: 'linear-gradient(90deg, #a78bfa, #818cf8)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Genuinely Human
        </div>

        {/* Tool pills */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
          {[
            { label: 'Humaniser',    bg: 'rgba(124,58,237,0.25)', border: 'rgba(124,58,237,0.5)', text: '#c4b5fd' },
            { label: 'AI Detector', bg: 'rgba(59,130,246,0.2)',  border: 'rgba(59,130,246,0.5)',  text: '#93c5fd' },
            { label: 'Paraphraser', bg: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.5)',  text: '#6ee7b7' },
            { label: 'Grammar',     bg: 'rgba(245,158,11,0.2)',  border: 'rgba(245,158,11,0.5)',  text: '#fcd34d' },
            { label: 'Plagiarism',  bg: 'rgba(244,63,94,0.2)',   border: 'rgba(244,63,94,0.5)',   text: '#fda4af' },
            { label: 'Summariser',  bg: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.5)',  text: '#a5b4fc' },
          ].map(({ label, bg, border, text }) => (
            <div
              key={label}
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                background: bg,
                border: `1px solid ${border}`,
                fontSize: 18,
                fontWeight: 600,
                color: text,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Footer tag */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            fontSize: 18,
            color: '#475569',
            letterSpacing: '0.5px',
          }}
        >
          humaniseai.co.za · South Africa&apos;s #1 AI Text Toolkit
        </div>
      </div>
    ),
    { ...size },
  )
}
