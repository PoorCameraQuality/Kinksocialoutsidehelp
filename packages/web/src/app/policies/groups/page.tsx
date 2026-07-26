import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function GroupGuidelinesPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Group Guidelines"
      intro="Groups on Kink Social are member-led spaces with their own rule sets. Leaders and moderators enforce those rules. Certain harms must always be escalated to platform trust and safety."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Moderator code of conduct', href: '/policies/moderator-code-of-conduct' },
        { label: 'Event guidelines', href: '/policies/events' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              Each group may publish expectations for posting, events, and membership. Local moderation handles most
              disputes. Kink Social provides the platform, reporting tools, and escalation paths for
              severe or cross-community harm.
            </p>
            <p className="mt-2">
              Groups are in charge of policing themselves. Only start or lead a group if you are willing to take
              responsibility for the content posted inside it. You are expected to moderate and monitor your space
              actively.
            </p>
          </>
        ),
        notAllowed: (
          <>
            <ul>
              <li>
                Content or conduct prohibited by the{' '}
                <a href="/guidelines">Community Guidelines</a>, including harassment and non-consensual imagery.
              </li>
              <li>
                Sexual content involving or appearing to involve minors. Zero tolerance. We escalate immediately to
                platform trust and safety.
              </li>
              <li>
                Sharing private group content with people outside the group or bypassing privacy settings, except when
                your group rules allow promoting or coordinating events on Kink Social itself.
              </li>
              <li>Using group leadership to coerce play, photos, or personal data from members.</li>
              <li>Doxing, credible threats, trafficking indicators, or abuse of leadership power.</li>
            </ul>
            <p className="mt-2 text-sm text-dc-text-muted">
              This list is not all-encompassing. Group and platform moderators may act on other harmful conduct on a
              case-by-case basis.
            </p>
          </>
        ),
        allowed: (
          <ul>
            <li>Topic-focused discussion and event coordination.</li>
            <li>Vetted membership criteria published up front so members know what they are joining.</li>
            <li>
              Removing off-topic spam or repeated boundary violations after fair warning, when your published group
              rules allow it.
            </li>
            <li>
              Setting age, location, or experience requirements that comply with platform Terms and
              anti-discrimination law.
            </li>
          </ul>
        ),
        howToReport: (
          <ul>
            <li>Use in-product reporting on posts, profiles, or messages within the group.</li>
            <li>Notify group moderators for rule violations that are local to the group.</li>
            <li>
              For minors, NCII, doxing, threats, or trafficking concerns, also report via{' '}
              <a href="/support">Support</a> so platform trust &amp; safety can act.
            </li>
          </ul>
        ),
        whoCanReport: (
          <p>
            Group members, moderators, and affected non-members (for example, targeted harassment) may report. Organizers
            of linked events may report cross-posted harm.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>
              Group moderators may warn, remove content, or remove someone from the group. Platform staff may take
              account-level action when policies require. Severe cases may suspend accounts pending investigation.
            </p>
            <p className="mt-2">
              Repeated or serious violations can result in a ban on the group owner&apos;s account and disbanding of the
              group entirely.
            </p>
          </>
        ),
        escalation: (
          <p>
            Always escalate to platform level: suspected minors (<a href="/minor-safety">Minor Safety</a>), NCII (
            <a href="/ncii">NCII Policy</a>), doxing, credible violence, trafficking signals, and moderator misconduct
            (<a href="/policies/moderator-code-of-conduct">Moderator Code</a>).
          </p>
        ),
        additionalSections: [
          {
            id: 'local-moderation',
            title: 'How group moderation should work',
            body: (
              <>
                <p>Group moderators keep the space useful, safe, and pleasant. In practice:</p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <strong className="text-dc-text">De-escalate first.</strong> Use words before tools when you can do
                    so safely. Remove content or restrict members when behavior persists or is egregious.
                  </li>
                  <li>
                    <strong className="text-dc-text">Emergency action.</strong> If someone is actively harming others,
                    a moderator may restrict them immediately, then notify fellow mods and document what happened for
                    review.
                  </li>
                  <li>
                    <strong className="text-dc-text">Document decisions.</strong> Brief factual notes help future mods
                    and platform staff understand context. Link to the post or message when possible.
                  </li>
                  <li>
                    <strong className="text-dc-text">Confidentiality.</strong> Moderator discussions about members stay
                    within the mod team unless the member consents to broader sharing or platform escalation requires it.
                  </li>
                  <li>
                    <strong className="text-dc-text">Disagreement.</strong> If mods disagree on a course of action,
                    escalate to the group owner or platform trust &amp; safety rather than fighting in public threads.
                  </li>
                  <li>
                    <strong className="text-dc-text">Member requests.</strong> Members may ask why they were restricted.
                    Explaining is a courtesy, not an obligation to debate. Disputes go through{' '}
                    <a href="/policies/appeals">Appeals</a> or platform reporting, not endless DM arguments with volunteers.
                  </li>
                </ul>
                <p className="mt-2 text-sm text-dc-muted">
                  Group moderators agree to the{' '}
                  <a href="/policies/moderator-code-of-conduct">Moderator Code of Conduct</a>, including one-strike
                  power abuse enforcement at the platform level.
                </p>
              </>
            ),
          },
          {
            id: 'inactive-owner',
            title: 'Inactive group owners',
            body: (
              <p>
                If a group owner has been offline or inactive for more than six months, leadership of the group may be
                put to a vote by its members. Kink Social may open a steward election so the community can choose new leadership
                rather than leaving the group unmanaged.
              </p>
            ),
          },
        ],
      }}
    />
  )
}
