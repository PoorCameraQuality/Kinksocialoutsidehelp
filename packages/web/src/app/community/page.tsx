import ComingSoonLayout from '@/components/ui/ComingSoonLayout'

export default function CommunityPage() {
  return (
    <ComingSoonLayout
      heading="BDSM & Kink Community"
      body="Forums, groups, and discussions for the fetish and lifestyle community. Groups and the local feed are ready to explore."
      primaryCta={{ label: 'Groups', href: '/groups' }}
      secondaryCta={{ label: 'Home feed', href: '/home' }}
    />
  )
}
