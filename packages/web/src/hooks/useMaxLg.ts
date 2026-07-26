import { useEffect, useState } from 'react'

/** True when viewport is below Tailwind `lg` (1024px) — mobile/tablet shell band. */
export function useMaxLg(): boolean {
  const [maxLg, setMaxLg] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setMaxLg(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return maxLg
}
