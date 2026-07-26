import PolicyStandardPage from '@/components/ui/PolicyStandardPage'

const legalPublished = import.meta.env.VITE_LEGAL_PUBLISHED === 'true'
const lastUpdated = legalPublished ? 'June 6, 2026' : undefined

export default function ModeratorCodeOfConductPage() {
  return (
    <PolicyStandardPage
      published={legalPublished}
      effectiveDate={lastUpdated}
      lastUpdated={lastUpdated}
      title="Moderator Code of Conduct"
      intro="Moderator and admin access on Kink Social is a privilege, not a perk. You are in service to the community, not above it. Abusing power is a one-strike offense: permanent removal from the platform, with no appeal and no reinstatement."
      relatedLinks={[
        { label: 'Community guidelines', href: '/guidelines' },
        { label: 'Group guidelines', href: '/policies/groups' },
        { label: 'Appeals (members)', href: '/policies/appeals' },
        { label: 'Report misconduct', href: '/support' },
      ]}
      content={{
        whatThisMeans: (
          <>
            <p>
              This code applies to anyone acting in a moderation or admin role on Kink Social: platform trust &amp; safety
              staff, site administrators, organization admins, group owners and leaders, event door staff with
              enforcement tools, and anyone else delegated moderation powers.
            </p>
            <p className="mt-2">
              Your role is <strong className="text-dc-text">temporary stewardship</strong>, not status. Perfection is
              impossible and you cannot make everyone happy. You commit to doing your best anyway, with fairness,
              recusal when conflicted, and escalation when harm is urgent.
            </p>
            <p className="mt-2">
              Good-faith mistakes on ordinary member enforcement may be reviewed through{' '}
              <a href="/policies/appeals">appeals</a>.{' '}
              <strong className="text-dc-text">Abuse of power is different:</strong> using tools for personal gain,
              retaliation, voyeurism, or control is zero tolerance with permanent platform ban and no appeal.
            </p>
          </>
        ),
        notAllowed: (
          <ul>
            <li>
              <strong className="text-dc-text">Power abuse (one strike):</strong> harassment, retaliation, extortion,
              stalking, silencing criticism, or punishing personal enemies with mod tools.
            </li>
            <li>
              Knowingly or intentionally hateful, harassing, predatory, or discriminatory behavior, including racism,
              sexism, ableism, homophobia, transphobia, or conduct that makes others non-consensually uncomfortable.
            </li>
            <li>
              Accessing private reports, DMs, moderation notes, or member data outside authorized workflows, or sharing
              them without authorization.
            </li>
            <li>Deciding cases involving people you have a strong pre-existing positive or negative feeling about without recusing.</li>
            <li>Using neutral recusal language in one channel and biased language elsewhere about the same person.</li>
            <li>Threatening bans, visibility, or access to extract favors, content, dates, or personal information.</li>
            <li>Holding friends, partners, or admired members to lower standards than strangers or people you dislike.</li>
            <li>Using your role for financial, social, or relationship gain for yourself or allies.</li>
            <li>Pursuing play or romantic relationships with new members before they have time to understand your role and consent freely.</li>
            <li>Using admin visibility to spy on members, partners, or ex-partners.</li>
            <li>Leveraging public opinion to override a moderation team decision you disagree with.</li>
            <li>Speaking for the platform or a moderation team without consensus when the statement binds others.</li>
            <li>Bypassing platform escalation for minors, NCII, doxing, credible threats, or trafficking indicators.</li>
            <li>Impersonating platform staff or coordinating ban evasion.</li>
          </ul>
        ),
        allowed: (
          <ul>
            <li>Enforcing published rules with clear, proportional actions and brief factual notes.</li>
            <li>Taking personal criticism seriously, reflecting, and responding without defensiveness or retaliation.</li>
            <li>Recusing immediately when conflicted and trusting another reviewer to decide fairly.</li>
            <li>De-escalating verbally before using tools when safe and practical.</li>
            <li>Emergency restrictions when someone is actively harming others, followed by prompt team review.</li>
            <li>Advocating inside the moderation team when you disagree, without going public to pressure outcomes.</li>
            <li>Escalating urgent safety issues to platform trust &amp; safety when local scope is not enough.</li>
          </ul>
        ),
        howToReport: (
          <>
            <p>
              Report moderator or admin misconduct via in-product reporting,{' '}
              <a href="/support">Help &amp; support</a>, or our{' '}
              <a href="/contact?topic=legal">Contact form</a>. Include username, scope (platform, org, group, or
              event), what happened, and links or screenshots if available.
            </p>
            <p className="mt-2">
              For concerns about a specific moderator, contact platform trust &amp; safety or another admin{' '}
              <strong className="text-dc-text">not</strong> the person you are reporting. Your report will not be shared
              with them without your consent. Do not &ldquo;shop&rdquo; the same complaint to multiple admins hoping for
              a different answer; that undermines victim protections and may itself be reviewed.
            </p>
          </>
        ),
        whoCanReport: (
          <p>
            Any member harmed by or witness to moderator abuse may report. Organizers and group leaders may report peer
            moderators when platform intervention is needed. Platform staff who witness colleague misconduct must
            escalate internally immediately.
          </p>
        ),
        whatHappensNext: (
          <>
            <p>If power abuse is confirmed, Kink Social will:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Revoke all moderator, organizer, and admin permissions immediately.</li>
              <li>Permanently ban the account from the platform.</li>
              <li>Preserve audit records for safety and legal compliance.</li>
              <li>Notify affected communities when appropriate without exposing private report details.</li>
            </ol>
            <p className="mt-3">
              <strong className="text-dc-text">There is no appeal for confirmed moderator or admin power abuse.</strong>{' '}
              Ban evasion is itself a violation.
            </p>
            <p className="mt-2 text-sm text-dc-muted">
              Honest enforcement mistakes, proportional timeouts, and ordinary member-rule violations follow normal
              review paths. Group-level removal without power abuse is handled under{' '}
              <a href="/policies/groups">Group Guidelines</a>.
            </p>
          </>
        ),
        escalation: (
          <p>
            Minors, NCII, credible threats, and doxing skip every queue. See{' '}
            <a href="/minor-safety">Minor Safety</a> and <a href="/ncii">NCII Policy</a>. Moderators who fail to
            escalate may face power-abuse or negligence review depending on severity.
          </p>
        ),
        additionalSections: [
          {
            id: 'moderator-commitments',
            title: 'Commitments for all moderators',
            body: (
              <>
                <p>By accepting moderation access, you agree to the following in addition to the general{' '}
                  <a href="/guidelines">Community Guidelines</a>:
                </p>
                <ul className="mt-2 space-y-2">
                  <li>
                    <strong className="text-dc-text">Service, not status.</strong> You foster an inclusive, safe
                    environment. The community does not exist to elevate you.
                  </li>
                  <li>
                    <strong className="text-dc-text">Same standards for everyone.</strong> Hold yourself, fellow mods,
                    friends, partners, and people you admire to the same bar you hold acquaintances and people you
                    dislike.
                  </li>
                  <li>
                    <strong className="text-dc-text">Good faith first.</strong> Allow people to redress honest mistakes
                    before assuming malice. Think before reacting in anger. Your words carry extra weight because of
                    your role, even when you do not intend them to.
                  </li>
                  <li>
                    <strong className="text-dc-text">Recusal.</strong> Step out of any decision involving someone you
                    have a strong pre-existing positive or negative feeling about. Notify the team with neutral
                    language and only facts you know for certain. Abide by the outcome even if you disagree.
                  </li>
                  <li>
                    <strong className="text-dc-text">Confidentiality.</strong> Keep sensitive moderation discussions
                    within authorized staff channels. Do not leak report details, private messages, or deliberations.
                  </li>
                  <li>
                    <strong className="text-dc-text">Speak for yourself.</strong> Do not speak for the mod team unless
                    the team has agreed. Policy interpretation disputes go to admins; abide by their decision.
                  </li>
                  <li>
                    <strong className="text-dc-text">Step down when appropriate.</strong> If you knowingly harmed
                    someone in a way that affects community trust, step down immediately. If accused of such harm and
                    you disagree, recuse from the decision, answer questions honestly, and abide by the admin
                    team&apos;s outcome. Community safety outweighs pride or reputation.
                  </li>
                  <li>
                    <strong className="text-dc-text">Availability.</strong> If you cannot perform your duties, inform
                    the team promptly so a replacement can be found.
                  </li>
                </ul>
              </>
            ),
          },
          {
            id: 'administrator-commitments',
            title: 'Additional commitments for administrators',
            body: (
              <>
                <p>
                  Organization admins, group owners with admin powers, and platform staff with administrative access
                  accept a <strong className="text-dc-text">stricter</strong> standard:
                </p>
                <ul className="mt-2 space-y-2">
                  <li>
                    Hold fellow admins and moderators to the same scrutiny you would apply to your most serious
                    concerns about a stranger.
                  </li>
                  <li>
                    Keep admin deliberations private; advocate disagreements inside the team, not through public
                    pressure campaigns.
                  </li>
                  <li>
                    Log formal decisions in moderation audit systems so future admins have context (without exposing
                    private victim details publicly).
                  </li>
                  <li>
                    Disclose immediately if you take a leadership role at an event, venue, or kink organization that
                    could create a conflict of interest on Kink Social.
                  </li>
                  <li>
                    On term end or resignation, transition knowledge, access, and resources willingly without undue
                    friction.
                  </li>
                  <li>
                    When reviewing allegations against another admin, respect a reporter&apos;s request for anonymity
                    even if that limits what action can be taken without their consent to proceed.
                  </li>
                </ul>
                <p className="mt-2 text-sm text-dc-muted">
                  Platform operators retain break-glass authority to revoke compromised admin access immediately when
                  someone goes rogue, followed by review by remaining trusted staff.
                </p>
              </>
            ),
          },
          {
            id: 'human-impact',
            title: 'Spirit over loopholes',
            body: (
              <p>
                Rules cannot cover every edge case. Behavior crafted to dodge the letter of policy while making a space
                unsafe or miserable is still subject to review. Human impact and consent come before &ldquo;the rules
                do not literally forbid it.&rdquo; Conversely, conduct that technically touches a rule may be acceptable
                in rare context when harm is low and good faith is clear. Moderators apply judgment; abuse of that
                judgment for personal ends is power abuse.
              </p>
            ),
          },
          {
            id: 'before-you-accept',
            title: 'Before you accept the role',
            body: (
              <p>
                Moderation is work: uncomfortable conversations, heated disagreements, and decisions where every option
                hurts someone. If you want the role for status, control, or access to private data, decline it. If you
                accept it, you accept the one-strike standard for power abuse and the commitments above.
              </p>
            ),
          },
          {
            id: 'not-legal-advice',
            title: 'Not legal advice',
            body: (
              <p>
                This code describes platform enforcement intent and is subject to counsel review before public launch.
                The spirit of these commitments should guide interpretation when wording has gaps.
              </p>
            ),
          },
        ],
      }}
    />
  )
}
