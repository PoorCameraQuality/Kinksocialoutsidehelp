import { toggleArrayItem } from '@/lib/utils/toggleArrayItem'
import { CONNECTION_GOAL_GROUPS } from '@/lib/profile-connection-goals'

type Props = {
  selected: string[]
  onChange: (next: string[]) => void
}

export default function ConnectionGoalsEditor({ selected, onChange }: Props) {
  const toggle = (value: string) => {
    onChange(toggleArrayItem(selected, value))
  }

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-dc-muted">
        Let people know what kinds of community connections you are open to. You control what appears publicly in{' '}
        <span className="text-dc-text-muted">Privacy & visibility</span>.
      </p>
      {CONNECTION_GOAL_GROUPS.map((group) => (
        <div key={group.id}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-dc-muted mb-2">{group.title}</h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {group.options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="rounded border-dc-border text-dc-accent"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
