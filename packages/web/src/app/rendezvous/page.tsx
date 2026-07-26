import ComingSoonLayout from '@/components/ui/ComingSoonLayout'

export default function RendezvousPage() {
  return (
    <ComingSoonLayout
      heading="Rendezvous"
      body="A dedicated meetups surface is planned. Use events and Find people to discover munches and gatherings near you."
      primaryCta={{ label: 'Events', href: '/events' }}
      secondaryCta={{ label: 'Find people', href: '/discovery' }}
    />
  )
}
