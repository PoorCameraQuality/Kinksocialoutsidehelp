import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ageFromBirthDate, profileBirthDateInputBounds } from '@c2k/shared'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import Card from '@/components/ui/Card'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

export default function ProfileAgeConfirmationCard() {
  const ctx = useProfileEdit()
  const birthDateBounds = useMemo(() => profileBirthDateInputBounds(), [])
  const age = ctx.birthDate.trim() ? ageFromBirthDate(ctx.birthDate) : null

  return (
    <Card padding="md" className="border-dc-border/80 bg-dc-elevated-muted/30">
      <h3 className="text-sm font-semibold text-dc-text">Age confirmation</h3>
      <p className="mt-2 text-xs leading-relaxed text-dc-muted">
        Kink Social requires members to be 18+. Your birth date is stored privately and never shown on your public profile.
      </p>
      <label htmlFor="profile-age-dob" className="mt-3 block text-xs font-medium text-dc-text">
        Date of birth
      </label>
      <ProfileBirthDateField
        id="profile-age-dob"
        value={ctx.birthDate}
        bounds={birthDateBounds}
        onChange={ctx.setBirthDate}
        className="mt-1"
      />
      {age != null ?
        <p className="mt-2 text-xs text-dc-muted">
          Age used for eligibility checks only. Not displayed publicly.{' '}
          <Link to="/settings/privacy" className="text-dc-accent hover:underline">
            Privacy settings
          </Link>
        </p>
      : null}
    </Card>
  )
}
