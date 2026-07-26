import ComingSoonLayout from '@/components/ui/ComingSoonLayout'

export default function StatesPage() {
  return (
    <ComingSoonLayout
      heading="States"
      body="Regional browsing is on the roadmap. Use Find people and location filters on events and groups for now."
      primaryCta={{ label: 'Find people', href: '/discovery' }}
      secondaryCta={{ label: 'Events', href: '/events' }}
    />
  )
}
