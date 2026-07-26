import { useParams } from 'react-router-dom'
import RegisterFlow from '@/components/conventions/RegisterFlow'

export default function ConventionRegisterPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug ?? ''
  if (!slug) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-text">Missing convention slug.</div>
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-dc-text">Register for this convention</h1>
      <p className="mt-2 text-sm text-dc-text-muted">
        Pick a category, fill out the form, and accept any required policies. Your Kink Social profile is your identity at the
        event.
      </p>
      <div className="mt-6">
        <RegisterFlow slug={slug} />
      </div>
    </div>
  )
}
