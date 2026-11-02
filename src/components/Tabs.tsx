import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './classes'

interface Tab<T extends string> {
  value: T
  label: string
  count?: number
}

/** WAI-ARIA tabs with roving focus (arrow keys, Home, End). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  children,
}: {
  label: string
  tabs: readonly Tab<T>[]
  value: T
  onChange: (value: T) => void
  children: ReactNode
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    const tab = tabs[next]
    if (tab) {
      onChange(tab.value)
      refs.current[next]?.focus()
    }
  }
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line">
        {tabs.map((tab, i) => {
          const selected = tab.value === value
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              role="tab"
              type="button"
              id={`${id}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                '-mb-px flex items-center gap-2 border-b-2 px-3 pt-1 pb-2.5 text-sm font-semibold transition-colors',
                selected ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cx('tnum rounded-full px-1.5 text-[0.6875rem]', selected ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-ink-3')}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`} className="pt-4">
        {children}
      </div>
    </div>
  )
}
