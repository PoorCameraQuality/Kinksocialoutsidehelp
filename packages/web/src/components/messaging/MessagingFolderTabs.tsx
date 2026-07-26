const FOLDER_HINTS = {
  main: 'Accepted conversations you can read and reply to',
  requests: 'New conversations from people you are not connected with yet. Accept to reply.',
  iso: 'Replies from personal or convention ISO boards',
} as const

type Folder = keyof typeof FOLDER_HINTS

type Props = {
  active: Folder
  onChange: (folder: Folder) => void
  counts?: { requests?: number; iso?: number }
  /** Hide folder hint line when inbox is empty (mobile density) */
  showHint?: boolean
}

export default function MessagingFolderTabs({ active, onChange, counts, showHint = true }: Props) {
  const tabs: { id: Folder; label: string; count?: number }[] = [
    { id: 'main', label: 'Main' },
    { id: 'requests', label: 'Requests', count: counts?.requests },
    { id: 'iso', label: 'ISO', count: counts?.iso },
  ]

  return (
    <div>
      <div className="flex gap-1.5 sm:gap-2" role="tablist" aria-label="Inbox folder">
        {tabs.map((tab) => {
          const selected = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={FOLDER_HINTS[tab.id]}
              onClick={() => onChange(tab.id)}
              className={`relative min-h-9 flex-1 min-w-[4rem] rounded-lg text-xs font-medium transition-colors sm:min-h-10 sm:min-w-[4.5rem] sm:rounded-xl sm:text-sm ${
                selected ? 'bg-dc-accent text-dc-accent-foreground' : 'bg-dc-surface-muted text-dc-text-muted hover:text-dc-text'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 ?
                <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-dc-accent px-1.5 py-0.5 text-[10px] font-bold text-dc-accent-foreground">
                  {tab.count > 9 ? '9+' : tab.count}
                </span>
              : null}
            </button>
          )
        })}
      </div>
      {showHint ?
        <p className="mt-1.5 text-xs text-dc-muted">{FOLDER_HINTS[active]}</p>
      : null}
    </div>
  )
}
