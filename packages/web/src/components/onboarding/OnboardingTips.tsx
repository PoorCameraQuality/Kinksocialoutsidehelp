import type { ReactNode } from 'react'

type Tip = { title: string; body: string }

type Props = {
  title?: string
  tips: Tip[]
}

/** Right-rail tip card used across hybrid onboarding steps. */
export default function OnboardingTips({ title = 'Tips', tips }: Props) {
  return (
    <aside className="rounded-2xl border border-dc-border bg-dc-elevated/80 p-4 shadow-[var(--dc-shadow-soft)] lg:sticky lg:top-6">
      <h3 className="text-sm font-semibold text-dc-text">{title}</h3>
      <ul className="mt-3 space-y-3">
        {tips.map((tip) => (
          <li key={tip.title} className="text-sm">
            <p className="font-medium text-dc-accent">{tip.title}</p>
            <p className="mt-0.5 text-dc-text-muted leading-relaxed">{tip.body}</p>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function OnboardingStepLayout({
  children,
  tips,
  tipsTitle,
}: {
  children: ReactNode
  tips: Tip[]
  tipsTitle?: string
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0">{children}</div>
      <div className="min-w-0 lg:block">
        <OnboardingTips title={tipsTitle} tips={tips} />
      </div>
    </div>
  )
}
