export const PROFILE_EDIT_SECTIONS = [
  { id: 'story', label: 'Story', hint: 'Public · About' },
  { id: 'identity', label: 'Identity', hint: 'Public · About' },
  { id: 'interests', label: 'Interests', hint: 'Public · About' },
  { id: 'photo', label: 'Photo', hint: 'Public · Header' },
  { id: 'more', label: 'More on Kink Social', hint: 'Tabs & links' },
] as const

export type ProfileEditSectionId = (typeof PROFILE_EDIT_SECTIONS)[number]['id']

export default function ProfileEditSectionNav({ active }: { active: ProfileEditSectionId }) {
  return (
    <nav
      className="sticky top-[var(--header-offset,0)] z-10 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 mb-4 bg-dc-surface/95 backdrop-blur border-b border-dc-border"
      aria-label="Profile edit sections"
    >
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {PROFILE_EDIT_SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className={`inline-flex flex-col min-h-10 justify-center rounded-xl px-3 py-1.5 transition-colors ${
                active === s.id ?
                  'bg-dc-accent text-dc-accent-foreground'
                : 'bg-dc-elevated-solid text-dc-text-muted border border-dc-border hover:text-dc-text'
              }`}
            >
              <span className="text-sm font-medium leading-tight">{s.label}</span>
              <span
                className={`text-[10px] leading-tight mt-0.5 ${
                  active === s.id ? 'text-dc-accent-foreground/80' : 'text-dc-muted'
                }`}
              >
                {s.hint}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
