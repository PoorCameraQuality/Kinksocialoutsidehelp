import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useApiLegalAlpha } from '@/hooks/useApiLegalAlpha'

type Props = {
  disabled?: boolean
  className?: string
  onResult?: (message: string) => void
}

export default function AccountDeleteButton({ disabled, className, onResult }: Props) {
  const api = useApiLegalAlpha()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete your account? You will be signed out and your profile hidden. Private data is purged after the retention window.',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const result = await api.createPrivacyRequest('DELETE')
      if (result.blocked) {
        onResult?.(
          'Deletion request recorded but blocked by an active legal hold. We cannot delete data under preservation.',
        )
        return
      }
      await logout()
      navigate('/', { replace: true })
    } catch (e) {
      onResult?.(e instanceof Error ? e.message : 'Account deletion failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => void handleDelete()}
      className={
        className ??
        'rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-2 text-sm text-red-100 disabled:opacity-60'
      }
    >
      Delete account
    </button>
  )
}
