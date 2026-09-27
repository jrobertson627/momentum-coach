import { describe, expect, it } from 'vitest'
import { buttonStyles } from './buttonStyles'

describe('buttonStyles', () => {
  it('defaults to a medium primary button', () => {
    const classes = buttonStyles()
    expect(classes).toContain('bg-accent')
    expect(classes).toContain('h-10')
  })

  it('applies the requested variant and size, and keeps extra classes', () => {
    const classes = buttonStyles({
      variant: 'ghost',
      size: 'lg',
      className: 'w-full',
    })
    expect(classes).toContain('bg-transparent')
    expect(classes).toContain('h-12')
    expect(classes).toContain('w-full')
    expect(classes).not.toContain('bg-accent ')
  })
})
