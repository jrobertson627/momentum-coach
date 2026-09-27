import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export type CardProps = HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'rounded-lg border border-border bg-muted p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
