import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 5, 2026' : undefined

export default function EventGuidelinesPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Event Guidelines"
      intro="If your event is listed on Kink Social, you are expected to run a consent-first, safety-minded gathering with real on-site staffing. Kink Social gives organizers tools. Listing here is not an endorsement that your event is safe or well run."
      relatedLinks={[
        { label: 'Vendor & organizer terms', href: '/vendor-organizer-terms' },
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Group guidelines', href: '/policies/groups' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              Being on Kink Social means you agree to prioritize informed consent, attendee safety, and clear accountability for
              what happens at your door and on your floor. That applies to how you promote the event online and how you
              run it in person.
            </p>
            <p className="mt-2">
              Kink Social provides registration, check-in, messaging, and reporting tools to help organizers operate. Those tools
              do not replace dungeon monitors, safety leads, venue staff, or your own event policies. We do not guarantee
              that any listed event is safe, well staffed, or suitable for any particular attendee.
            </p>
          </>
        ),
        notAllowed: (
          <ul>
            <li>Events that admit or target minors. All attendees must be 18+ unless a specific licensed exception is documented and approved.</li>
            <li>Listing or promoting an event without adequate on-site safety staffing for the activities you advertise.</li>
            <li>Promotion that misrepresents consent requirements, dungeon monitor coverage, photography rules, or accessibility.</li>
            <li>Retaliating against attendees who use safewords, leave scenes, or report incidents.</li>
            <li>Using door lists, check-in data, or attendee information for harassment or off-event contact without consent.</li>
            <li>Repeated consent violations, ignored safety reports, or a pattern of harmful conduct tied to your events or organization.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Published codes of conduct, dress codes, and photography policies shared before the event and at the door.</li>
            <li>Dungeon monitors or equivalent staff with clear authority to stop scenes for safety.</li>
            <li>Designated safety contacts who are reachable during the event and named in your listing or door materials.</li>
            <li>ID verification and wristband systems appropriate to the event tier and local law.</li>
            <li>Educational programming with negotiated demo boundaries announced to attendees.</li>
            <li>Honest promotion. Say what you will enforce and staff for it on site.</li>
          </ul>
        ),
        howToReport: (
          <ul>
            <li>
              <strong className="text-dc-text">On site:</strong> find event staff, dungeon monitors, or designated safety
              contacts first when you need immediate help.
            </li>
            <li>
              <strong className="text-dc-text">On platform:</strong> attendees at events listed on Kink Social may escalate
              event-specific issues through in-product reporting,{' '}
              <a href="/support">Support</a>, or our{' '}
              <a href="/contact?topic=legal">Contact form</a>. Include the event name, date, and what happened.
            </li>
            <li>For emergencies, contact local emergency services before filing a platform report.</li>
          </ul>
        ),
        whoCanReport: (
          <p>
            Attendees, staff, vendors, and witnesses may report event-related harm. You do not need to be a Kink Social member to
            raise a serious safety concern about a listed event. Organizers of multi-day conventions should publish a
            reachable safety contact.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>
              Organizers should investigate on-site incidents using their published process. When platform trust &amp;
              safety receives event-specific reports, we review them in context. We may contact the organizer, restrict
              promotion, pause organizer tools, or take action on accounts tied to the event.
            </p>
            <p className="mt-2">
              If consent violations, safety failures, or other serious problems keep showing up at your events, Kink Social may
              remove event listings, suspend organizer access, or disband or remove the hosting organization from the
              platform. One bad incident can trigger review. A pattern can end your ability to list on Kink Social.
            </p>
          </>
        ),
        escalation: (
          <p>
            Suspected minors, sexual assault, NCII captured at events, or weapons threats require immediate platform
            escalation and may involve law enforcement. See <a href="/minor-safety">Minor Safety</a>,{' '}
            <a href="/ncii">NCII Policy</a>, and{' '}
            <a href="/law-enforcement">Law Enforcement Guidelines</a>.
          </p>
        ),
        additionalSections: [
          {
            id: 'not-an-endorsement',
            title: 'Listing is not an endorsement',
            body: (
              <p>
                Appearance on Kink Social does not mean Kink Social vouches for an organizer, venue, or event. Attendees
                are responsible for their own choices. Read event policies, ask questions before you attend, and use
                safewords, boundaries, and reporting tools when something is wrong.
              </p>
            ),
          },
        ],
      }}
    />
  )
}
