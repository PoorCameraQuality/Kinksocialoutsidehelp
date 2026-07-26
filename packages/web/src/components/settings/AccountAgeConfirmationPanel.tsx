import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ageFromBirthDate, formatProfileBirthDateForInput, profileBirthDateInputBounds } from '@c2k/shared'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import { Panel } from '@/components/dancecard/ui/Panel'
import SectionHeader from '@/components/ui/SectionHeader'
import StatusBanner from '@/components/ui/StatusBanner'

export default function AccountAgeConfirmationPanel() {
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const birthDateBounds = useMemo(() => profileBirthDateInputBounds(), [])
  const age = birthDate.trim() ? ageFromBirthDate(birthDate) : null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/profile/me', { credentials: 'include' })
      if (!r.ok) return
      const data = (await r.json()) as { profile?: { birthDate?: string | null } }
      setBirthDate(formatProfileBirthDateForInput(data.profile?.birthDate))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!birthDate.trim()) return
    const computed = ageFromBirthDate(birthDate)
    if (computed != null && computed < 18) {
      setNotice('You must be 18 or older to use Kink Social.')
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const r = await fetch('/api/profile/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate: birthDate || null }),
      })
      if (r.ok) {
        setNotice('Birth date saved. It is never shown on your public profile.')
        await load()
      } else {
        setNotice('Could not save birth date. Try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel id="age" className="scroll-mt-24">
      <SectionHeader
        eyebrow="Account & safety"
        title="Age confirmation"
        description="Kink Social requires members to be 18+. Your birth date is stored privately and used only for eligibility checks."
      />
      {notice ?
        <StatusBanner className="mt-4" tone={notice.includes('Could not') ? 'warning' : 'success'}>
          {notice}
        </StatusBanner>
      : null}
      <div className="mt-4 max-w-xs">
        <label htmlFor="account-age-dob" className="block text-sm font-medium text-dc-text">
          Date of birth
        </label>
        <ProfileBirthDateField
          id="account-age-dob"
          value={birthDate}
          bounds={birthDateBounds}
          disabled={loading || saving}
          onChange={setBirthDate}
          className="mt-2 max-w-md"
        />
        {age != null ?
          <p className="mt-2 text-xs text-dc-muted">
            Not displayed publicly.{' '}
            <Link to="/settings/privacy" className="text-dc-accent hover:underline">
              Privacy settings
            </Link>
          </p>
        : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving || !birthDate.trim()}
          className="mt-3 min-h-10 px-4 rounded-lg text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save birth date'}
        </button>
      </div>
    </Panel>
  )
}
