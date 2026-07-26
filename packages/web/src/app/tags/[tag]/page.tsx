import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getMockContentByTag, getMockChannelById } from '@/data/mock-data'
import EventCard from '@/components/cards/EventCard'
import GroupCard from '@/components/cards/GroupCard'
import EducationCard from '@/components/cards/EducationCard'
import LocalPostCard from '@/components/cards/LocalPostCard'
import { mockLocalPostToHome } from '@/lib/feed-mapper'

const SECTIONS = ['Photos', 'Events', 'Groups', 'Articles', 'Discussions', 'Writings'] as const

export default function TagBrowsePage() {
  const params = useParams()
  const tagParam = (params.tag as string) ?? ''
  const tag = decodeURIComponent(tagParam).trim().toLowerCase()
  const content = tag ? getMockContentByTag(tag) : null

  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0])

  if (!tag) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-dc-elevated/95 rounded-2xl border border-dc-border p-12 text-center">
          <p className="text-dc-text-muted">No tag specified.</p>
          <Link to="/discovery" className="inline-block mt-4 text-dc-accent hover:underline">
            Find people
          </Link>
        </div>
      </div>
    )
  }

  const totalCount =
    (content?.photos.length ?? 0) +
    (content?.events.length ?? 0) +
    (content?.groups.length ?? 0) +
    (content?.articles.length ?? 0) +
    (content?.discussions.length ?? 0) +
    (content?.writings.length ?? 0)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dc-text">
          Content tagged <span className="text-dc-accent">#{tag}</span>
        </h1>
        <p className="text-sm text-dc-muted mt-1">
          {totalCount} result{totalCount !== 1 ? 's' : ''} across {SECTIONS.length} sections
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
        {SECTIONS.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === section ? 'text-dc-accent bg-dc-accent/10' : 'text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted'
            }`}
          >
            {section}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeSection === 'Photos' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Photos ({content?.photos.length ?? 0})
            </h2>
            {!content || content.photos.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No photos with this tag.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {content.photos.map((p, idx) => (
                  <div key={`photo-${idx}-${p.id}`} className="aspect-square rounded-xl bg-dc-elevated/95 border border-dc-border overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center bg-dc-elevated-solid">
                      {'url' in p && p.url ? (
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-12 h-12 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="p-2 bg-dc-elevated-solid/50">
                      <p className="text-xs text-dc-muted truncate">{'caption' in p ? (p.caption ?? 'Photo') : 'Photo'}</p>
                      <p className="text-[10px] text-dc-muted">by {'authorUsername' in p ? p.authorUsername : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'Events' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Events ({content?.events.length ?? 0})
            </h2>
            {!content || content.events.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No events with this tag.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'Groups' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Groups ({content?.groups.length ?? 0})
            </h2>
            {!content || content.groups.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No groups with this tag.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.groups.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'Articles' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Articles ({content?.articles.length ?? 0})
            </h2>
            {!content || content.articles.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No articles with this tag.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {content.articles.map((a) => (
                  <EducationCard key={a.slug ?? a.id} article={a} />
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'Discussions' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Discussions ({content?.discussions.length ?? 0})
            </h2>
            {!content || content.discussions.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No discussions with this tag.</p>
            ) : (
              <ul className="space-y-3">
                {content.discussions.map((d) => {
                  const channel = getMockChannelById(d.channelId)
                  const groupId = channel?.groupId
                  return (
                    <li key={d.id}>
                      <Link
                        to={groupId ? `/groups/${groupId}?tab=Channels` : '#'}
                        className="block bg-dc-elevated/95 rounded-2xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)] hover:border-dc-accent-border/40"
                      >
                        <p className="font-medium text-dc-text">{d.title}</p>
                        <p className="text-sm text-dc-muted mt-0.5">{d.content}</p>
                        <p className="text-xs text-dc-muted mt-1">
                          {d.createdAt} by {d.authorUsername}
                          {channel && ` · #${channel.name}`}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {activeSection === 'Writings' && (
          <section>
            <h2 className="text-sm font-semibold text-dc-muted uppercase mb-3">
              Writings ({content?.writings.length ?? 0})
            </h2>
            {!content || content.writings.length === 0 ? (
              <p className="text-dc-text-muted py-12 text-center">No feed posts with this tag.</p>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {content.writings.map((w) => (
                  <LocalPostCard key={w.id} post={mockLocalPostToHome(w)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
