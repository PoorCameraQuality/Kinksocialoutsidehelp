import type { GroupRule } from '@c2k/shared'
import Dialog from '@/components/ui/Dialog'

export interface GroupJoinRulesModalProps {
  groupName: string
  rules: GroupRule[]
  onClose: () => void
  onConfirm: () => void
  joining?: boolean
}

export default function GroupJoinRulesModal({
  groupName,
  rules,
  onClose,
  onConfirm,
  joining = false,
}: GroupJoinRulesModalProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Group rules"
      description={`Read and accept the rules for ${groupName} before joining.`}
      variant="sheet"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={joining}
            className="min-h-11 px-4 py-2 rounded-xl text-sm border border-dc-border-strong text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={joining}
            className="min-h-11 px-4 py-2 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join group'}
          </button>
        </>
      }
    >
      <div className="max-h-[min(60vh,28rem)] overflow-y-auto -mx-1 px-1 space-y-2">
        {rules.map((rule, index) => (
          <details
            key={`${rule.title}-${index}`}
            className="rounded-xl border border-dc-border bg-dc-elevated/80 group"
            open={index === 0}
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-dc-text marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {rule.title}
                <span className="text-dc-muted text-xs group-open:rotate-180 transition-transform" aria-hidden>
                  ▾
                </span>
              </span>
            </summary>
            <div className="border-t border-dc-border px-4 py-3 text-sm text-dc-text-muted whitespace-pre-wrap">
              {rule.body}
            </div>
          </details>
        ))}
      </div>
    </Dialog>
  )
}
