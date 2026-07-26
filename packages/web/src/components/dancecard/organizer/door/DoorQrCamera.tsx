import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'

type Props = {
  active: boolean
  onDecode: (text: string) => void
  onError?: (message: string) => void
}

/** Camera QR scan for door kiosk - requires secure context (HTTPS or localhost). */
export default function DoorQrCamera({ active, onDecode, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const msg = 'Camera scanning needs HTTPS or localhost.'
      setStatus(msg)
      onError?.(msg)
      return
    }

    const reader = new BrowserQRCodeReader()
    let cancelled = false
    let stopScan: (() => void) | undefined

    void (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (cancelled) return
          if (result) {
            onDecode(result.getText())
          }
        })
        stopScan = () => controls.stop()
        setStatus(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not open camera'
        if (!cancelled) {
          setStatus(msg)
          onError?.(msg)
        }
      }
    })()

    return () => {
      cancelled = true
      stopScan?.()
    }
  }, [active, onDecode, onError])

  if (!active) return null

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-dc-border bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      {status ?
        <p className="bg-dc-elevated-solid px-3 py-2 text-xs text-amber-200">{status}</p>
      : <p className="bg-dc-elevated-solid px-3 py-2 text-xs text-dc-muted">Point camera at badge QR</p>}
    </div>
  )
}
