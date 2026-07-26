import { useState } from 'react'

import type { TrustRingScores } from '@/data/types'

export type { TrustRingScores } from '@/data/types'

export const SEGMENT_LABELS = [
  { key: 'eventReliability' as const, label: 'Event Reliability' },
  { key: 'consentSafety' as const, label: 'Consent & Safety' },
  { key: 'skill' as const, label: 'Skill Endorsements' },
  { key: 'contribution' as const, label: 'Community Contribution' },
  { key: 'vendorHost' as const, label: 'Vendor / Host' },
]

type TrustRingProps = {
  score: number
  segments?: TrustRingScores
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
  showBreakdown?: boolean
}

export function getSegmentValues(score: number, segments?: TrustRingScores): number[] {
  if (segments) {
    return [
      segments.eventReliability ?? 0,
      segments.consentSafety ?? 0,
      segments.skill ?? 0,
      segments.contribution ?? 0,
      segments.vendorHost ?? 0,
    ]
  }
  const v = Math.round(score / 5)
  return [v, v, v, v, v]
}

const SIZE_MAP = {
  sm: { outer: 40, stroke: 3 },
  md: { outer: 56, stroke: 4 },
  lg: { outer: 80, stroke: 5 },
}

export default function TrustRing({
  score,
  segments,
  size = 'md',
  className = '',
  children,
  showBreakdown = true,
}: TrustRingProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const values = getSegmentValues(score, segments)
  const { outer, stroke } = SIZE_MAP[size]
  const r = (outer - stroke) / 2
  const cx = outer / 2
  const cy = outer / 2

  const segmentPaths = values.map((value, i) => {
    const baseAngle = ((i * 72 - 90) * Math.PI) / 180
    const sweepAngle = (72 * (value / 100) * Math.PI) / 180
    const endAngle = baseAngle + sweepAngle
    const x1 = cx + r * Math.cos(baseAngle)
    const y1 = cy + r * Math.sin(baseAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = sweepAngle > Math.PI ? 1 : 0
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
    return { path, value }
  })

  return (
    <div className={`relative inline-flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => showBreakdown && setIsExpanded(!isExpanded)}
        className={`relative rounded-full ${!showBreakdown ? 'cursor-default' : 'cursor-pointer'}`}
        aria-label={`Trust score: ${score}. Click for breakdown.`}
      >
        <svg width={outer} height={outer} className="transform -rotate-90">
          <defs>
            <linearGradient id="trust-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--dc-accent)" />
              <stop offset="100%" stopColor="var(--dc-accent-hover)" />
            </linearGradient>
          </defs>
          {segmentPaths.map(({ path, value }, i) => (
            <path
              key={i}
              d={path}
              fill="none"
              stroke="url(#trust-ring-gradient)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={value > 0 ? Math.max(0.4, value / 100) : 0.15}
            />
          ))}
          <circle
            cx={cx}
            cy={cy}
            r={r - stroke}
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {children ?? (
            <div className="w-1/2 h-1/2 rounded-full bg-dc-elevated-solid flex items-center justify-center">
              <span className="text-[10px] font-medium text-dc-muted">{score}</span>
            </div>
          )}
        </div>
      </button>
      {/* Trust bar – thin frame under avatar, fill = score */}
      <div className="h-1 rounded-full bg-dc-elevated-solid overflow-hidden" style={{ width: outer }}>
        <div
          className="h-full rounded-full bg-dc-accent transition-all"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>

      {showBreakdown && isExpanded && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setIsExpanded(false)} />
          <div className="absolute left-full ml-2 top-0 z-50 min-w-[200px] py-2 px-3 bg-dc-elevated/95 border border-dc-border rounded-xl shadow-[var(--dc-shadow-soft)]">
            <p className="text-xs font-semibold text-dc-muted uppercase mb-2">Trust Score: {score}</p>
            <ul className="space-y-1">
              {SEGMENT_LABELS.map(({ key, label }, i) => (
                <li key={key} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-dc-text-muted">{label}</span>
                  <span className="font-medium text-dc-text">{values[i]}%</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
