import ComingSoonLayout from '@/components/ui/ComingSoonLayout'

export default function ForumsPage() {
  return (
    <ComingSoonLayout
      heading="Forums"
      body="Public forums are planned. Until then, join groups and use channels for discussions."
      primaryCta={{ label: 'Browse groups', href: '/groups' }}
      secondaryCta={{ label: 'Home', href: '/home' }}
    />
  )
}
