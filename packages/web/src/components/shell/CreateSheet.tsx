import CreateMenuDropdown from '@/components/CreateMenuDropdown'
import { useCreateSheet } from '@/contexts/CreateSheetContext'

export default function CreateSheet() {
  const { open, closeCreateSheet } = useCreateSheet()
  if (!open) return null

  return (
    <div
      className="dc-premium-backdrop fixed inset-0 z-dc-modal flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Create"
    >
      <button type="button" className="min-h-0 flex-1" aria-label="Close" onClick={closeCreateSheet} />
      <div
        className="dc-premium-sheet dc-sheet-enter max-h-[var(--c2k-mobile-sheet-max-height)] overflow-y-auto rounded-t-2xl border p-4 pb-[calc(var(--c2k-bottom-nav-total-h)+0.75rem)] safe-area-pb"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-dc-text">Create</h2>
          <button
            type="button"
            onClick={closeCreateSheet}
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg text-dc-muted hover:bg-dc-elevated-muted hover:text-dc-text"
            aria-label="Close create menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <CreateMenuDropdown onNavigate={closeCreateSheet} variant="sheet" />
      </div>
    </div>
  )
}
