import LoginCard, { type LoginCardProps } from '@/components/LoginCard'



type Props = LoginCardProps & {

  variant?: 'default' | 'landing'

}



export default function LandingSignupBlock({ variant = 'landing', ...props }: Props) {

  return <LoginCard {...props} variant={variant} />

}

