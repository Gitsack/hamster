import { HamsterIcon } from './hamster-icon'

interface HamsterLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const iconSizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
}

export function HamsterLogo({ size = 'md', showText = true, className }: HamsterLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div
        className={`${sizeClasses[size]} rounded-lg bg-primary flex items-center justify-center text-primary-foreground`}
      >
        <HamsterIcon className={iconSizeClasses[size]} />
      </div>
      {showText && <span className={`font-semibold ${textSizeClasses[size]}`}>Hamster</span>}
    </div>
  )
}
