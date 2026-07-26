import LegalDraftPage from '@/components/ui/LegalDraftPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 6, 2026' : undefined

export default function LawEnforcementPage() {
  return (
    <LegalDraftPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Law Enforcement & Legal Requests"
      intro="Kink Social responds to valid legal process from authorized agencies and parties. We collect as little member data as we reasonably can. Requests that are incomplete, informal, or missing credentials will not receive a substantive response."
      relatedLinks={[
        { label: 'Submit a legal request', href: '/contact?topic=law_enforcement' },
        { label: 'Privacy policy', href: '/privacy' },
        { label: 'Minor safety', href: '/minor-safety' },
        { label: 'DMCA', href: '/dmca' },
      ]}
      sections={[
        {
          id: 'who-this-is-for',
          title: 'Who should use this page',
          body: (
            <>
              <p>
                This page is for <strong className="text-dc-text">law enforcement officers</strong>,{' '}
                <strong className="text-dc-text">prosecutors</strong>, and other{' '}
                <strong className="text-dc-text">authorized parties</strong> with lawful authority to request
                information from Kink Social.
              </p>
              <p className="mt-2">
                If you are a member asking about your own data, use{' '}
                <a href="/contact?topic=privacy">Contact (Privacy)</a> or Settings under Your data. If you are
                reporting abuse on the platform, use <a href="/support">Help &amp; support</a> so moderation can
                track the report.
              </p>
            </>
          ),
        },
        {
          id: 'how-to-submit',
          title: 'How to submit a request',
          body: (
            <>
              <p>
                Submit requests through our{' '}
                <a href="/contact?topic=law_enforcement">Contact form</a> with topic{' '}
                <strong className="text-dc-text">Law enforcement or legal process</strong>.
              </p>
              <p className="mt-2">
                Attach or describe your legal process in the message body. If your agency requires service on a
                designated agent or mailing address, include that requirement in your submission. Operator contact
                details for formal service will be published before public launch.
              </p>
              <p className="mt-2">
                We review submissions during business hours. Incomplete requests are queued for rejection or a request
                for clarification. We do not provide member data in response to phone calls, social media messages, or
                unverified email without proper process.
              </p>
            </>
          ),
        },
        {
          id: 'credentials-required',
          title: 'Agency credentials are required',
          body: (
            <>
              <p>
                We will not provide a substantive response unless we can verify that the request comes from an
                authorized law enforcement or legal representative. Every submission must include:
              </p>
              <ul>
                <li>
                  <strong className="text-dc-text">Agency or office name</strong> (for example, police department,
                  sheriff&apos;s office, FBI field office, prosecutor&apos;s office, or authorized counsel)
                </li>
                <li>
                  <strong className="text-dc-text">Requesting officer or attorney name</strong>
                </li>
                <li>
                  <strong className="text-dc-text">Badge number, employee ID, or bar number</strong> where applicable
                </li>
                <li>
                  <strong className="text-dc-text">Official agency email or callback number</strong> on agency
                  letterhead or within the legal process itself
                </li>
              </ul>
              <p className="mt-2">
                Requests missing verifiable credentials may be ignored. We may ask for additional verification before
                processing sensitive disclosures.
              </p>
            </>
          ),
        },
        {
          id: 'valid-process',
          title: 'Valid legal process required',
          body: (
            <>
              <p>
                Kink Social does not disclose member information in response to informal inquiries, voluntary questionnaires,
                or &ldquo;fishing expedition&rdquo; requests. We require{' '}
                <strong className="text-dc-text">valid legal process</strong>, such as:
              </p>
              <ul>
                <li>Subpoena</li>
                <li>Court order</li>
                <li>Search warrant</li>
                <li>Equivalent compulsory process in your jurisdiction (for international requests, include mutual legal
                  assistance or other recognized authority)</li>
              </ul>
              <p className="mt-2">
                The process must be directed to Kink Social (or our designated agent when published) and must comply with
                applicable law. We may reject, narrow, or seek judicial clarification of overbroad requests. We may
                notify affected members when we are not prohibited from doing so.
              </p>
            </>
          ),
        },
        {
          id: 'required-scope',
          title: 'What every request must identify',
          body: (
            <>
              <p>
                Have your ducks in a row before submitting. Requests that omit required detail may be returned
                unanswered. Include all of the following:
              </p>
              <ul>
                <li>
                  <strong className="text-dc-text">Account identifiers:</strong> username, account email, and/or Kink Social
                  user ID if known. Vague descriptions (&ldquo;the person who posted about rope bondage in Portland&rdquo;)
                  are not sufficient.
                </li>
                <li>
                  <strong className="text-dc-text">Scope of data:</strong> what categories you need (account profile,
                  posts, messages, IP logs, moderation records, media, event attendance, etc.) and what you do{' '}
                  <strong className="text-dc-text">not</strong> need.
                </li>
                <li>
                  <strong className="text-dc-text">Date range:</strong> when the relevant activity occurred, when
                  possible.
                </li>
                <li>
                  <strong className="text-dc-text">Case or docket reference:</strong> your investigation or court case
                  number.
                </li>
                <li>
                  <strong className="text-dc-text">Copy or summary of legal process:</strong> pasted into the message
                  or attached per your agency&apos;s secure-transfer rules.
                </li>
              </ul>
              <p className="mt-2">
                We do not offer bulk or keyword-based member searches. We respond only to scoped requests tied to
                identifiable accounts or content we can locate with the identifiers you provide.
              </p>
            </>
          ),
        },
        {
          id: 'preservation',
          title: 'Preservation requests and legal holds',
          body: (
            <>
              <p>
                When we receive a <strong className="text-dc-text">valid preservation request</strong> tied to
                identifiable accounts or content, we may place a <strong className="text-dc-text">legal hold</strong>{' '}
                on the relevant records.
              </p>
              <p className="mt-2">
                While a legal hold is active, affected data is not deleted, anonymized, or purged, even if the member
                requests account deletion or exercises other privacy rights. Holds remain until released by Kink Social after
                the underlying legal matter is resolved or the preservation obligation expires under applicable law.
              </p>
              <p className="mt-2">
                Preservation requests should use the same Contact form and include the same credentials, account
                identifiers, and scope details as production requests.
              </p>
            </>
          ),
        },
        {
          id: 'moderation-preservation',
          title: 'Moderation and suspected illegal content',
          body: (
            <>
              <p>
                Our trust and safety workflows may automatically place suspected illegal or severely harmful content
                into a <strong className="text-dc-text">preservation state</strong> while human moderators review the
                report and while we prepare lawful external reports (for example, suspected child sexual abuse material
                referred to appropriate authorities).
              </p>
              <p className="mt-2">
                Preserved moderation evidence is removed from ordinary member view but retained internally for
                investigation, legal compliance, and defense of platform safety actions. This is separate from, and
                may occur before, a formal law enforcement preservation letter.
              </p>
              <p className="mt-2">
                See <a href="/minor-safety">Minor Safety</a> for how we handle urgent minor-safety and CSAM reports.
              </p>
            </>
          ),
        },
        {
          id: 'data-we-collect',
          title: 'Data we collect (and what we do not)',
          body: (
            <>
              <p>
                Kink Social is built around <strong className="text-dc-text">data minimization</strong>. We store what we need
                to operate an adults-only community platform, not a full identity dossier. Responses to legal process
                are limited to data we actually hold at the time of the request.
              </p>
              <p className="mt-3 font-medium text-dc-text">We generally store</p>
              <ul>
                <li>
                  <strong className="text-dc-text">Account core:</strong> username, email address, password hash (not
                  plaintext), account creation time, self-attested 18+ and terms acceptance timestamps, optional
                  normalized signup IP prefix
                </li>
                <li>
                  <strong className="text-dc-text">Profile (member-provided):</strong> display name, bio, optional
                  location or discovery filters, optional birth date or derived age, pronouns, roles, avatar and
                  profile photos, visibility settings
                </li>
                <li>
                  <strong className="text-dc-text">Activity on Kink Social:</strong> group and event participation, forum
                  posts and comments, RSVPs and organizer-facing registration data where applicable, reports you file
                  or receive, moderation outcomes tied to your account
                </li>
                <li>
                  <strong className="text-dc-text">Communications:</strong> convention hub channel messages, direct
                  messages when that feature is enabled, and messages you send through Contact or Support forms
                </li>
                <li>
                  <strong className="text-dc-text">Uploads:</strong> media metadata, storage keys, safety scan results,
                  and moderation status for files members upload
                </li>
                <li>
                  <strong className="text-dc-text">Security and operations logs:</strong> limited IP addresses,
                  timestamps, and request paths retained for abuse prevention and reliability (short default retention;
                  see our Privacy Policy)
                </li>
                <li>
                  <strong className="text-dc-text">Settings:</strong> notification preferences, privacy toggles, and
                  similar account configuration
                </li>
              </ul>
              <p className="mt-3 font-medium text-dc-text">We do not collect at signup or by default</p>
              <ul>
                <li>Government-issued ID numbers or ID document images for ordinary accounts</li>
                <li>Legal name (unless a member chooses to put one in their profile)</li>
                <li>Precise real-time GPS location (unless a future feature explicitly asks for it and the member opts in)</li>
                <li>Payment card or bank account data (Kink Social does not process payments in beta)</li>
                <li>Third-party advertising profiles or sale of member data</li>
              </ul>
              <p className="mt-3">
                Because we collect less, we may have <strong className="text-dc-text">less to give you</strong> than
                platforms that verify government IDs or track continuous location. Do not assume we hold data we never
                collected. See our <a href="/privacy">Privacy Policy</a> for member-facing detail.
              </p>
            </>
          ),
        },
        {
          id: 'what-we-provide',
          title: 'What we can and cannot provide',
          body: (
            <ul>
              <li>
                <strong className="text-dc-text">Can provide (when scoped and lawful):</strong> account and profile
                fields we store, content and communications tied to an identified account, moderation and report
                records, limited IP and timestamp logs within retention windows, event and group participation tied to
                the account
              </li>
              <li>
                <strong className="text-dc-text">Cannot provide:</strong> data we never collected, deleted data outside
                retention or not under hold, other members&apos; private communications unrelated to your scope, or
                bulk member lists based on keywords, geography, or kink interests
              </li>
              <li>
                <strong className="text-dc-text">Passwords:</strong> we store password hashes only. We cannot disclose
                plaintext passwords.
              </li>
            </ul>
          ),
        },
        {
          id: 'member-erasure',
          title: 'Member-initiated erasure',
          body: (
            <p>
              Members may configure auto-shred in Settings so their own direct messages, hub chat, and feed activity
              are securely erased on a schedule (for example, after 10 days). Once erased, that content is not available
              for production disclosure. Legal holds and safety preservation still apply and can block erasure while
              an investigation is active. Platform-wide retention windows (security logs, moderation records) are
              described in our <a href="/privacy#retention">Privacy Policy</a>.
            </p>
          ),
        },
        {
          id: 'emergency',
          title: 'Emergency disclosures',
          body: (
            <p>
              We may disclose limited information without the formal process described above when we believe in good
              faith that an emergency involving imminent danger of death or serious physical injury requires immediate
              disclosure. Emergency requests must still include verifiable agency credentials and as much identifying
              detail as possible. Call local emergency services (911 in the U.S.) for immediate in-person danger; use
              the Contact form for platform-held data emergencies.
            </p>
          ),
        },
        {
          id: 'international',
          title: 'International requests',
          body: (
            <p>
              Requests from outside the United States should include documentation showing authority to compel
              disclosure from a U.S.-based service provider, such as mutual legal assistance treaty (MLAT) process or
              other recognized international procedure. Informal foreign police emails without proper authority are
              not sufficient.
            </p>
          ),
        },
        {
          id: 'not-legal-advice',
          title: 'Not legal advice',
          body: (
            <p>
              This page describes Kink Social&apos;s intended practices and is subject to counsel review before public launch.
              It is not legal advice to requesters or members. We may update these practices as law, product scope, or
              counsel guidance changes.
            </p>
          ),
        },
      ]}
    />
  )
}
