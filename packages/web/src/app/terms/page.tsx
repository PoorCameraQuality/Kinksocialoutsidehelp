import LegalDraftPage from '@/components/ui/LegalDraftPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 6, 2026' : undefined

export default function TermsPage() {
  return (
    <LegalDraftPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Terms of Service"
      intro={
        legalPublished
          ? 'These Terms of Service ("Terms") are a contract between you and Kink Social ("we," "us"). They govern your access to and use of the Kink Social website, apps, and related services (the "Service"). By creating an account or using the Service, you agree to these Terms, our Community Guidelines, and policies in the Policy Hub.'
          : 'These draft Terms govern your use of Kink Social during beta. By using Kink Social you agree to follow them and our Community Guidelines. Final Terms take effect at public launch.'
      }
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Privacy policy', href: '/privacy' },
        { label: 'All policies', href: '/policies' },
      ]}
      showPoliciesHub
      sections={[
        {
          id: 'acceptance',
          title: 'Agreement',
          body: (
            <p>
              If you do not agree to these Terms or the Community Guidelines, do not use the Service. If you use Kink Social on
              behalf of an organization, you represent that you have authority to bind that organization and that the
              organization will comply with these Terms.
            </p>
          ),
        },
        {
          id: 'eligibility',
          title: 'Who may use Kink Social',
          body: (
            <>
              <p>
                The Service is for adults only. You must be at least{' '}
                <strong className="text-dc-text">18 years old</strong>, or the age of majority in your jurisdiction if
                higher, to register or participate in events listed here.
              </p>
              <p className="mt-2">
                You may not use the Service if you are barred under applicable law, if we have suspended or terminated
                your account, or if you are attempting to evade a prior ban or restriction. You are responsible for
                ensuring your use complies with local laws.
              </p>
            </>
          ),
        },
        {
          id: 'your-account',
          title: 'Accounts and security',
          body: (
            <ul>
              <li>Provide accurate registration information and keep your login credentials confidential.</li>
              <li>You are responsible for activity that occurs under your account, including actions by anyone you allow to use it.</li>
              <li>
                <strong className="text-dc-text">One natural person, one account.</strong> Do not maintain duplicate,
                throwaway, or &ldquo;alt&rdquo; accounts to evade enforcement, manipulate votes or elections, harass
                people who blocked you, or inflate your visibility.
              </li>
              <li>Do not sell, rent, transfer, or share accounts. Do not impersonate another person, organizer, vendor, or Kink Social staff.</li>
              <li>Do not register accounts using someone else&apos;s email, identity, or photos without permission.</li>
              <li>Notify us through <a href="/contact">Contact</a> if you believe your account was compromised.</li>
              <li>We may suspend or terminate accounts that violate these Terms, the Community Guidelines, or applicable law.</li>
            </ul>
          ),
        },
        {
          id: 'acceptable-use',
          title: 'Acceptable use (overview)',
          body: (
            <>
              <p>
                Kink Social is a consent-first community operating system for kink-positive events, groups, and connections. You
                may not use it to harm people, harvest sensitive data, manipulate safety systems, or treat the platform
                as a free advertising or stalking tool.
              </p>
              <p className="mt-2">
                The sections below describe common abuse patterns we prohibit. They are not exhaustive. We enforce based
                on conduct and risk, not whether a loophole exists in the wording. Detailed member conduct rules are in
                our <a href="/guidelines">Community Guidelines</a> and scoped policies in the{' '}
                <a href="/policies">Policy Hub</a>.
              </p>
            </>
          ),
        },
        {
          id: 'harm-to-people',
          title: 'Harm to people',
          body: (
            <ul>
              <li>Harassment, stalking, doxing, threats, discrimination, or retaliation against reporters or moderators.</li>
              <li>Non-consensual intimate imagery, content involving minors, or material that sexualizes minors.</li>
              <li>
                Coercion, trafficking indicators, blackmail, or using the Service to arrange non-consensual sexual
                activity, drugging, or violence.
              </li>
              <li>
                Unwelcome sexual solicitation after a no, or targeting people who cannot freely consent because of
                power imbalance, intoxication, or your moderator/organizer role.
              </li>
              <li>
                &ldquo;Missing stair&rdquo; behavior: remaining on Kink Social while known to habitually harm people online or
                in person when that conduct would violate our rules if it happened here.
              </li>
              <li>Outing, extortion, or publishing private messages, legal names, or identifying information without consent.</li>
              <li>Encouraging self-harm or suicide.</li>
            </ul>
          ),
        },
        {
          id: 'platform-integrity',
          title: 'Platform integrity and automation',
          body: (
            <ul>
              <li>
                Scraping, crawling, bulk downloading, or systematically collecting member profiles, messages, event
                rosters, or media without our written permission.
              </li>
              <li>Bots, scripts, or automated registration, messaging, RSVPing, following, or reporting except via approved APIs we explicitly authorize.</li>
              <li>Reverse engineering, probing, or attempting unauthorized access to our systems, APIs, or other users&apos; accounts.</li>
              <li>Circumventing rate limits, access controls, moderation actions, blocks, mutes, or geographic restrictions.</li>
              <li>Uploading malware, phishing links, or cryptocurrency scams.</li>
              <li>Disrupting the Service (DDoS, flooding, intentional resource exhaustion).</li>
              <li>
                Gaming reputation, trust, or discovery systems (fake engagement, coordinated inauthentic behavior,
                pay-for-connections schemes).
              </li>
              <li>Using Kink Social primarily as a redirect funnel to off-site scams, malware, or deceptive landing pages.</li>
            </ul>
          ),
        },
        {
          id: 'privacy-harvesting',
          title: 'Privacy, stalking, and data misuse',
          body: (
            <>
              <p>Kink participation is sensitive. You may not use Kink Social to:</p>
              <ul>
                <li>
                  Build dossiers on members for outing, employer harassment, custody disputes, journalism, OSINT
                  databases, or &ldquo;background check&rdquo; businesses without lawful basis and consent where
                  required.
                </li>
                <li>
                  Use discovery, groups, events, or ISO posts to track someone&apos;s location, relationships, or event
                  attendance after they blocked you or asked you to stop.
                </li>
                <li>
                  Cross-reference Kink Social profiles with off-platform data to identify real names or workplaces for harm.
                </li>
                <li>
                  Export, screenshot, or repost members-only content off-site to shame, sell, or distribute without
                  permission.
                </li>
                <li>
                  Misuse organizer, door, or group admin access to view attendance, check-in, or roster data for
                  personal stalking, marketing, or resale. See{' '}
                  <a href="/vendor-organizer-terms">Vendor &amp; Organizer Terms</a>.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'events-and-listings',
          title: 'Events, groups, and impersonation',
          body: (
            <ul>
              <li>
                Listing fake events, conventions, groups, vendors, or educators to phish, collect data, recruit for
                pyramid schemes, or mislead attendees about safety staffing or venue.
              </li>
              <li>Impersonating an organization, event, venue, vendor, educator, or Kink Social staff member.</li>
              <li>
                Using event or group tools to coordinate harassment campaigns, raids, or brigading against members or
                rival communities.
              </li>
              <li>
                Claiming Kink Social endorsement, partnership, or safety verification for your event or business when we have
                not granted it.
              </li>
              <li>
                Publishing attendee lists, door photos, or check-in information outside permitted organizer workflows.
              </li>
              <li>
                Organizers and group leaders remain responsible for their spaces. Platform listing does not mean Kink Social
                vouches for every attendee, vendor, or volunteer. See{' '}
                <a href="/policies/events">Event Guidelines</a> and <a href="/policies/groups">Group Guidelines</a>.
              </li>
            </ul>
          ),
        },
        {
          id: 'commercial-abuse',
          title: 'Commercial and spam abuse',
          body: (
            <ul>
              <li>Unsolicited bulk messaging, comment spam, or repetitive promotional posts across groups, hubs, or DMs.</li>
              <li>
                Multi-level marketing, get-rich-quick schemes, or deceptive &ldquo;mentorship&rdquo; funnels targeting
                new community members.
              </li>
              <li>
                Soliciting paid sexual services, trafficking, or illegal goods where prohibited by law or our policies.
              </li>
              <li>
                Fake vendor shops, counterfeit goods, or importing Etsy/Shopify listings that violate our content rules.
              </li>
              <li>
                Charging for access to Kink Social features we provide free (for example, selling invite codes or fake
                &ldquo;verified&rdquo; badges we do not offer).
              </li>
              <li>
                Payment processing is not enabled in beta. Do not use Kink Social to run in-platform checkout, ticket fraud, or
                chargeback scams until we launch authorized payment features.
              </li>
            </ul>
          ),
        },
        {
          id: 'safety-system-abuse',
          title: 'Abuse of safety and legal processes',
          body: (
            <ul>
              <li>
                False or bad-faith reports to harass someone, waste moderator time, or trigger emergency workflows
                against innocent members.
              </li>
              <li>Submitting fraudulent DMCA notices or counter-notices. See <a href="/dmca">DMCA policy</a>.</li>
              <li>Impersonating law enforcement, lawyers, or Kink Social trust &amp; safety staff.</li>
              <li>
                &ldquo;Complaint shopping&rdquo; (repeatedly submitting the same issue to different admins hoping for a
                preferred outcome) or pressuring volunteers for special treatment.
              </li>
              <li>
                Abusing export, deletion, or contact intake systems to burden the platform ( repetitive automated
                requests, abusive content in legal forms).
              </li>
              <li>
                Confirmed abuse of moderator or admin powers is permanent ban with no appeal under our{' '}
                <a href="/policies/moderator-code-of-conduct">Moderator Code of Conduct</a>.
              </li>
            </ul>
          ),
        },
        {
          id: 'content-standards',
          title: 'Content you post',
          body: (
            <ul>
              <li>Post only material you have the right to share. Do not infringe copyright or trademarks.</li>
              <li>Do not post content you do not have consent to share, including photos from play parties or events.</li>
              <li>Explicit visual media uploads are disabled in beta unless we publish otherwise.</li>
              <li>
                Do not use educational or presenter status to launder harmful conduct or to target vulnerable newcomers.
              </li>
            </ul>
          ),
        },
        {
          id: 'events-organizers',
          title: 'Events and organizers',
          body: (
            <>
              <p>
                Event and group organizers are responsible for their listings, venue relationships, attendee
                communications, and on-site conduct rules. Kink Social provides software tools. We do not guarantee event
                quality, safety, attendance, or third-party venue compliance.
              </p>
              <p className="mt-2">
                Offline meetings, play, and travel to events are at your own risk. Use informed consent, negotiate
                boundaries, and follow venue and organizer rules. Kink Social is not a party to private agreements between
                members.
              </p>
              <p className="mt-2">
                Organizers, vendors, and presenters accept additional obligations in our{' '}
                <a href="/vendor-organizer-terms">Vendor &amp; Organizer Terms</a>.
              </p>
            </>
          ),
        },
        {
          id: 'content-ip',
          title: 'Your content and our license',
          body: (
            <>
              <p>
                You retain ownership of content you post. By posting content on Kink Social, you grant us a non-exclusive,
                worldwide, royalty-free license to host, store, reproduce, display, and distribute that content solely
                to operate and improve the Service, enforce our policies, and comply with law. This license ends when
                content is permanently deleted from active systems, except where retention is required by law, safety
                investigation, legal hold, or short-lived encrypted backups.
              </p>
              <ul>
                <li>Kink Social branding, software, and design remain our property or our licensors&apos; property.</li>
                <li>We may remove content that violates these Terms or creates risk, with or without notice where urgent.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'no-endorsement',
          title: 'No endorsement',
          body: (
            <p>
              Reference to a person, group, event, vendor, or educator on Kink Social does not mean we endorse their conduct,
              skill, safety practices, or off-platform behavior. Members must exercise their own judgment. Organizers
              and vendors speak for themselves unless we explicitly say otherwise in writing.
            </p>
          ),
        },
        {
          id: 'termination',
          title: 'Suspension and termination',
          body: (
            <>
              <p>
                You may stop using the Service at any time. You may request account deletion through Settings or our
                Contact form, subject to our <a href="/privacy">Privacy Policy</a>, auto-shred settings, and any legal
                holds.
              </p>
              <p className="mt-2">
                We may suspend or terminate access, remove content, restrict features, revoke organizer or moderator
                permissions, or device-ban if we reasonably believe you violated these Terms, created risk, evaded
                enforcement, or where required by law. We may act without prior notice when delay would cause harm.
              </p>
              <p className="mt-2">
                Where appropriate, we provide notice and an appeal path described in our{' '}
                <a href="/policies/appeals">Appeals policy</a>.{' '}
                <strong className="text-dc-text">No appeal is available</strong> for confirmed moderator or admin power
                abuse, ban evasion, trafficking or CSAM-related enforcement, or other zero-tolerance categories we
                publish in the Policy Hub.
              </p>
            </>
          ),
        },
        {
          id: 'disclaimers',
          title: 'Disclaimers',
          body: (
            <>
              <p>
                THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE FULLEST EXTENT
                PERMITTED BY LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION.
              </p>
              <p className="mt-2">
                We do not guarantee that every harmful user will be caught before they cause damage, that every report
                will be resolved instantly, or that offline conduct will be visible to us. We use human review and
                technical tools in good faith.
              </p>
            </>
          ),
        },
        {
          id: 'liability',
          title: 'Limitation of liability',
          body: (
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, Kink Social AND ITS OPERATORS, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT
              BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA,
              OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE OR OFFLINE INTERACTIONS WITH OTHER MEMBERS OR
              ORGANIZERS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF (A) USD
              $100 OR (B) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM, IF ANY. SOME
              JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO THESE MAY NOT APPLY TO YOU.
            </p>
          ),
        },
        {
          id: 'indemnity',
          title: 'Indemnification',
          body: (
            <p>
              You will defend, indemnify, and hold harmless Kink Social and its operators from claims, damages, losses, and
              expenses (including reasonable legal fees) arising from your content, your use of the Service, your
              violation of these Terms, your organization&apos;s events or listings, or your violation of others&apos;
              rights.
            </p>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to these Terms',
          body: (
            <p>
              We may update these Terms. Material changes will be communicated through the Service or by email where
              appropriate. The &ldquo;Last updated&rdquo; date shows the current version. If you keep using Kink Social after
              changes take effect, you accept the revised Terms.
            </p>
          ),
        },
        {
          id: 'law',
          title: 'Governing law',
          body: (
            <p>
              These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law
              rules, except where mandatory consumer protection laws in your home jurisdiction apply. Venue for disputes
              will be specified in a final published version after counsel review. This beta draft is not legal advice.
            </p>
          ),
        },
        {
          id: 'contact',
          title: 'Contact',
          body: (
            <p>
              Questions about these Terms? Use our <a href="/contact?topic=legal">Contact form</a> or visit{' '}
              <a href="/support">Support</a> for safety reports.
            </p>
          ),
        },
      ]}
    />
  )
}
