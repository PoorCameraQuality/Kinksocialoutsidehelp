import { useCallback, useEffect, useState } from 'react'
import CommunityTrustChip from '@/components/trust/CommunityTrustChip'



type GroupRow = {

  id: string

  name: string

  description: string | null

  memberCount: number

  recruitmentStatus?: string

  status?: string

  myRole?: string | null

}



type GroupDetail = {

  group: GroupRow & { myRole: string | null; status?: string }

  members: Array<{ userId: string; role: string; displayName: string; username: string }>

  announcements: Array<{ id: string; body: string; createdAt: string }>

  chores: Array<{ id: string; title: string; description: string | null; assigneeUserId: string | null; status: string }>

  bringItems: Array<{ id: string; title: string; quantity: number; bringerUserId: string | null }>

  pendingJoinRequests?: Array<{
    id: string
    userId: string
    message: string | null
    createdAt: string
    displayName: string
    username: string
  }>

}



type Mode = 'discover' | 'mine' | 'create'



async function readApiError(r: Response, fallback: string): Promise<string> {

  try {

    const j = (await r.json()) as { error?: string }

    return j.error ?? fallback

  } catch {

    return fallback

  }

}



export default function ConventionAttendeeGroupsPanel({ conventionKey }: { conventionKey: string }) {

  const key = encodeURIComponent(conventionKey)

  const [mode, setMode] = useState<Mode>('discover')

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [selected, setSelected] = useState<GroupDetail | null>(null)

  const [loading, setLoading] = useState(true)

  const [err, setErr] = useState<string | null>(null)

  const [msg, setMsg] = useState<string | null>(null)

  const [createName, setCreateName] = useState('')

  const [createDesc, setCreateDesc] = useState('')

  const [announcement, setAnnouncement] = useState('')

  const [newChore, setNewChore] = useState('')

  const [newBring, setNewBring] = useState('')

  const [settingsBusy, setSettingsBusy] = useState(false)



  const loadList = useCallback(async () => {

    setLoading(true)

    setErr(null)

    try {

      const url =

        mode === 'mine'

          ? `/api/v1/conventions/${key}/attendee-groups/mine`

          : `/api/v1/conventions/${key}/attendee-groups`

      const r = await fetch(url, { credentials: 'include' })

      if (!r.ok) {

        setGroups([])

        setErr(await readApiError(r, 'Could not load groups.'))

        return

      }

      const d = (await r.json()) as { groups: GroupRow[] }

      setGroups(d.groups ?? [])

    } finally {

      setLoading(false)

    }

  }, [key, mode])



  useEffect(() => {

    if (mode !== 'create') void loadList()

  }, [loadList, mode])



  useEffect(() => {

    if (!msg) return

    const t = window.setTimeout(() => setMsg(null), 4000)

    return () => window.clearTimeout(t)

  }, [msg])



  async function openGroup(groupId: string) {

    setErr(null)

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}`, {

      credentials: 'include',

    })

    if (!r.ok) {

      setErr(await readApiError(r, 'Could not load group.'))

      return

    }

    const detail = (await r.json()) as GroupDetail

    const role = detail.group.myRole

    if (role === 'owner' || role === 'admin') {

      const jr = await fetch(

        `/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/join-requests`,

        { credentials: 'include' },

      )

      if (jr.ok) {

        const d = (await jr.json()) as { requests: GroupDetail['pendingJoinRequests'] }

        detail.pendingJoinRequests = d.requests ?? []

      }

    }

    setSelected(detail)

  }



  async function joinGroup(groupId: string) {

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/join`, {

      method: 'POST',

      credentials: 'include',

      headers: { 'Content-Type': 'application/json' },

      body: '{}',

    })

    if (r.ok) {

      const d = (await r.json()) as { pending?: boolean }

      setMsg(d.pending ? 'Join request submitted. The owner will review it.' : 'Joined group.')

      void openGroup(groupId)

    } else {

      setErr(await readApiError(r, 'Could not join group.'))

    }

  }



  async function createGroup() {

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups`, {

      method: 'POST',

      credentials: 'include',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined }),

    })

    if (!r.ok) {

      setErr(await readApiError(r, 'Could not create group.'))

      return

    }

    setCreateName('')

    setCreateDesc('')

    setMode('mine')

    setMsg('Group created.')

    void loadList()

  }



  async function postAnnouncement(groupId: string) {

    const body = announcement.trim()

    if (!body) return

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/announcements`, {

      method: 'POST',

      credentials: 'include',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ body }),

    })

    if (!r.ok) {

      setErr(await readApiError(r, 'Could not post announcement.'))

      return

    }

    setAnnouncement('')

    setMsg('Announcement posted.')

    void openGroup(groupId)

  }



  async function addChore(groupId: string) {

    const title = newChore.trim()

    if (!title) return

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/chores`, {

      method: 'POST',

      credentials: 'include',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ title }),

    })

    if (!r.ok) {

      setErr(await readApiError(r, 'Could not add chore.'))

      return

    }

    setNewChore('')

    setMsg('Chore added.')

    void openGroup(groupId)

  }



  async function addBringItem(groupId: string) {

    const title = newBring.trim()

    if (!title) return

    const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/bring-items`, {

      method: 'POST',

      credentials: 'include',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ title, quantity: 1 }),

    })

    if (!r.ok) {

      setErr(await readApiError(r, 'Could not add bring item.'))

      return

    }

    setNewBring('')

    setMsg('Bring item added.')

    void openGroup(groupId)

  }



  async function respondJoinRequest(groupId: string, requestId: string, status: 'approved' | 'denied') {

    setSettingsBusy(true)

    setErr(null)

    try {

      const r = await fetch(

        `/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}/join-requests/${encodeURIComponent(requestId)}`,

        {

          method: 'PATCH',

          credentials: 'include',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ status }),

        },

      )

      if (!r.ok) {

        setErr(await readApiError(r, 'Could not update join request.'))

        return

      }

      setMsg(status === 'approved' ? 'Member approved.' : 'Join request denied.')

      void openGroup(groupId)

      void loadList()

    } finally {

      setSettingsBusy(false)

    }

  }



  async function updateRecruitment(groupId: string, status: 'open' | 'closed') {

    setSettingsBusy(true)

    setErr(null)

    try {

      const r = await fetch(`/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(groupId)}`, {

        method: 'PATCH',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ status }),

      })

      if (!r.ok) {

        setErr(await readApiError(r, 'Could not update recruitment.'))

        return

      }

      setMsg(status === 'open' ? 'Group is now seeking members.' : 'Recruitment closed.')

      void openGroup(groupId)

      void loadList()

    } finally {

      setSettingsBusy(false)

    }

  }



  if (selected) {

    const g = selected.group

    const isOwner = g.myRole === 'owner' || g.myRole === 'admin'

    const isMember = Boolean(g.myRole)

    const recruitmentOpen = (g.status ?? (g.recruitmentStatus === 'seeking' ? 'open' : 'closed')) === 'open'

    return (

      <div className="space-y-4">

        <button type="button" className="text-sm text-dc-accent hover:underline" onClick={() => setSelected(null)}>

          ← Back to groups

        </button>

        {err ? <p className="text-sm text-red-300">{err}</p> : null}

        {msg ? <p className="text-sm text-emerald-200">{msg}</p> : null}

        <div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Attendee group</p>

          <h3 className="font-serif text-2xl text-dc-text">{g.name}</h3>

          {g.description ? <p className="mt-2 text-sm text-dc-text-muted">{g.description}</p> : null}

          <p className="mt-2 text-xs text-dc-muted">

            {g.memberCount} member{g.memberCount === 1 ? '' : 's'}

            {recruitmentOpen ?

              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">Seeking members</span>

            : <span className="ml-2 rounded-full bg-dc-elevated-muted px-2 py-0.5 text-dc-muted">Not recruiting</span>}

          </p>

        </div>

        {isOwner ?

          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              disabled={settingsBusy || recruitmentOpen}

              className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"

              onClick={() => void updateRecruitment(g.id, 'open')}

            >

              Open recruitment

            </button>

            <button

              type="button"

              disabled={settingsBusy || !recruitmentOpen}

              className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"

              onClick={() => void updateRecruitment(g.id, 'closed')}

            >

              Close recruitment

            </button>

          </div>

        : null}

        {isOwner && (selected.pendingJoinRequests?.length ?? 0) > 0 ?

          <section className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">

            <h4 className="text-sm font-semibold text-dc-text">Pending join requests</h4>

            <ul className="space-y-2">

              {(selected.pendingJoinRequests ?? []).map((req) => (

                <li key={req.id} className="rounded-lg border border-dc-border bg-dc-surface-muted p-2 text-sm">

                  <p className="font-medium text-dc-text">

                    {req.displayName} (@{req.username})

                  </p>

                  {req.message ?

                    <p className="mt-1 text-xs text-dc-text-muted whitespace-pre-wrap">{req.message}</p>

                  : null}

                  <div className="mt-2 flex flex-wrap gap-2">

                    <button

                      type="button"

                      disabled={settingsBusy}

                      className="rounded-lg bg-emerald-600/90 px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"

                      onClick={() => void respondJoinRequest(g.id, req.id, 'approved')}

                    >

                      Approve

                    </button>

                    <button

                      type="button"

                      disabled={settingsBusy}

                      className="rounded-lg border border-dc-border px-3 py-1 text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"

                      onClick={() => void respondJoinRequest(g.id, req.id, 'denied')}

                    >

                      Deny

                    </button>

                  </div>

                </li>

              ))}

            </ul>

          </section>

        : null}

        {!isMember ?

          <button

            type="button"

            className="rounded-xl bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500"

            onClick={() => void joinGroup(g.id)}

          >

            Join group

          </button>

        : null}



        <section className="space-y-2">

          <h4 className="text-sm font-semibold text-dc-text">Members</h4>

          <ul className="space-y-1 text-sm">

            {selected.members.map((m) => (

              <li key={m.userId} className="flex justify-between gap-2 text-dc-text-muted">

                <span className="flex flex-wrap items-center gap-1.5">
                  {m.displayName} (@{m.username})
                  <CommunityTrustChip username={m.username} />
                </span>

                <span className="text-xs uppercase text-dc-muted">{m.role}</span>

              </li>

            ))}

          </ul>

        </section>



        {isMember ?

          <>

            <section className="space-y-2">

              <h4 className="text-sm font-semibold text-dc-text">Announcements</h4>

              {selected.announcements.length === 0 ?

                <p className="text-xs text-dc-muted">No announcements yet.</p>

              : selected.announcements.map((a) => (

                  <p key={a.id} className="rounded-lg border border-dc-border p-2 text-sm text-dc-text-muted whitespace-pre-wrap">

                    {a.body}

                  </p>

                ))

              }

              <textarea

                className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"

                rows={3}

                placeholder="Announcement to members…"

                value={announcement}

                onChange={(e) => setAnnouncement(e.target.value)}

              />

              <button

                type="button"

                className="rounded-xl bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"

                disabled={!announcement.trim()}

                onClick={() => void postAnnouncement(g.id)}

              >

                Post

              </button>

            </section>



            <section className="space-y-2">

              <h4 className="text-sm font-semibold text-dc-text">Chores</h4>

              {selected.chores.map((c) => (

                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dc-border p-2 text-sm">

                  <span className="text-dc-text">{c.title}</span>

                  {!c.assigneeUserId && isMember ?

                    <button

                      type="button"

                      className="text-xs text-dc-accent hover:underline"

                      onClick={async () => {

                        const r = await fetch(

                          `/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(g.id)}/chores/${encodeURIComponent(c.id)}/signup`,

                          { method: 'POST', credentials: 'include' },

                        )

                        if (r.ok) void openGroup(g.id)

                        else setErr(await readApiError(r, 'Could not sign up for chore.'))

                      }}

                    >

                      + Sign up

                    </button>

                  : <span className="text-xs text-dc-muted">Assigned</span>}

                </div>

              ))}

              {isOwner ?

                <div className="flex flex-wrap gap-2">

                  <input

                    className="min-w-[12rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"

                    placeholder="New chore"

                    value={newChore}

                    onChange={(e) => setNewChore(e.target.value)}

                  />

                  <button

                    type="button"

                    className="rounded-lg bg-amber-600/90 px-3 py-1 text-sm font-semibold text-black disabled:opacity-50"

                    disabled={!newChore.trim()}

                    onClick={() => void addChore(g.id)}

                  >

                    Add chore

                  </button>

                </div>

              : null}

            </section>



            <section className="space-y-2">

              <h4 className="text-sm font-semibold text-dc-text">Bring list</h4>

              {selected.bringItems.map((item) => (

                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-dc-border p-2 text-sm">

                  <span className="text-dc-text">

                    {item.title} ({item.bringerUserId ? '1' : '0'}/{item.quantity})

                  </span>

                  {!item.bringerUserId && isMember ?

                    <button

                      type="button"

                      className="text-xs text-dc-accent hover:underline"

                      onClick={async () => {

                        const r = await fetch(

                          `/api/v1/conventions/${key}/attendee-groups/${encodeURIComponent(g.id)}/bring-items/${encodeURIComponent(item.id)}/signup`,

                          { method: 'POST', credentials: 'include' },

                        )

                        if (r.ok) void openGroup(g.id)

                        else setErr(await readApiError(r, 'Could not sign up for item.'))

                      }}

                    >

                      + Sign up

                    </button>

                  : null}

                </div>

              ))}

              {isOwner ?

                <div className="flex flex-wrap gap-2">

                  <input

                    className="min-w-[12rem] flex-1 rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"

                    placeholder="Item to bring"

                    value={newBring}

                    onChange={(e) => setNewBring(e.target.value)}

                  />

                  <button

                    type="button"

                    className="rounded-lg bg-amber-600/90 px-3 py-1 text-sm font-semibold text-black disabled:opacity-50"

                    disabled={!newBring.trim()}

                    onClick={() => void addBringItem(g.id)}

                  >

                    Add item

                  </button>

                </div>

              : null}

            </section>

          </>

        : null}

      </div>

    )

  }



  return (

    <div className="space-y-4">

      <div className="flex flex-wrap gap-2">

        {(['discover', 'mine', 'create'] as const).map((m) => (

          <button

            key={m}

            type="button"

            onClick={() => setMode(m)}

            className={`rounded-full px-4 py-1.5 text-sm font-medium ${

              mode === m ? 'bg-amber-600/90 text-black' : 'border border-dc-border text-dc-text-muted hover:text-dc-text'

            }`}

          >

            {m === 'discover' ? 'Discover' : m === 'mine' ? 'My groups' : 'Create group'}

          </button>

        ))}

      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      {msg ? <p className="text-sm text-emerald-200">{msg}</p> : null}

      {mode === 'create' ?

        <div className="space-y-3 max-w-md">

          <input

            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"

            placeholder="Group name"

            value={createName}

            onChange={(e) => setCreateName(e.target.value)}

          />

          <textarea

            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"

            rows={3}

            placeholder="Description (optional)"

            value={createDesc}

            onChange={(e) => setCreateDesc(e.target.value)}

          />

          <button

            type="button"

            disabled={!createName.trim()}

            className="rounded-xl bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"

            onClick={() => void createGroup()}

          >

            Create group

          </button>

        </div>

      : loading ?

        <p className="text-sm text-dc-muted">Loading…</p>

      : groups.length === 0 ?

        <p className="text-sm text-dc-muted">No groups yet.</p>

      : <ul className="space-y-2">

          {groups.map((g) => (

            <li key={g.id}>

              <button

                type="button"

                className="flex w-full items-center justify-between gap-3 rounded-xl border border-dc-border bg-dc-elevated/95 px-4 py-3 text-left hover:border-dc-border-strong"

                onClick={() => void openGroup(g.id)}

              >

                <div>

                  <p className="font-medium text-dc-text">{g.name}</p>

                  <p className="text-xs text-dc-muted">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>

                </div>

                {g.recruitmentStatus === 'seeking' ?

                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Seeking</span>

                : null}

              </button>

            </li>

          ))}

        </ul>

      }

    </div>

  )

}


