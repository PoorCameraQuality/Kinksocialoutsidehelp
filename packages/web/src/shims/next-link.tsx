import { Link as RouterLink, type LinkProps } from 'react-router-dom'

type Props = Omit<LinkProps, 'to'> & {
  href: string
}

/** Drop-in for `next/link` in the Vite app (href → to). */
export default function Link({ href, ...rest }: Props) {
  return <RouterLink to={href} {...rest} />
}
