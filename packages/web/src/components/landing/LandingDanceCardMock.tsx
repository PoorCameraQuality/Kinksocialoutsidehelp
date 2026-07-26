/** Decorative Dance Card dashboard preview — not functional. */
export default function LandingDanceCardMock() {
  return (
    <div className="dashboard-mock" aria-hidden>
      <div className="flex min-h-[280px]">
        <aside className="hidden w-36 shrink-0 border-r border-white/10 bg-[#0c0d0f] p-3 sm:block">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--pub-gold-bright)]">
            Dance Card
          </p>
          <ul className="space-y-1.5 text-[11px] text-[var(--pub-text-soft)]">
            {['Overview', 'Events', 'Roster', 'Check-in', 'Schedule', 'Reports', 'Settings'].map((item, i) => (
              <li
                key={item}
                className={`rounded-md px-2 py-1 ${i === 0 ? 'bg-white/8 text-[var(--pub-text)]' : ''}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 flex-1 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Upcoming Events', value: '12' },
              { label: 'Checked In', value: '248' },
              { label: 'Attendees', value: '1,034' },
              { label: 'Active Members', value: '812' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-[10px] text-[var(--pub-text-soft)]">{stat.label}</p>
                <p className="text-lg font-bold text-[var(--pub-text)]">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] font-semibold text-[var(--pub-text-muted)]">Check-in activity</p>
            <svg className="mt-2 h-16 w-full" viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden>
              <polyline
                fill="none"
                stroke="rgba(216,173,54,0.7)"
                strokeWidth="2"
                points="0,40 30,35 60,28 90,32 120,18 150,22 180,10 200,14"
              />
            </svg>
          </div>
          <ul className="mt-3 space-y-2">
            {['Spring Munch — Sat 7 PM', 'Rope 101 — Sun 2 PM', 'Dungeon Night — Fri 8 PM'].map((ev) => (
              <li
                key={ev}
                className="flex items-center justify-between rounded-md border border-white/8 px-2 py-1.5 text-[11px]"
              >
                <span className="text-[var(--pub-text-muted)]">{ev}</span>
                <span className="text-[var(--pub-gold-bright)]">→</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
