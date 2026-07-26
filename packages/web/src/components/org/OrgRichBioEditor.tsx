import { useCallback, useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

function escapePlainForHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

type Props = {
  bio: string | null
  bioFormat: 'text' | 'html'
  saving: boolean
  error: string | null
  onSave: (html: string) => void
  onCancel: () => void
  onDismissError?: () => void
}

export default function OrgRichBioEditor({ bio, bioFormat, saving, error, onSave, onCancel, onDismissError }: Props) {
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: 'Describe your organization…' }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none min-h-[120px] px-4 py-3 focus:outline-none text-dc-text-muted [&_a]:text-dc-accent',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const raw = bio ?? ''
    if (bioFormat === 'html' && raw.trim()) {
      editor.commands.setContent(raw)
    } else if (raw.trim()) {
      editor.commands.setContent(`<p>${escapePlainForHtml(raw)}</p>`)
    } else {
      editor.commands.clearContent()
    }
  }, [editor, bio, bioFormat])

  const runUpload = useCallback(async () => {
    if (!editor) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('purpose', 'org_rich_bio')
        fd.append('file', file)
        const r = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd })
        const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
        if (r.ok && data.url) {
          editor.chain().focus().setImage({ src: data.url }).run()
        }
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }, [editor])

  const handleSave = useCallback(() => {
    if (!editor) return
    const html = editor.getHTML()
    onSave(html)
  }, [editor, onSave])

  if (!editor) {
    return <div className="text-sm text-dc-muted py-4">Loading editor…</div>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dc-border bg-dc-elevated-solid">
        <EditorContent editor={editor} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="rounded-lg border border-dc-border px-2 py-1.5 text-[11px] font-semibold text-dc-text-muted hover:bg-dc-elevated-muted"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="rounded-lg border border-dc-border px-2 py-1.5 text-[11px] italic text-dc-text-muted hover:bg-dc-elevated-muted"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => void runUpload()}
          disabled={uploading}
          className="rounded-lg border border-dc-border px-2 py-1.5 text-[11px] text-dc-text-muted hover:bg-dc-elevated-muted disabled:opacity-50"
        >
          {uploading ? 'Upload…' : 'Image'}
        </button>
      </div>
      {error ?
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1">{error}</p>
            {onDismissError ?
              <button
                type="button"
                onClick={onDismissError}
                className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
              >
                Dismiss
              </button>
            : null}
          </div>
        </div>
      : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-11 px-4 py-2 rounded-xl text-sm bg-dc-accent text-dc-text disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save description'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-11 px-4 py-2 rounded-xl text-sm border border-dc-border text-dc-text-muted hover:text-dc-text"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
