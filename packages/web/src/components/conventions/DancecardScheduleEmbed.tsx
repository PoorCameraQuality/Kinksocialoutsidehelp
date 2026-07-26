'use client'

import { useEffect, useRef, useState } from 'react'

/** ECKE schedule embed with `dc-embed-ready` height hints (Phase 8). */
export default function DancecardScheduleEmbed({ src, title = 'Dancecard schedule' }: { src: string; title?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string; height?: number }
      if (data?.type !== 'dc-embed-ready' || typeof data.height !== 'number') return
      setHeight(Math.min(Math.max(data.height + 24, 320), 1200))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      ref={ref}
      title={title}
      src={src}
      style={{ height }}
      className="w-full rounded-xl border border-dc-border bg-black/20 transition-[height] duration-200"
    />
  )
}
