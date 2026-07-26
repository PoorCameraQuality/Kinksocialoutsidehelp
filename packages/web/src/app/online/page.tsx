import ComingSoonLayout from '@/components/ui/ComingSoonLayout'

export default function OnlinePage() {
  return (
    <ComingSoonLayout
      heading="Online now"
      body="Live presence isn’t available in the mock yet. Find people and messaging are the best ways to connect."
      primaryCta={{ label: 'People', href: '/people' }}
      secondaryCta={{ label: 'Messages', href: '/messaging' }}
    />
  )
}
