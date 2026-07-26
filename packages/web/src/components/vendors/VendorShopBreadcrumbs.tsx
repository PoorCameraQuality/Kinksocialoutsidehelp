import { Link } from 'react-router-dom'

type Props = {
  shopName: string
  primaryCategory?: string | null
  className?: string
}

export default function VendorShopBreadcrumbs({ shopName, primaryCategory, className = '' }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-sm text-dc-text-muted mb-4 ${className}`.trim()}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/vendors" className="hover:text-dc-accent hover:underline">
            Vendors
          </Link>
        </li>
        {primaryCategory ?
          <>
            <li aria-hidden className="text-dc-muted">
              /
            </li>
            <li>
              <Link
                to={`/vendors?category=${encodeURIComponent(primaryCategory)}`}
                className="hover:text-dc-accent hover:underline"
              >
                {primaryCategory}
              </Link>
            </li>
          </>
        : null}
        <li aria-hidden className="text-dc-muted">
          /
        </li>
        <li className="text-dc-text font-medium truncate max-w-[16rem]" aria-current="page">
          {shopName}
        </li>
      </ol>
    </nav>
  )
}
