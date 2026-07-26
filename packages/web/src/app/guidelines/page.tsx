import LegalDraftPage from '@/components/ui/LegalDraftPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'

const listClass = 'list-disc pl-5 space-y-2'

export default function GuidelinesPage() {
  return (
    <LegalDraftPage
      published={legalPublished}
      effectiveDate={legalPublished ? 'May 28, 2026' : undefined}
      lastUpdated={legalPublished ? 'June 10, 2026' : undefined}
      title="Community Guidelines"
      intro={
        <>
          <p>
            These guidelines explain how members are expected to treat each other on kink.social
            {legalPublished ? '.' : ' during beta.'}
          </p>
          <p>
            <strong className="text-dc-text">The short version is simple:</strong>
          </p>
          <p>
            Consent comes first. Respect privacy. Do not harass people. Do not out people. Do not use this platform to
            pressure, exploit, threaten, scam, or harm anyone.
          </p>
          {!legalPublished ?
            <p>Final guidelines may be updated before public launch.</p>
          : null}
        </>
      }
      relatedLinks={[
        { label: 'Support & safety', href: '/support' },
        { label: 'Terms of service', href: '/terms' },
        { label: 'All policies', href: '/policies' },
      ]}
      sections={[
        {
          id: 'values',
          title: 'Our values',
          body: (
            <>
              <p>kink.social is built around a few core expectations:</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-semibold text-dc-text">Consent first</p>
                  <p className="mt-1">
                    Consent must be informed, negotiated, specific, and freely given. It can be changed or withdrawn at
                    any time.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-dc-text">Respect for people and boundaries</p>
                  <p className="mt-1">
                    Respect people&apos;s names, pronouns, identities, relationships, limits, privacy, and dignity.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-dc-text">Community care</p>
                  <p className="mt-1">
                    If something feels unsafe, coercive, predatory, or out of bounds, report it early.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-dc-text">Organizer accountability</p>
                  <p className="mt-1">
                    Groups, events, and organizations are expected to publish clear rules and enforce them fairly.
                  </p>
                </div>
              </div>
            </>
          ),
        },
        {
          id: 'consent',
          title: 'Consent and boundaries',
          body: (
            <>
              <p>Consent is ongoing. A yes today is not a yes tomorrow. A yes to one thing is not a yes to everything.</p>
              <p className="mt-3">
                Do not pressure anyone into play, messages, photos, contact information, meetups, sexual conversation, or
                sharing content.
              </p>
              <p className="mt-3">
                Negotiate clearly before scenes, photography, recording, public tagging, or contact exchange. Respect
                safewords, hard limits, soft limits, and withdrawn consent without arguing, punishing, or retaliating.
              </p>
              <p className="mt-3">Anything less than clear enthusiasm should be treated as a no.</p>
            </>
          ),
        },
        {
          id: 'adults',
          title: 'Adults only',
          body: (
            <p>
              kink.social is for adults only. You must be 18 or older to use this platform. Do not solicit, groom,
              sexualize, involve, or share content involving minors. Violations may result in immediate removal and may
              be reported to the appropriate authorities. See our{' '}
              <a href="/minor-safety">Minor Safety</a> policy.
            </p>
          ),
        },
        {
          id: 'harassment',
          title: 'Harassment and discrimination',
          body: (
            <>
              <p>We expect members to interact with basic kindness, compassion, and good faith.</p>
              <p className="mt-3">The following behavior is not allowed:</p>
              <ul className={listClass}>
                <li>Harassment, threats, intimidation, stalking, or targeted abuse.</li>
                <li>
                  Bigotry or insults targeting race, religion, gender, gender identity, gender expression, sexual
                  orientation, disability, mental health, neurodiversity, STI status, kink identity, body size, physical
                  appearance, or other protected or personal characteristics.
                </li>
                <li>Deliberate misgendering, deadnaming, or using a name someone has asked you not to use.</li>
                <li>Threats of non-consensual violence.</li>
                <li>Encouraging self-harm.</li>
                <li>
                  Repeated sexual advances, play requests, flirting, or pressure after someone says no, avoids the
                  question, gives a lukewarm answer, or asks you to stop.
                </li>
                <li>Contacting someone one-on-one after they asked you not to.</li>
                <li>Using alternate accounts to bypass blocks, bans, or restrictions.</li>
                <li>Repeated mentions, pings, tags, or notifications after someone asks you to stop.</li>
                <li>
                  Publishing private messages, private photos, legal names, phone numbers, addresses, email addresses,
                  workplace details, or other identifying information without consent.
                </li>
                <li>Sharing screenshots or posts meant to shame, mock, expose, or rally harassment against a member.</li>
                <li>Dogpiling, brigading, or organizing people to target someone.</li>
                <li>
                  Retaliating against anyone for setting boundaries, blocking, reporting, or cooperating with a safety
                  review.
                </li>
              </ul>
              <p className="mt-3">
                Criticism of organizations, venues, events, public policies, or public-facing organizer decisions is
                allowed when it is shared in good faith and does not target a private person for harassment.
              </p>
            </>
          ),
        },
        {
          id: 'privacy',
          title: 'Privacy and confidentiality',
          body: (
            <>
              <p>Privacy matters in kink spaces.</p>
              <p className="mt-3">
                Do not share private messages, photos, attendee lists, group content, or member-only discussions outside
                their intended context.
              </p>
              <p className="mt-3">
                Do not repost another member&apos;s kink.social content off-site without permission.
              </p>
              <p className="mt-3">
                Ask before tagging someone in kink-related content, event photos, group posts, or public conversations.
              </p>
              <p className="mt-3">
                Respect closed groups, vetted spaces, private event hubs, and members-only channels. Content from those
                spaces should stay there unless the rules clearly allow sharing.
              </p>
              <p className="mt-3">
                Also remember that no online platform can make privacy perfect. People can take screenshots, copy text,
                save files, or use insecure devices. Be careful with information that could harm you or someone else if
                it became public.
              </p>
            </>
          ),
        },
        {
          id: 'bad-faith',
          title: 'Bad-faith behavior and ban evasion',
          body: (
            <>
              <p>Rules cannot cover every possible situation.</p>
              <p className="mt-3">
                If someone repeatedly pushes boundaries, looks for loopholes, derails conversations on purpose, makes
                interaction miserable, or uses new accounts to avoid enforcement, they may be restricted or removed.
              </p>
              <p className="mt-3">If you are unsure whether your behavior crosses a line, ask a moderator before continuing.</p>
              <p className="mt-3">Returning under a new account after a ban may result in removal when discovered.</p>
            </>
          ),
        },
        {
          id: 'hard-topics',
          title: 'Hard topics and content warnings',
          body: (
            <>
              <p>Heavy subjects can be discussed when handled with care.</p>
              <p className="mt-3">
                Use a content warning before detailed discussion of abuse, self-harm, graphic violence, coercion,
                trauma, or other topics that could reasonably distress people who did not consent to engage with that
                material.
              </p>
              <p className="mt-3">
                There is no perfect list of topics that need a warning. Use empathy. If someone asks you to add a warning
                or conceal details behind a spoiler-style control, edit the post rather than debating their trauma.
              </p>
            </>
          ),
        },
        {
          id: 'off-platform',
          title: 'Off-platform conduct and community safety',
          body: (
            <>
              <p>
                kink.social connects people who may also meet at events, in private spaces, and on other platforms.
              </p>
              <p className="mt-3">
                If someone&apos;s behavior online or in person creates a serious safety concern, you may report it to
                platform Trust and Safety. Share only what you can share safely.
              </p>
              <p className="mt-3">
                kink.social is not law enforcement, a court, or a clinical service. Depending on the situation, we may
                review reports, watch-list accounts, warn members, restrict features, remove content, suspend accounts,
                or ban accounts.
              </p>
              <p className="mt-3">
                We will not publish a victim&apos;s identity or private details without their affirmative consent.
              </p>
              <p className="mt-3">
                Truthful personal experience may be shared when it is safety-relevant. Harassment campaigns, revenge
                posts, rumor threads, and gossip about non-safety disputes are not protected here.
              </p>
            </>
          ),
        },
        {
          id: 'events',
          title: 'Event conduct',
          body: (
            <>
              <p>
                Events listed on kink.social are run by independent organizers unless clearly stated otherwise. Each
                organizer is responsible for their own event rules, venue policies, staffing, safety procedures, and
                on-site enforcement.
              </p>
              <p className="mt-3">When attending events listed on kink.social:</p>
              <ul className={listClass}>
                <li>Follow organizer rules, venue rules, dress codes, and consent policies.</li>
                <li>Listen to dungeon monitors, door staff, hosts, presenters, and event safety staff.</li>
                <li>No means no. That applies at the door, on the floor, in classes, in messages, and after the event.</li>
                <li>If immediate help is needed at an event, contact event staff first.</li>
                <li>If there is urgent danger, contact local emergency services.</li>
                <li>
                  After the immediate situation is safe, use kink.social reporting tools when platform action may be
                  needed.
                </li>
              </ul>
              <p className="mt-3">
                kink.social cannot control everything that happens at independently run events. However, members can
                review events, groups, and organizations so the community has more information when deciding where to
                spend their time, money, trust, and energy.
              </p>
              <p className="mt-3">
                Reviews must be truthful, safety-relevant, and written in good faith. Do not use reviews to harass,
                shame, threaten, expose private information, or organize retaliation.
              </p>
              <p className="mt-3">
                kink.social may restrict, remove, or refuse access to members, groups, organizations, or event listings
                when there is a serious and verifiable safety concern. This may include someone appearing on a public sex
                offender registry or having a public conviction related to sexual violence, coercion, exploitation,
                abuse, or another offense that creates an unnecessary safety risk for members.
              </p>
              <p className="mt-3">
                Reports based on rumor, personal conflict, or unverifiable claims may still be reviewed, but enforcement
                decisions require context. kink.social will not host harassment campaigns, revenge posts, or public
                callouts that expose private information.
              </p>
            </>
          ),
        },
        {
          id: 'content',
          title: 'Content standards',
          body: (
            <>
              <p>The following are allowed when shared with context, consent, and respect:</p>
              <ul className={listClass}>
                <li>Educational kink content.</li>
                <li>Good-faith discussion.</li>
                <li>Event promotion that follows platform and organizer rules.</li>
                <li>Group posts that follow group rules and platform rules.</li>
                <li>Safety-relevant personal experience.</li>
                <li>
                  Adult creator discussion, sex worker safety discussion, labor rights discussion, and personal identity
                  as an adult creator or sex worker.
                </li>
              </ul>
              <p className="mt-3">
                kink.social supports sex workers as members of the community. We do not shame, exclude, or punish people
                for being sex workers, adult creators, dancers, performers, educators, professional companions, or anyone
                else working in adult spaces.
              </p>
              <p className="mt-3">
                However, kink.social is not a booking platform, escort directory, client marketplace, or payment
                processor. Because we are a U.S.-based platform, members may not use kink.social to solicit, arrange,
                broker, advertise, negotiate, or facilitate paid sexual services.
              </p>
              <p className="mt-3">The following are not allowed:</p>
              <ul className={listClass}>
                <li>Non-consensual intimate imagery.</li>
                <li>Content sexualizing minors or appearing to involve minors.</li>
                <li>Content that promotes coercion, trafficking, exploitation, or abuse.</li>
                <li>
                  Soliciting, arranging, brokering, advertising, or negotiating sex acts in exchange for money, goods,
                  services, housing, access, gifts, substances, or anything else of value.
                </li>
                <li>
                  Posting rates, menus, availability, incall or outcall details, client screening instructions, booking
                  instructions, or coded language meant to arrange paid sexual services.
                </li>
                <li>
                  Using profiles, groups, events, posts, comments, or DMs to connect buyers and sellers of paid sexual
                  services.
                </li>
                <li>Offering or arranging illegal drugs, weapons, stolen goods, or prohibited items.</li>
                <li>
                  Impersonating kink.social staff, moderators, organizers, door staff, vendors, educators, performers,
                  or other members.
                </li>
                <li>Spam, scams, deceptive event listings, fake profiles, or profiles created mainly to funnel members into unsafe or misleading off-site services.</li>
              </ul>
              <p className="mt-3">
                Members may link to lawful off-platform adult creator pages, such as fan platforms, clip stores, personal
                websites, or other adult content pages, as long as those links are not used to arrange paid sexual
                services through kink.social.
              </p>
              <p className="mt-3">Allowed examples include:</p>
              <ul className={listClass}>
                <li>&ldquo;I am an adult creator.&rdquo;</li>
                <li>&ldquo;I do sex work safety education.&rdquo;</li>
                <li>&ldquo;Here is my off-platform adult content page.&rdquo;</li>
                <li>&ldquo;I support sex worker rights and harm reduction.&rdquo;</li>
                <li>&ldquo;I am teaching a class about online safety for adult creators.&rdquo;</li>
              </ul>
              <p className="mt-3">Not allowed examples include:</p>
              <ul className={listClass}>
                <li>&ldquo;Message me for rates.&rdquo;</li>
                <li>&ldquo;DM to book.&rdquo;</li>
                <li>&ldquo;Available tonight.&rdquo;</li>
                <li>&ldquo;Looking for clients.&rdquo;</li>
                <li>&ldquo;Cash or gifts for play.&rdquo;</li>
                <li>&ldquo;Screening required before session.&rdquo;</li>
                <li>&ldquo;Here is my menu.&rdquo;</li>
                <li>&ldquo;Contact me here to arrange services.&rdquo;</li>
              </ul>
              <p className="mt-3">
                kink.social may remove content, restrict accounts, or disable links when content appears to facilitate
                paid sexual services, trafficking, coercion, exploitation, scams, or other legal or safety risks.
              </p>
              <p className="mt-3">
                Explicit media uploads are disabled during beta. See our{' '}
                <a href="/adult-content-consent">Adult Content and Consent</a> policy.
              </p>
            </>
          ),
        },
        {
          id: 'reporting',
          title: 'Reporting safety concerns',
          body: (
            <>
              <p>Use the report tools on profiles, posts, groups, events, and messages whenever available.</p>
              <p className="mt-3">For urgent offline danger, contact local emergency services first.</p>
              <p className="mt-3">Use the appropriate policy pages when needed:</p>
              <ul className={listClass}>
                <li>
                  Copyright claims should use the <a href="/dmca">DMCA</a> process.
                </li>
                <li>
                  Non-consensual intimate imagery should use the <a href="/ncii">NCII</a> process.
                </li>
                <li>
                  Minor safety concerns should use the <a href="/minor-safety">Minor Safety</a> process.
                </li>
                <li>
                  Appeals and escalations should use <a href="/support">Support</a> and{' '}
                  <a href="/policies/appeals">Appeals</a>.
                </li>
              </ul>
              <p className="mt-3">
                If your concern is about a moderator, report it to platform Trust and Safety or to an admin who is not
                involved in the issue. See our{' '}
                <a href="/policies/moderator-code-of-conduct">Moderator Code of Conduct</a>.
              </p>
              <p className="mt-3">Do not send the same report to multiple admins hoping for a different answer.</p>
              <p className="mt-3">
                You may also reach us through <a href="/contact">Contact</a> when you need help finding the right path.
              </p>
            </>
          ),
        },
        {
          id: 'enforcement',
          title: 'Enforcement',
          body: (
            <>
              <p>Moderators and organizers may take action when behavior violates these guidelines or makes a space unsafe.</p>
              <p className="mt-3">Possible actions include:</p>
              <ul className={listClass}>
                <li>Removing content.</li>
                <li>Adding warnings or notices.</li>
                <li>Limiting features.</li>
                <li>Restricting messages or visibility.</li>
                <li>Removing someone from a group or event hub.</li>
                <li>Temporarily suspending an account.</li>
                <li>Permanently banning an account.</li>
              </ul>
              <p className="mt-3">Serious violations may result in immediate removal.</p>
              <p className="mt-3">Repeated smaller violations may also lead to restrictions or removal.</p>
              <p className="mt-3">
                AI tools may help summarize reports for human review. Moderation decisions are made by people, not by
                fully automated systems.
              </p>
              <p className="mt-3">
                Moderators who abuse their tools may lose moderator access or be removed from the platform.
              </p>
            </>
          ),
        },
        {
          id: 'questions',
          title: 'Questions',
          body: (
            <>
              <p>Unsure whether something is allowed?</p>
              <p className="mt-3">
                Ask an organizer, moderator, or kink.social support before posting. Visit{' '}
                <a href="/support">Support</a> or <a href="/contact">Contact</a> if you need help.
              </p>
              <p className="mt-3">When in doubt, choose the option that protects consent, privacy, and community safety.</p>
            </>
          ),
        },
      ]}
    />
  )
}
