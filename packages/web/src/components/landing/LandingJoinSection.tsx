import type { ReactNode } from 'react'
import { LANDING_JOIN } from '@/components/landing/landing-beta-content'

type Props = {
  children: ReactNode
}

export default function LandingJoinSection({ children }: Props) {
  return (
    <section id="join" className="beta-section beta-join" aria-labelledby="landing-join-title">
      <div className="public-container">
        <div className="beta-joinbox">
          <p className="beta-kicker">{LANDING_JOIN.kicker}</p>
          <h2 id="landing-join-title">{LANDING_JOIN.title}</h2>
          <p>{LANDING_JOIN.body}</p>
          {children}
        </div>
      </div>
    </section>
  )
}
