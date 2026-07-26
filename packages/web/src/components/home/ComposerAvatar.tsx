export default function ComposerAvatar({ initial }: { initial: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc-accent/20 text-sm font-semibold text-dc-accent ring-1 ring-[rgba(214,178,59,0.25)]"
      aria-hidden
    >
      {initial}
    </div>
  )
}
