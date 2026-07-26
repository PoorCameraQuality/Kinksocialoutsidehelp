import { useCreateSheet } from '@/contexts/CreateSheetContext'

type Props = {
  show: boolean
}

/** Mobile floating create action — opens CreateSheet. Hidden on lg+. */
export default function CreateFab({ show }: Props) {
  const { openCreateSheet } = useCreateSheet()
  if (!show) return null

  return (
    <button
      type="button"
      onClick={openCreateSheet}
      className="lg:hidden fixed right-4 z-[35] flex h-[var(--c2k-fab-size)] w-[var(--c2k-fab-size)] items-center justify-center rounded-full bg-dc-accent text-dc-accent-foreground shadow-[var(--dc-shadow-panel)] transition-colors hover:bg-dc-accent-hover c2k-fab-position"
      aria-label="Create"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )
}
