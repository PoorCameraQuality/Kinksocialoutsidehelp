import { useCallback, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import type { JSONContent } from '@tiptap/core'

import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react'

import StarterKit from '@tiptap/starter-kit'

import Placeholder from '@tiptap/extension-placeholder'

import Link from '@tiptap/extension-link'

import Mention from '@tiptap/extension-mention'

import Image from '@tiptap/extension-image'

import tippy, { type Instance as TippyInstance } from 'tippy.js'

import 'tippy.js/dist/tippy.css'



import MentionList, { type MentionItem } from './MentionList'

import PostComposerModeBar from '@/components/home/PostComposerModeBar'
import FeedComposerQuickActions from '@/components/home/FeedComposerQuickActions'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useFeedComposerEngagement } from '@/contexts/FeedComposerUiContext'
import { cardSurfaceFeedActivityClass } from '@/lib/card-surface'

import StatusBanner from '@/components/ui/StatusBanner'


import type { FeedAttachment, FeedMention } from '@/lib/feed-types'
import { uploadFeedComposerAudio } from '@/lib/feed-audio-upload'
import { uploadFeedComposerImage } from '@/lib/feed-image-upload'
import { mediaDisplayUrl } from '@/lib/media-display-url'
import PersonalPhotoQuotaNotice from '@/components/media/PersonalPhotoQuotaNotice'
import { usePersonalPhotoQuota } from '@/hooks/usePersonalPhotoQuota'
import { PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE } from '@c2k/shared'

function feedAttachmentKey(a: FeedAttachment): string {
  if (a.type === 'media') return `${a.type}:${a.mediaItemId}`
  return `${a.type}:${a.url}`
}



function extractMentionsFromDoc(doc: JSONContent | null | undefined): FeedMention[] {

  const out: FeedMention[] = []

  const walk = (n?: JSONContent | null) => {

    if (!n) return

    if (n.type === 'mention' && n.attrs && n.attrs.id != null && n.attrs.label != null) {

      out.push({

        type: 'user',

        id: String(n.attrs.id),

        label: String(n.attrs.label),

      })

    }

    n.content?.forEach(walk)

  }

  walk(doc ?? null)

  return out

}



type Props = {
  onPosted: () => void
  showQuickActions?: boolean
  composerPlaceholder?: string
  compact?: boolean
  shellMode?: 'desktop' | 'mobile'
}



export default function HomeFeedRichComposer({
  onPosted,
  showQuickActions,
  composerPlaceholder = "What's happening near you?",
  compact = false,
  shellMode,
}: Props) {

  const [focused, setFocused] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  const [posting, setPosting] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [uploadingAudio, setUploadingAudio] = useState(false)

  const [extraAttachments, setExtraAttachments] = useState<FeedAttachment[]>([])
  const extraAttachmentsRef = useRef(extraAttachments)
  extraAttachmentsRef.current = extraAttachments
  const { quota, reload: reloadPhotoQuota } = usePersonalPhotoQuota(true)

  const composing = focused || hasDraft
  useFeedComposerEngagement(shellMode === 'mobile' || (!shellMode && composing))

  const editor = useEditor({

    extensions: [

      StarterKit.configure({ heading: false }),

      Placeholder.configure({ placeholder: composerPlaceholder }),

      Link.configure({ openOnClick: false, autolink: true }),

      Image.configure({ inline: true, allowBase64: false }),

      Mention.configure({

        HTMLAttributes: { class: 'text-dc-accent font-medium' },

        renderText({ node }) {

          return `@${node.attrs.label ?? node.attrs.id}`

        },

        renderHTML({ node }) {

          return ['span', { 'data-type': 'mention', 'data-id': node.attrs.id }, `@${node.attrs.label ?? node.attrs.id}`]

        },

        suggestion: {

          char: '@',

          allowSpaces: false,

          items: async ({ query }) => {

            const q = query.toLowerCase()

            if (!q) return []

            try {

              const r = await fetch(`/api/v1/mentions/suggest?q=${encodeURIComponent(q)}`, {

                credentials: 'include',

              })

              if (!r.ok) return []

              const data = (await r.json()) as { items?: MentionItem[] }

              return data.items ?? []

            } catch {

              return []

            }

          },

          render: () => {

            let reactRenderer: ReactRenderer

            let popup: TippyInstance | undefined



            return {

              onStart: (props) => {

                reactRenderer = new ReactRenderer(MentionList, {

                  props,

                  editor: props.editor,

                })

                popup = tippy(document.body, {

                  getReferenceClientRect: () => {

                    const rect = props.clientRect?.()

                    return rect ?? new DOMRect(0, 0, 0, 0)

                  },

                  appendTo: () => document.body,

                  content: reactRenderer.element,

                  showOnCreate: true,

                  interactive: true,

                  trigger: 'manual',

                  placement: 'bottom-start',

                })

              },

              onUpdate(props) {

                reactRenderer.updateProps(props)

                popup?.setProps({

                  getReferenceClientRect: () => {

                    const rect = props.clientRect?.()

                    return rect ?? new DOMRect(0, 0, 0, 0)

                  },

                })

              },

              onKeyDown(props) {

                if (props.event.key === 'Escape') {

                  popup?.hide()

                  return true

                }

                return (reactRenderer.ref as { onKeyDown?: (p: typeof props) => boolean })?.onKeyDown?.(props) ?? false

              },

              onExit() {

                popup?.destroy()

                reactRenderer.destroy()

              },

            }

          },

        },

      }),

    ],

    content: '',

    onUpdate: ({ editor: ed }) => {
      const text = ed.getText().trim()
      setHasDraft(Boolean(text || extraAttachmentsRef.current.length > 0))
    },

    editorProps: {

      attributes: {

        class:

          shellMode === 'desktop' && !focused ?
            'prose prose-invert prose-sm max-w-none min-h-[2.75rem] px-4 py-2.5 focus:outline-none text-dc-text [&_a]:text-dc-accent'
          : shellMode === 'mobile' ?
            'prose prose-invert prose-sm max-w-none min-h-[4.5rem] px-3 py-2.5 focus:outline-none text-dc-text [&_a]:text-dc-accent'
          : 'prose prose-invert prose-sm max-w-none min-h-[88px] px-4 py-3 focus:outline-none text-dc-text [&_a]:text-dc-accent',

      },

      handleDOMEvents: {

        focus: () => {
          setFocused(true)
          return false
        },

        blur: () => {
          setFocused(false)
          return false
        },

      },

    },

  })



  const runUpload = useCallback(async () => {

    if (!editor) return

    const input = document.createElement('input')

    input.type = 'file'

    input.accept = 'image/*'

    input.multiple = true

    input.onchange = async () => {

      const files = [...(input.files ?? [])]

      if (files.length === 0) return

      if (quota?.atLimit) {
        setPostError(PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE)
        return
      }

      const remaining = Math.max(0, Math.min(20 - extraAttachmentsRef.current.length, quota?.remaining ?? 20))
      if (remaining === 0) {
        setPostError('You can attach up to 20 photos per post.')
        return
      }
      const batch = files.slice(0, remaining)
      const trimmedNotice =
        batch.length < files.length
          ? `Only ${remaining} more photo${remaining === 1 ? '' : 's'} can be added to this post.`
          : null

      setUploading(true)

      setPostError(null)

      try {

        const prepared: FeedAttachment[] = []
        let pendingMessage: string | undefined

        for (const file of batch) {
          const result = await uploadFeedComposerImage(file)
          if (!result.ok) {
            setPostError(result.error)
            if (prepared.length > 0) {
              setExtraAttachments((prev) => [...prev, ...prepared])
              setHasDraft(true)
            }
            return
          }
          prepared.push(result.attachment)
          if (result.pendingReview && result.message) {
            pendingMessage = result.message
          }
        }

        setExtraAttachments((prev) => [...prev, ...prepared])
        setHasDraft(true)
        void reloadPhotoQuota()
        if (pendingMessage) {
          setPostError(pendingMessage)
        } else if (trimmedNotice) {
          setPostError(trimmedNotice)
        }

      } catch (err) {

        setPostError(err instanceof Error ? err.message : 'Network error during upload')

      } finally {

        setUploading(false)

      }

    }

    input.click()

  }, [editor, quota?.atLimit, quota?.remaining, reloadPhotoQuota])



  const runAudioUpload = useCallback(async () => {

    const input = document.createElement('input')

    input.type = 'file'

    input.accept = 'audio/*'

    input.onchange = async () => {

      const file = input.files?.[0]

      if (!file) return

      setUploadingAudio(true)

      setPostError(null)

      try {

        const result = await uploadFeedComposerAudio(file)

        if (!result.ok) {

          setPostError(result.error)

          return

        }

        setExtraAttachments((prev) => [...prev, result.attachment])

        setHasDraft(true)

        if (result.message) {

          setPostError(result.message)

        }

      } catch (err) {

        setPostError(err instanceof Error ? err.message : 'Network error during audio upload')

      } finally {

        setUploadingAudio(false)

      }

    }

    input.click()

  }, [])



  const removeExtraAttachment = useCallback((idx: number) => {
    setExtraAttachments((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (editor) {
        setHasDraft(Boolean(editor.getText().trim() || next.length > 0))
      }
      return next
    })
  }, [editor])



  const submit = useCallback(async () => {

    if (!editor) return

    const text = editor.getText().trim()

    if (!text && extraAttachments.length === 0) {

      setPostError('Write something, add media, or attach audio.')

      return

    }

    setPosting(true)

    setPostError(null)

    const mentions = extractMentionsFromDoc(editor.getJSON())

    const html = editor.getHTML()

    const seen = new Set<string>()

    const merged: FeedAttachment[] = []

    for (const a of extraAttachments) {

      const key = feedAttachmentKey(a)

      if (seen.has(key)) continue

      seen.add(key)

      merged.push(a)

    }



    try {

      const r = await fetch('/api/v1/feed/posts', {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          kind: 'status',

          body: html,

          bodyFormat: 'html',

          attachments: merged.length ? merged : undefined,

          mentions: mentions.length ? mentions : undefined,

        }),

      })

      const errBody = (await r.json().catch(() => ({}))) as { error?: string }

      if (!r.ok) {

        setPostError(errBody.error ?? `Could not post (${r.status})`)

        return

      }

      editor.commands.clearContent()

      setExtraAttachments([])
      setHasDraft(false)

      onPosted()

    } catch {

      setPostError('Network error')

    } finally {

      setPosting(false)

    }

  }, [editor, extraAttachments, onPosted])



  if (!editor) {

    return (

      <StatusBanner tone="info">Loading editor…</StatusBanner>

    )

  }



  return (

    <div className="space-y-2">

      {!showQuickActions ? <PostComposerModeBar /> : null}

      <Card padding="none" className={`overflow-hidden ring-1 ring-dc-border/40 ${cardSurfaceFeedActivityClass}`}>

        <EditorContent editor={editor} />

      </Card>

      {showQuickActions ?
        <FeedComposerQuickActions
          onPhoto={runUpload}
          variant={
            shellMode === 'mobile' ? 'home-mobile'
            : shellMode === 'desktop' ? 'home-desktop'
            : 'full'
          }
        />
      : null}

      {extraAttachments.length > 0 ? (

        <ul className="flex flex-wrap gap-2">

          {extraAttachments.map((a, i) => (

            <li

              key={`${feedAttachmentKey(a)}-${i}`}

              className="relative inline-flex items-center gap-2 rounded-md border border-dc-border bg-dc-elevated-muted p-1"

            >

              {a.type === 'media' && a.mediaKind === 'image' && a.previewUrl ?
                <img
                  src={mediaDisplayUrl(a.previewUrl)}
                  alt=""
                  className="h-16 w-16 rounded object-cover"
                />
              : a.type === 'media' && a.mediaKind === 'audio' ?
                <audio
                  controls
                  src={a.previewUrl ? mediaDisplayUrl(a.previewUrl) : undefined}
                  className="max-w-[14rem]"
                />
              : a.type === 'audio' ?
                <audio controls src={a.url} className="max-w-[14rem]" />
              : <span className="px-2 text-[11px] text-dc-muted">Photo</span>}

              <Button

                type="button"

                variant="ghost"

                size="sm"

                className="min-h-0 px-1 py-0 text-dc-text-muted hover:text-dc-text"

                onClick={() => removeExtraAttachment(i)}

                aria-label="Remove attachment"

              >

                ×

              </Button>

            </li>

          ))}

        </ul>

      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">

        {shellMode && !focused && !hasDraft ?
          null
        : shellMode === 'mobile' ?
          null
        : <div className="flex flex-wrap items-center gap-1.5">

          <Button

            type="button"

            variant="ghost"

            size="sm"

            onMouseDown={(e) => e.preventDefault()}

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

            onMouseDown={(e) => e.preventDefault()}

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

            onMouseDown={(e) => e.preventDefault()}

            onClick={runUpload}

            disabled={uploading || Boolean(quota?.atLimit)}

            title={quota?.atLimit ? PERSONAL_PHOTO_LIMIT_REACHED_MESSAGE : undefined}

            className="gap-1"

          >

            <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>

              <path

                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.5}

                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"

              />

            </svg>

            {uploading ? '…' : 'Image'}

          </Button>

          <Button

            type="button"

            variant="ghost"

            size="sm"

            onMouseDown={(e) => e.preventDefault()}

            onClick={() => void runAudioUpload()}

            disabled={uploadingAudio}

            className="gap-1"

          >

            <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>

              <path

                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={1.5}

                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"

              />

            </svg>

            {uploadingAudio ? '…' : 'Audio'}

          </Button>

        </div>}

        {(!shellMode || shellMode === 'mobile' || focused || hasDraft) && (
          <Button
            type="button"
            variant="primary"
            disabled={posting}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void submit()}
            className={shellMode === 'mobile' ? 'w-full' : 'ml-auto shrink-0'}
          >

            {posting ? 'Posting…' : 'Post'}

          </Button>
        )}

      </div>

      {!compact ?
        <p className="text-[11px] leading-snug text-dc-muted">
          Type @ to mention. Server sanitizes HTML.{' '}
          <RouterLink to="/education/write" className="text-dc-accent hover:underline">
            Write a long-form education article
          </RouterLink>
          .
        </p>
      : null}

      <PersonalPhotoQuotaNotice quota={quota} showCount={!compact} />

      {postError ?

        <StatusBanner tone="warning">{postError}</StatusBanner>

      : null}

    </div>

  )

}

