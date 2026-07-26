import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'

import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor, JSONContent } from '@tiptap/core'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

import Button from '@/components/ui/Button'
import { uploadEducationImage } from '@/lib/education-image-upload'
import Card from '@/components/ui/Card'

/** Same hostname/path rules as API `sanitizeEducationHtml`. */
export const ALLOWED_EDUCATION_IFRAME_SRC =
  /^(https?:\/\/(?:www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]+(?:\?[^"']*)?|https?:\/\/player\.vimeo\.com\/video\/\d+(?:\?[^"']*)?)$/i

export function videoPageUrlToAllowedEmbedSrc(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
  let u: URL
  try {
    u = new URL(withProto)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()

  const trySrc = (src: string): string | null => {
    const s = src.trim()
    return ALLOWED_EDUCATION_IFRAME_SRC.test(s) ? s : null
  }

  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '').split(/[/?#]/)[0]
    return id ? trySrc(`https://www.youtube.com/embed/${id}${u.search}`) : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname.startsWith('/embed/')) {
      return trySrc(`${u.origin.replace('m.youtube.com', 'www.youtube.com')}${u.pathname}${u.search}`)
    }
    const watchId =
      u.searchParams.get('v') ||
      (u.pathname.startsWith('/shorts/') ? u.pathname.slice('/shorts/'.length).split('/')[0] : null)
    return watchId ? trySrc(`https://www.youtube.com/embed/${watchId}${u.search}`) : null
  }

  if (host === 'vimeo.com') {
    const m = /^\/(?:video\/)?(\d+)/.exec(u.pathname)
    return m?.[1] ? trySrc(`https://player.vimeo.com/video/${m[1]}${u.search}`) : null
  }

  if (host === 'player.vimeo.com' && u.pathname.startsWith('/video/')) {
    return trySrc(`${u.origin}${u.pathname}${u.search}`)
  }

  return trySrc(trimmed)
}

export const EducationVideoIframe = Node.create({
  name: 'educationVideoIframe',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'iframe',
        getAttrs(element) {
          const el = element as HTMLIFrameElement
          const src = el.getAttribute('src')?.trim() ?? ''
          if (!ALLOWED_EDUCATION_IFRAME_SRC.test(src)) return false
          return { src }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(HTMLAttributes, {
        src: HTMLAttributes.src,
        allowfullscreen: true,
        loading: 'lazy',
      }),
    ]
  },
})

export type EducatorArticleEditorHandle = {
  getBody: () => { html: string; json: Record<string, unknown> }
  readonly editor: Editor | null
}

type Props = {
  initialHtml?: string | null
  initialDoc?: JSONContent | null
  placeholder?: string
}

const MIN_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

function pickInitialContent(initialDoc: JSONContent | null | undefined, initialHtml: string | null | undefined) {
  if (initialDoc && initialDoc.type === 'doc') return initialDoc
  if (initialHtml?.trim()) return initialHtml
  return MIN_DOC
}

const EducatorArticleEditor = forwardRef<EducatorArticleEditorHandle, Props>(function EducatorArticleEditor(
  { initialHtml, initialDoc, placeholder = 'Write your article…' },
  ref,
) {
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: true }),
      EducationVideoIframe,
    ],
    content: pickInitialContent(initialDoc ?? null, initialHtml ?? null),
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none text-dc-text [&_a]:text-dc-accent [&_h2]:text-dc-text [&_h3]:text-dc-text',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = pickInitialContent(initialDoc ?? null, initialHtml ?? null)
    const cur = editor.getJSON()
    const same =
      typeof next !== 'string' &&
      typeof cur === 'object' &&
      JSON.stringify(cur) === JSON.stringify(next as JSONContent)
    if (same) return

    editor.commands.setContent(next, false)
  }, [editor, initialDoc, initialHtml])

  useImperativeHandle(
    ref,
    () => ({
      getBody() {
        if (!editor) return { html: '', json: {} }
        return {
          html: editor.getHTML(),
          json: editor.getJSON() as Record<string, unknown>,
        }
      },
      get editor() {
        return editor
      },
    }),
    [editor],
  )

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
        const url = await uploadEducationImage(file, 'inline')
        editor.chain().focus().setImage({ src: url }).run()
      } catch (err) {
        if (typeof window !== 'undefined') {
          window.alert(err instanceof Error ? err.message : 'Image upload failed')
        }
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }, [editor])

  const insertEmbed = useCallback(() => {
    if (!editor) return
    const raw = typeof window !== 'undefined' ? window.prompt('Paste a YouTube or Vimeo URL') : null
    const src = raw ? videoPageUrlToAllowedEmbedSrc(raw) : null
    if (!src) {
      if (raw?.trim())
        typeof window !== 'undefined' &&
          window.alert('Only YouTube or Vimeo URLs that map to embeddable URLs are supported.')
      return
    }
    editor.chain().focus().insertContent({ type: 'educationVideoIframe', attrs: { src } }).run()
  }, [editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const next = typeof window !== 'undefined' ? window.prompt('Link URL', prev ?? 'https://') : null
    if (next === null) return
    const trimmed = next.trim()
    if (trimmed === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
  }, [editor])

  if (!editor) {
    return <p className="text-sm text-dc-muted py-4">Loading editor…</p>
  }

  return (
    <div className="space-y-2">
      <Card padding="none" className="overflow-hidden border-dc-border bg-dc-surface-muted">
        <EditorContent editor={editor} />
      </Card>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="min-w-[2rem] px-2 font-semibold"
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
        >
          B
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="min-w-[2rem] px-2 italic"
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
        >
          I
        </Button>
        <span className="mx-0.5 h-4 w-px bg-white/15" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-pressed={editor.isActive('heading', { level: 2 })}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-pressed={editor.isActive('heading', { level: 3 })}
        >
          H3
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-pressed={editor.isActive('bulletList')}
        >
          List
        </Button>
        <span className="mx-0.5 h-4 w-px bg-white/15" aria-hidden />
        <Button type="button" variant="ghost" size="sm" onClick={setLink}>
          Link
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => void runUpload()}>
          {uploading ? '…' : 'Image'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={insertEmbed}>
          Video embed
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-dc-muted">
        Embed YouTube/Vimeo via “Video embed”. Server allows only sanctioned iframe sources; other HTML is sanitized on
        save.
      </p>
    </div>
  )
})

export default EducatorArticleEditor
