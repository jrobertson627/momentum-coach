import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { buttonStyles } from './buttonStyles'
import type { ButtonSize, ButtonVariant } from './buttonStyles'

export type { ButtonVariant, ButtonSize }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
