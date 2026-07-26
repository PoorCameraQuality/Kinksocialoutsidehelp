import { useEffect } from 'react'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'

const EDITOR_CLASS =
  'prose prose-invert prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none text-dc-text [&_a]:text-dc-accent [&_h2]:text-dc-text [&_h3]:text-dc-text [&_hr]:border-dc-border'

function getMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } }
  return storage.markdown?.getMarkdown?.() ?? ''
}

type ToolbarButtonProps = {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`min-h-11 min-w-11 shrink-0 rounded-lg border px-2.5 text-sm transition-colors ${
        active ?
          'border-dc-accent/40 bg-dc-accent/10 text-dc-text'
        : 'border-dc-border text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
      }`}
    >
      {children}
    </button>
  )
}

type Props = {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
}

export default function MarkdownRichEditor({
  value,
  onChange,
  placeholder = 'Tell the community about yourself…',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: EDITOR_CLASS,
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(getMarkdown(current))
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = getMarkdown(editor)
    if (value !== current) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  const setLink = () => {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  if (!editor) {
    return <div className="text-sm text-dc-muted py-6">Loading editor…</div>
  }

  return (
    <div className="rounded-xl border border-dc-border bg-dc-elevated-solid overflow-hidden">
      <div className="flex gap-1.5 overflow-x-auto border-b border-dc-border bg-dc-surface-muted/50 p-2 [-webkit-overflow-scrolling:touch]">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Heading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          Rule
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <p className="border-t border-dc-border px-4 py-2 text-[11px] text-dc-muted">
        Stored as Markdown. Use toolbar or type **bold**, *italic*, ## headings, and --- dividers.
      </p>
    </div>
  )
}
