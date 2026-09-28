import clsx from 'clsx'
import { useId } from 'react'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: string
}

type Props<T extends string | number> = {
  legend: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** A row of radio buttons styled as a segmented control. */
export function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: Props<T>) {
  const name = useId()

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex rounded-md border border-border bg-background p-0.5">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={clsx(
                'flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                checked
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
