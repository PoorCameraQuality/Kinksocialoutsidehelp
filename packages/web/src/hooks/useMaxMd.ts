import { useEffect, useState } from 'react'

/** True when viewport is below Tailwind `md` (768px). */
export function useMaxMd(): boolean {
  const [maxMd, setMaxMd] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMaxMd(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return maxMd
}
