'use client'

import { useCallback, useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { uploadMediaFile } from '@/lib/upload-media'

function toAbsoluteMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${trimmed}`
  }
  return trimmed
}

type Props = {
  valueHtml: string
  disabled?: boolean
  onChangeHtml: (html: string) => void
  placeholder?: string
}

/** TipTap body for organizer email campaigns — absolute image URLs for inbox clients. */
export function CampaignBodyEditor({
  valueHtml,
  disabled,
  onChangeHtml,
  placeholder = 'Write your campaign…',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: valueHtml?.trim() ? valueHtml : '<p></p>',
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none min-h-[12rem] px-3 py-3 focus:outline-none text-dc-text [&_a]:text-dc-accent [&_img]:max-w-full [&_img]:rounded-md',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeHtml(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = valueHtml?.trim() ? valueHtml : '<p></p>'
    if (current !== next && !editor.isFocused) {
      editor.commands.setContent(next, false)
    }
  }, [editor, valueHtml])

  const runUpload = useCallback(async () => {
    if (!editor || disabled) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(true)
      setUploadErr(null)
      try {
        const uploaded = await uploadMediaFile(file, 'org_rich_bio')
        if (uploaded.status !== 'url' || !uploaded.url) {
          throw new Error('Image upload did not return a public URL. Try again or use a smaller file.')
        }
        editor.chain().focus().setImage({ src: toAbsoluteMediaUrl(uploaded.url) }).run()
        onChangeHtml(editor.getHTML())
      } catch (e) {
        setUploadErr(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }, [disabled, editor, onChangeHtml])

  const setLink = useCallback(() => {
    if (!editor || disabled) return
    const prev = editor.getAttributes('link').href as string | undefined
    const raw = window.prompt('Link URL (https://…)', prev ?? 'https://')
    if (raw === null) return
    const url = raw.trim()
    if (!url) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }, [disabled, editor])

  if (!editor) {
    return <div className="min-h-[12rem] rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-3 text-sm text-dc-muted">Loading editor…</div>
  }

  const btn =
    'rounded-lg border border-dc-border px-2.5 py-1.5 text-[11px] font-semibold text-dc-muted hover:bg-dc-elevated-muted disabled:opacity-40'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          Heading
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          List
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => void setLink()}>
          Link
        </button>
        <button type="button" className={btn} disabled={disabled || uploading} onClick={() => void runUpload()}>
          {uploading ? 'Uploading…' : 'Image'}
        </button>
      </div>
      <div className="rounded-lg border border-dc-border bg-dc-elevated-solid">
        <EditorContent editor={editor} />
      </div>
      {uploadErr ? <p className="text-xs text-dc-danger">{uploadErr}</p> : null}
      <p className="text-[11px] text-dc-muted">
        Images use absolute URLs so they load in email clients. Keep layout simple — inboxes strip most styling.
      </p>
    </div>
  )
}
