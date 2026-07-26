'use client'

import { formatCategoryOptionLabel } from '@/lib/dancecard/registrationCategoryRoleKinds'

type Question = {
  type: string
  label: string
  required: boolean
  sortOrder: number
}

type PreviewCategory = {
  id?: string
  name: string
  accessCode: string | null
  expectedHours: number | null
}

export function RegistrationAttendeePreview({
  introText,
  confirmationText,
  questions,
  categories = [],
}: {
  introText: string
  confirmationText: string
  questions: Question[]
  categories?: PreviewCategory[]
}) {
  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
  const codedCategories = categories.filter((c) => c.accessCode)
  const showCategoryPicker = categories.length > 0

  return (
    <div className="rounded-xl border border-dc-border bg-dc-surface-muted p-4 xl:sticky xl:top-4">
      <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Attendee preview</p>
      <p className="mt-1 text-[10px] text-dc-muted">
        Registration type lists your categories below. Publish the form to enable the public register page.
      </p>
      <div className="mt-3 space-y-4 text-sm">
        {introText ? (
          <p className="whitespace-pre-wrap text-dc-text">{introText}</p>
        ) : (
          <p className="italic text-dc-muted">No intro text yet.</p>
        )}
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {showCategoryPicker ? (
            <label className="block">
              <span className="text-dc-text">Registration type</span>
              <select disabled className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-muted">
                <option>, choose -</option>
                {categories.map((c) => (
                  <option key={c.id ?? c.name}>
                    {formatCategoryOptionLabel(c.name, c.expectedHours)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {codedCategories.length > 0 ? (
            <label className="block">
              <span className="text-dc-text">Access / comp code</span>
              <input
                readOnly
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 font-mono text-xs text-dc-muted"
                placeholder="Enter code from organizer"
              />
            </label>
          ) : null}
          {sorted.map((q, i) => (
            <label key={`${q.label}-${i}`} className="block">
              <span className="text-dc-text">
                {q.label}
                {q.required ? <span className="text-dc-warning"> *</span> : null}
              </span>
              {q.type === 'long_text' || q.type === 'consent_matrix' ? (
                <textarea
                  readOnly
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-muted"
                  rows={3}
                  placeholder={q.type}
                />
              ) : q.type === 'single_choice' || q.type === 'dropdown' ? (
                <select disabled className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-muted">
                  <option>, choose -</option>
                </select>
              ) : (
                <input
                  readOnly
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface px-3 py-2 text-dc-muted"
                  placeholder={q.type}
                />
              )}
            </label>
          ))}
          <button type="button" disabled className="w-full rounded-full bg-dc-accent/40 py-2 font-semibold text-dc-accent-foreground">
            Submit registration
          </button>
        </form>
        {confirmationText ? (
          <p className="border-t border-dc-border pt-3 text-dc-micro text-dc-muted">
            After submit: {confirmationText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
