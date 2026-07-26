import { useState } from 'react'
import MarkdownContent from '@/components/ui/MarkdownContent'
import MarkdownRichEditor from '@/components/editor/MarkdownRichEditor'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'

const ABOUT_TEMPLATE = `**Vanilla Me:**



---

**Kink Me:**



`

export default function AboutPanel() {
  const ctx = useProfileEdit()
  const [preview, setPreview] = useState(false)

  return (
    <ProfileStudioSectionCard
      title="About"
      description="Your profile story — intro, tagline, and depth. This is the only text field for how you describe yourself."
      icon={<IconUser />}
    >
      <p className="mb-4 text-sm leading-relaxed text-dc-text-muted">
        Use the rich editor for your full story. The first sentence appears in your profile hero; the rest shows in your
        About section. Markdown, headings, and lists are supported — try the Vanilla / Kink template if you want a
        starting structure.
      </p>

      <ProfileStudioInsetCard className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-dc-border/60 pb-2">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`min-h-10 text-sm px-3 py-1.5 rounded ${!preview ? 'bg-dc-elevated-muted text-dc-text' : 'text-dc-muted'}`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`min-h-10 text-sm px-3 py-1.5 rounded ${preview ? 'bg-dc-elevated-muted text-dc-text' : 'text-dc-muted'}`}
        >
          Preview
        </button>
        {!ctx.bio.trim() ?
          <button
            type="button"
            onClick={() => ctx.setBio(ABOUT_TEMPLATE)}
            className="ml-auto min-h-10 text-xs text-dc-accent hover:underline"
          >
            Insert Vanilla / Kink template
          </button>
        : null}
      </div>

      {preview ?
        <MarkdownContent
          markdown={ctx.bio}
          className="min-h-[200px] px-1"
          emptyFallback={<span className="text-dc-muted italic">Nothing written yet.</span>}
        />
      : (
        <MarkdownRichEditor value={ctx.bio} onChange={ctx.setBio} />
      )}
      </ProfileStudioInsetCard>
    </ProfileStudioSectionCard>
  )
}
