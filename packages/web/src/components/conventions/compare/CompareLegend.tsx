import {
  compareLegendBusyHatchStyle,
  compareLegendSwatch,
} from '@/components/conventions/compare/compareColors'

export default function CompareLegend({ mode }: { mode: 'mutual' | 'host' }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-dc-muted">
      <li className="inline-flex items-center gap-1.5">
        <span className={`h-3 w-3 rounded-sm ${compareLegendSwatch.mutualFree}`} aria-hidden />
        {mode === 'mutual' ? 'Both free' : 'Host free'}
      </li>
      {mode === 'mutual' ?
        <li className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${compareLegendSwatch.hostFreeOnly}`} aria-hidden />
          Host free only
        </li>
      : null}
      <li className="inline-flex items-center gap-1.5">
        <span
          className={`h-3 w-3 rounded-sm ${compareLegendSwatch.busy}`}
          style={compareLegendBusyHatchStyle}
          aria-hidden
        />
        Busy
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className={`h-3 w-3 rounded-sm ${compareLegendSwatch.outsideWindow}`} aria-hidden />
        Outside window
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className={`h-3 w-3 rounded-sm ${compareLegendSwatch.selectedGap}`} aria-hidden />
        Selected gap
      </li>
    </ul>
  )
}
