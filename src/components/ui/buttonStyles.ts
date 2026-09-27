import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  secondary:
    'bg-muted text-foreground border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

/** Shared button visuals for non-<button> elements that need to look like one (e.g. anchor CTAs). */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return clsx(
    'inline-flex items-center justify-center rounded-md font-medium',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:pointer-events-none',
    variantStyles[variant],
    sizeStyles[size],
    className,
  )
}
