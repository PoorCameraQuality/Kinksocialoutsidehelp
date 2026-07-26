import LegalDraftPage from '@/components/ui/LegalDraftPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'

const listClass = 'list-disc pl-5 space-y-2'
const subheadingClass = 'text-base font-semibold text-dc-text mt-5 mb-2'

export default function PrivacyPage() {
  return (
    <LegalDraftPage
      published={legalPublished}
      effectiveDate={legalPublished ? 'May 28, 2026' : undefined}
      lastUpdated={legalPublished ? 'June 10, 2026' : undefined}
      title="Privacy Policy"
      intro={
        <>
          <p>
            This Privacy Policy explains what information kink.social collects, how we use it, when we share it, and
            what choices members have.
          </p>
          {!legalPublished ?
            <p>
              During beta, some details may change as the product, safety tools, and legal policies are finalized. The
              final public launch version will be published before launch.
            </p>
          : null}
        </>
      }
      relatedLinks={[
        { label: 'Contact', href: '/contact?topic=privacy' },
        { label: 'Support', href: '/support' },
        { label: 'Community guidelines', href: '/guidelines' },
      ]}
      sections={[
        {
          id: 'overview',
          title: 'Overview',
          body: (
            <>
              <p>
                kink.social is a community platform for kink-positive events, groups, organizations, and connections.
              </p>
              <p className="mt-3">
                We collect only what we reasonably need to operate the service, keep communities safer, prevent abuse,
                support organizers, and improve the product.
              </p>
              <p className="mt-3">We do not sell your personal information.</p>
              <p className="mt-3">We do not use your personal information to build third-party advertising profiles.</p>
            </>
          ),
        },
        {
          id: 'controller',
          title: 'Who is responsible',
          body: (
            <>
              <p>kink.social is responsible for the personal information described in this policy.</p>
              <p className="mt-3">
                Operator contact details for privacy requests will be published before public launch. During beta, use
                the <a href="/contact?topic=privacy">Contact</a> form for privacy questions, account requests, or safety
                concerns.
              </p>
            </>
          ),
        },
        {
          id: 'data-collection',
          title: 'Information we collect',
          body: (
            <>
              <p>Depending on how you use kink.social, we may collect the following information.</p>

              <h3 className={subheadingClass}>Account information</h3>
              <p>This may include:</p>
              <ul className={listClass}>
                <li>Email address.</li>
                <li>Username.</li>
                <li>Display name.</li>
                <li>Password hash.</li>
                <li>Account settings.</li>
                <li>Profile details you choose to share.</li>
              </ul>
              <p className="mt-3">
                We do not store plain text passwords. Passwords are hashed using a secure password hashing process.
              </p>

              <h3 className={subheadingClass}>Profile and community activity</h3>
              <p>This may include:</p>
              <ul className={listClass}>
                <li>Profile content.</li>
                <li>Posts, comments, and forum activity.</li>
                <li>Group membership.</li>
                <li>Event RSVPs.</li>
                <li>Event registration or check-in records.</li>
                <li>Organization actions tied to your account.</li>
                <li>Reports you submit.</li>
                <li>Reports submitted about you.</li>
                <li>Moderation decisions and safety outcomes.</li>
              </ul>

              <h3 className={subheadingClass}>Messages and communications</h3>
              <p>This may include:</p>
              <ul className={listClass}>
                <li>Direct messages sent through kink.social.</li>
                <li>Group or event hub messages.</li>
                <li>Messages sent through Contact, Support, legal intake, or safety forms.</li>
              </ul>
              <p className="mt-3">
                Private messages are private from other members, but they are not end-to-end encrypted. See the{' '}
                <a href="#messaging-privacy">Private messages and platform access</a> section below.
              </p>

              <h3 className={subheadingClass}>Device, security, and usage data</h3>
              <p>This may include:</p>
              <ul className={listClass}>
                <li>IP address.</li>
                <li>Browser type.</li>
                <li>Device information.</li>
                <li>Session data.</li>
                <li>Timestamps.</li>
                <li>Error logs.</li>
                <li>Security logs.</li>
                <li>Basic usage data needed for reliability, abuse prevention, and platform safety.</li>
              </ul>

              <h3 className={subheadingClass}>Location preferences</h3>
              <p>This may include:</p>
              <ul className={listClass}>
                <li>City, state, region, or general discovery filters you choose to set.</li>
                <li>Location preferences used for event, group, or organization discovery.</li>
              </ul>
              <p className="mt-3">
                kink.social does not continuously track GPS location unless a specific location feature is added in the
                future and clearly asks for permission.
              </p>
            </>
          ),
        },
        {
          id: 'how-we-use',
          title: 'How we use information',
          body: (
            <>
              <p>We use information to:</p>
              <ul className={listClass}>
                <li>Create and secure your account.</li>
                <li>Keep you signed in.</li>
                <li>
                  Power profiles, groups, events, organizations, messaging, notifications, and organizer tools.
                </li>
                <li>Support event discovery and community discovery.</li>
                <li>Process RSVPs, registrations, and event check-in where applicable.</li>
                <li>
                  Enforce <a href="/guidelines">Community Guidelines</a>.
                </li>
                <li>Review safety reports.</li>
                <li>Prevent spam, scams, abuse, ban evasion, and platform misuse.</li>
                <li>
                  Send transactional emails, such as account verification, password resets, safety notices, and event
                  updates.
                </li>
                <li>Respond to support, legal, privacy, and safety requests.</li>
                <li>Comply with valid legal process.</li>
                <li>
                  Protect the rights, safety, and security of kink.social, our members, organizers, and the public.
                </li>
                <li>Improve the product using aggregated or limited analytics.</li>
              </ul>
              <p className="mt-3">We try to use the least amount of personal information reasonably needed for each purpose.</p>
            </>
          ),
        },
        {
          id: 'cookies-storage',
          title: 'Cookies and local storage',
          body: (
            <>
              <p>kink.social uses cookies and similar browser storage to keep the service working.</p>
              <p className="mt-3">We may use:</p>
              <ul className={listClass}>
                <li>Session cookies to keep you signed in.</li>
                <li>Security cookies to protect your account and prevent abuse.</li>
                <li>Preference storage to remember settings.</li>
                <li>Local storage during development, testing, or demo flows.</li>
              </ul>
              <p className="mt-3">
                In production, account data should rely on server-backed accounts rather than local-only demo storage.
              </p>
              <p className="mt-3">
                You can clear cookies and site data in your browser settings. Doing so may sign you out or reset local
                preferences.
              </p>
            </>
          ),
        },
        {
          id: 'sharing',
          title: 'How we share information',
          body: (
            <>
              <p>
                We share information only when needed to operate the service, support safety, comply with law, or provide
                features you choose to use.
              </p>

              <h3 className={subheadingClass}>Other members</h3>
              <p>
                Other members may see information based on your profile visibility, privacy settings, posts, groups,
                events, comments, and spaces you choose to join.
              </p>
              <p className="mt-3">For example, other members may see:</p>
              <ul className={listClass}>
                <li>Public profile details.</li>
                <li>Posts or comments you make in visible spaces.</li>
                <li>Group activity depending on group settings.</li>
                <li>Event attendance or RSVP information where the event settings allow it.</li>
              </ul>

              <h3 className={subheadingClass}>Organizers</h3>
              <p>Organizers may receive information needed to run groups, organizations, and events.</p>
              <p className="mt-3">This may include:</p>
              <ul className={listClass}>
                <li>RSVP information.</li>
                <li>Registration information.</li>
                <li>Check-in status.</li>
                <li>Event-specific profile details.</li>
                <li>Safety or moderation information where needed to protect an event or enforce event rules.</li>
              </ul>
              <p className="mt-3">
                Organizers are expected to handle member information responsibly and follow platform rules.
              </p>

              <h3 className={subheadingClass}>Service providers</h3>
              <p>We may share information with service providers that help operate kink.social.</p>
              <p className="mt-3">This may include providers for:</p>
              <ul className={listClass}>
                <li>Hosting.</li>
                <li>Authentication.</li>
                <li>Email delivery.</li>
                <li>File storage.</li>
                <li>Security.</li>
                <li>Error logging.</li>
                <li>Analytics.</li>
                <li>Payment processing if paid features are added later.</li>
              </ul>
              <p className="mt-3">
                Service providers may only use information as needed to provide services to kink.social.
              </p>

              <h3 className={subheadingClass}>Legal and safety</h3>
              <p>We may access, preserve, or share information when reasonably necessary to:</p>
              <ul className={listClass}>
                <li>Comply with valid legal process.</li>
                <li>Respond to law enforcement or legal requests.</li>
                <li>Investigate abuse, exploitation, coercion, trafficking, or serious safety concerns.</li>
                <li>
                  Protect the rights, safety, property, or security of kink.social, our members, organizers, or the
                  public.
                </li>
                <li>Enforce our policies.</li>
              </ul>
              <p className="mt-3">
                See our <a href="/law-enforcement">Law Enforcement Guidelines</a> for more detail.
              </p>

              <h3 className={subheadingClass}>Business transfers</h3>
              <p>
                If kink.social is involved in a merger, acquisition, financing, restructuring, or asset sale, member
                information may be transferred as part of that process.
              </p>
              <p className="mt-3">Where required by law, members will be notified.</p>
            </>
          ),
        },
        {
          id: 'messaging-privacy',
          title: 'Private messages and platform access',
          body: (
            <>
              <p>Direct messages are private from other members, but they are not end-to-end encrypted.</p>
              <p className="mt-3">
                This means kink.social may technically access messages, account information, media, and related metadata
                when needed for:
              </p>
              <ul className={listClass}>
                <li>Safety reports.</li>
                <li>Abuse investigations.</li>
                <li>Platform security.</li>
                <li>Support requests.</li>
                <li>Legal compliance.</li>
                <li>Spam, scam, or ban evasion review.</li>
                <li>Operation of the service.</li>
              </ul>
              <p className="mt-3">
                Access to sensitive information should be limited to authorized platform staff, including the owner when
                necessary. Access should be logged internally where technically possible.
              </p>
              <p className="mt-3">
                Individual safety, abuse, or owner investigations may not notify users when notice would compromise
                safety, privacy, legal compliance, evidence preservation, or platform security.
              </p>
              <p className="mt-3">
                Do not use kink.social messages for information you would not want exposed through screenshots, device
                compromise, legal process, or a serious platform security incident.
              </p>
            </>
          ),
        },
        {
          id: 'your-choices',
          title: 'Your choices',
          body: (
            <>
              <p>
                You can control some information through your{' '}
                <a href="/settings/privacy">Settings</a>.
              </p>
              <p className="mt-3">Depending on which features are available, you may be able to:</p>
              <ul className={listClass}>
                <li>Update your profile.</li>
                <li>Change profile visibility.</li>
                <li>Adjust notification preferences.</li>
                <li>Control who can message you.</li>
                <li>Leave groups.</li>
                <li>Cancel RSVPs.</li>
                <li>Block members.</li>
                <li>Request a data export.</li>
                <li>Request account deletion.</li>
                <li>Set auto-shred preferences for certain content.</li>
              </ul>
              <p className="mt-3">
                Some requests may be limited by safety records, legal holds, event records, fraud prevention, abuse
                investigations, or legal obligations.
              </p>
            </>
          ),
        },
        {
          id: 'rights',
          title: 'Privacy rights',
          body: (
            <>
              <p>Depending on where you live, you may have privacy rights under applicable law.</p>
              <p className="mt-3">These rights may include the ability to:</p>
              <ul className={listClass}>
                <li>Access personal information we hold about you.</li>
                <li>Correct inaccurate information.</li>
                <li>Delete certain personal information.</li>
                <li>Request a copy of your information.</li>
                <li>Object to or restrict certain uses.</li>
                <li>Appeal a privacy decision where required by law.</li>
              </ul>
              <p className="mt-3">We do not discriminate against members for exercising privacy rights.</p>
              <p className="mt-3">
                Submit privacy requests through <a href="/settings/privacy">Settings</a> if available, or through the{' '}
                <a href="/contact?topic=privacy">Contact</a> form.
              </p>
              <p className="mt-3">We may need to verify your identity before completing a request.</p>
            </>
          ),
        },
        {
          id: 'children',
          title: 'Children and minors',
          body: (
            <>
              <p>kink.social is for adults only. You must be 18 or older to use the service.</p>
              <p className="mt-3">We do not knowingly collect personal information from minors.</p>
              <p className="mt-3">
                If you believe a minor is using kink.social, report the account immediately. See our{' '}
                <a href="/minor-safety">Minor Safety</a> policy.
              </p>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <>
              <p>
                We use administrative, technical, and organizational safeguards appropriate for the sensitivity of the
                information we hold.
              </p>
              <p className="mt-3">No online service can guarantee perfect security. The sections below explain how we
                try to protect accounts and what members should still watch for.</p>

              <h3 className={subheadingClass}>Passwords and sign-in</h3>
              <p>We do not store plain text passwords.</p>
              <p className="mt-3">
                Passwords are stored using one-way hashing with bcrypt. When you sign in, we compare your password to
                that hash. We cannot read your original password back from storage.
              </p>
              <p className="mt-3">
                Sign-in sessions use signed cookies that are HttpOnly, which means they are not available to normal page
                JavaScript in your browser. In production, session cookies are also marked Secure so they are sent only
                over HTTPS.
              </p>
              <p className="mt-3">
                When you reset your password, we can invalidate existing sign-in sessions so older sessions stop working.
              </p>
              <p className="mt-3">
                Login and password reset flows may be rate limited to reduce guessing, abuse, and automated attacks.
              </p>

              <h3 className={subheadingClass}>Data in transit</h3>
              <p>
                In production, communication between your browser and kink.social is protected with HTTPS/TLS while data
                moves across the network.
              </p>
              <p className="mt-3">
                Local development and testing environments may run without HTTPS. Do not use real passwords or sensitive
                personal information in those environments unless you trust the setup.
              </p>

              <h3 className={subheadingClass}>Sensitive account data at rest</h3>
              <p>
                Some sensitive account fields may be protected with additional application-layer encryption before they
                are stored. For example, email addresses on accounts that use our encrypted email storage are protected
                with AES-256-GCM.
              </p>
              <p className="mt-3">
                We may also use hashed lookup values for certain fields so we can find records without storing the
                original value in searchable form.
              </p>
              <p className="mt-3">
                Not every piece of account or profile data receives the same level of encryption. Public profile
                content, posts, and other information you choose to share may be stored in forms needed to display and
                operate the service.
              </p>

              <h3 className={subheadingClass}>What is not end-to-end encrypted</h3>
              <p>
                Account sign-in and transport security are different from end-to-end encryption of messages. Direct
                messages are private from other members, but they are not end-to-end encrypted. See{' '}
                <a href="#messaging-privacy">Private messages and platform access</a>.
              </p>
              <p className="mt-3">
                Backups, logs, support tools, moderation systems, and service providers may also hold copies of account
                or activity data under the retention rules described in this policy.
              </p>

              <h3 className={subheadingClass}>What you can do</h3>
              <p>You can help protect your account by:</p>
              <ul className={listClass}>
                <li>Using a strong, unique password.</li>
                <li>Keeping your email account secure.</li>
                <li>Not sharing login credentials.</li>
                <li>Signing out on shared or public devices.</li>
                <li>Reporting suspicious account activity.</li>
                <li>Being careful with what you share in profiles, messages, groups, and event spaces.</li>
              </ul>
              <p className="mt-3">
                Report suspected account compromise through <a href="/contact">Contact</a> or{' '}
                <a href="/support">Support</a>.
              </p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'Retention and deletion',
          body: (
            <>
              <p>
                We try to keep member data only as long as reasonably needed for the service, safety, legal compliance,
                and platform operations.
              </p>
              <p className="mt-3">
                While your account is active, we keep information needed to operate your account and the features you
                use.
              </p>
              <p className="mt-3">
                When you delete content, request deletion, or use auto-shred settings, kink.social will remove eligible
                content from active systems through scheduled deletion processes.
              </p>
              <p className="mt-3">Deletion may not be instant.</p>
              <p className="mt-3">
                Some information may remain for a limited time in backups, logs, moderation records, safety records,
                organizer records, fraud prevention systems, legal holds, or other systems where retention is necessary.
              </p>
              <p className="mt-3">Typical retention windows may include:</p>
              <ul className={listClass}>
                <li>Security logs for about 30 days.</li>
                <li>Signup IP or abuse-prevention records for about 30 days after account deletion.</li>
                <li>Backup snapshots for about 30 days before they age out.</li>
                <li>Moderation and safety records for about 365 days.</li>
                <li>
                  Event, organizer, or transaction records for as long as reasonably needed to operate events, resolve
                  disputes, prevent abuse, or meet legal obligations.
                </li>
              </ul>
              <p className="mt-3">
                We do not keep deleted content longer than reasonably necessary unless a legal hold, active safety
                investigation, dispute, organizer obligation, or legal requirement applies.
              </p>
            </>
          ),
        },
        {
          id: 'auto-shred',
          title: 'Auto-shred settings',
          body: (
            <>
              <p>
                If available in <a href="/settings/privacy">Settings</a> under Privacy, members may choose auto-shred
                settings for certain content.
              </p>
              <p className="mt-3">Auto-shred may apply to:</p>
              <ul className={listClass}>
                <li>Direct messages.</li>
                <li>Convention hub chat.</li>
                <li>Feed activity you create.</li>
                <li>Other eligible content types added later.</li>
              </ul>
              <p className="mt-3">Available time windows may include:</p>
              <ul className={listClass}>
                <li>7 days.</li>
                <li>10 days.</li>
                <li>30 days.</li>
                <li>90 days.</li>
                <li>365 days.</li>
              </ul>
              <p className="mt-3">Auto-shred runs on a schedule and may not erase content instantly.</p>
              <p className="mt-3">Auto-shred may be paused or limited when content is subject to:</p>
              <ul className={listClass}>
                <li>A legal hold.</li>
                <li>An active safety investigation.</li>
                <li>A moderation case.</li>
                <li>A fraud or abuse review.</li>
                <li>An organizer obligation.</li>
                <li>A valid legal request.</li>
              </ul>
              <p className="mt-3">
                Auto-shred does not prevent screenshots, copying, exports, insecure devices, or other members saving
                content before deletion.
              </p>
            </>
          ),
        },
        {
          id: 'account-deletion',
          title: 'Account deletion',
          body: (
            <>
              <p>
                You may request account deletion through <a href="/settings/privacy">Settings</a> if available, or
                through <a href="/contact?topic=privacy">Contact</a>.
              </p>
              <p className="mt-3">
                Account deletion removes or anonymizes eligible personal information after a short processing window.
              </p>
              <p className="mt-3">Some information may be retained when needed for:</p>
              <ul className={listClass}>
                <li>Legal compliance.</li>
                <li>Safety investigations.</li>
                <li>Moderation records.</li>
                <li>Fraud prevention.</li>
                <li>Abuse prevention.</li>
                <li>Event records.</li>
                <li>Organizer obligations.</li>
                <li>Dispute resolution.</li>
                <li>Valid legal holds.</li>
              </ul>
              <p className="mt-3">
                Account deletion does not automatically delete content already copied by other members, screenshots taken
                by others, or records held outside kink.social.
              </p>
            </>
          ),
        },
        {
          id: 'international',
          title: 'International users',
          body: (
            <>
              <p>kink.social is operated from the United States.</p>
              <p className="mt-3">
                If you access kink.social from outside the United States, your information may be processed in the United
                States and in other locations where our service providers operate.
              </p>
              <p className="mt-3">
                By using the service, you understand that your information may be processed in countries that may have
                different privacy laws than your location.
              </p>
            </>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to this policy',
          body: (
            <>
              <p>We may update this Privacy Policy as kink.social changes.</p>
              <p className="mt-3">
                When changes are significant, we will provide notice where appropriate, such as through the site, email,
                or account notifications.
              </p>
              <p className="mt-3">The updated version will show the effective date when published.</p>
            </>
          ),
        },
        {
          id: 'contact',
          title: 'Contact',
          body: (
            <>
              <p>Questions about this policy?</p>
              <p className="mt-3">
                Use the <a href="/contact?topic=privacy">Contact</a> form and choose Privacy as the topic.
              </p>
              <p className="mt-3">
                For account help, visit <a href="/support">Support</a>.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
