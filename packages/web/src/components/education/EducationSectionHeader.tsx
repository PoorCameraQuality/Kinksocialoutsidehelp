import { Link } from 'react-router-dom'

type Props = {
  title: string
  subtitle: string
  backHref?: string
  backLabel?: string
}

export default function EducationSectionHeader({
  title,
  subtitle,
  backHref = '/education',
  backLabel = 'Education overview',
}: Props) {
  return (
    <header className="edu-section-header">
      <Link to={backHref} className="edu-section-header__back">
        ← {backLabel}
      </Link>
      <h1 className="edu-section-header__title">{title}</h1>
      <p className="edu-section-header__subtitle">{subtitle}</p>
    </header>
  )
}
