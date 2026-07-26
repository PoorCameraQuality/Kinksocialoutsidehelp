import { useCallback, useEffect, useState } from 'react'
import { Room } from 'livekit-client'

type Props = {
  orgKey: string
  channelId: string
  channelName: string
}

export default function OrgVoicePanel({ orgKey, channelId, channelName }: Props) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)

  const disconnect = useCallback(async () => {
    if (room) {
      await room.disconnect()
      setRoom(null)
    }
    setStatus('idle')
  }, [room])

  const connect = useCallback(async () => {
    setErr(null)
    setStatus('connecting')
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}/channels/${channelId}/voice/token`, {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        token?: string
        url?: string
        hint?: string
      }
      if (!r.ok) {
        setErr(j.error ?? j.hint ?? 'Could not get voice token')
        setStatus('error')
        return
      }
      if (!j.token || !j.url) {
        setErr('Invalid token response')
        setStatus('error')
        return
      }
      const rm = new Room()
      await rm.connect(j.url, j.token)
      await rm.localParticipant.setMicrophoneEnabled(true)
      setMicEnabled(rm.localParticipant.isMicrophoneEnabled)
      setRoom(rm)
      setStatus('connected')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connection failed')
      setStatus('error')
    }
  }, [orgKey, channelId])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  async function toggleMic() {
    if (!room) return
    const cur = room.localParticipant.isMicrophoneEnabled
    await room.localParticipant.setMicrophoneEnabled(!cur)
    setMicEnabled(room.localParticipant.isMicrophoneEnabled)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-6">
      <p className="text-sm text-dc-text-muted">#{channelName}</p>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {status === 'idle' || status === 'error' ? (
        <button
          type="button"
          onClick={() => void connect()}
          className="min-h-11 px-6 rounded-xl bg-dc-accent text-dc-text text-sm"
        >
          Join voice
        </button>
      ) : null}
      {status === 'connecting' && <p className="text-sm text-dc-muted">Connecting…</p>}
      {status === 'connected' && room && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => void toggleMic()}
            className="text-xs px-3 py-2 rounded-lg bg-dc-elevated-muted text-dc-text"
          >
            {micEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="text-xs px-3 py-2 rounded-lg bg-red-900/40 text-dc-text"
          >
            Leave
          </button>
        </div>
      )}
      <p className="text-[11px] text-dc-muted max-w-md text-center">
        Voice uses LiveKit when the server is configured. Others in this channel join the same room.
      </p>
    </div>
  )
}
