import type { LucideIcon } from 'lucide-react'
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { categoryColorVar } from '../domain/categories'
import type { CategoryId, CurrencyCode } from '../domain/types'
import { useI18n } from '../i18n/context'
import { buttonClass, cx, type Size, type Variant } from './classes'


interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </Link>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  size?: Size
}

export function IconButton({ icon: Icon, label, size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.625rem] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

interface CardProps {
  title?: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'div'
}

export function Card({ title, subtitle, actions, children, className, bodyClassName, as: Tag = 'section' }: CardProps) {
  const headingId = useId()
  return (
    <Tag className={cx('card min-w-0', className)} aria-labelledby={title ? headingId : undefined}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[0.9375rem] font-bold tracking-[-0.01em] text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={cx('px-5 pt-3 pb-5', bodyClassName)}>{children}</div>
    </Tag>
  )
}

type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-negative',
  accent: 'bg-accent-soft text-accent-soft-ink',
}

export function Badge({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap', TONES[tone], className)}>
      {Icon && <Icon aria-hidden className="size-3" />}
      {children}
    </span>
  )
}

export function CategoryDot({ id, className }: { id: CategoryId; className?: string }) {
  return <span aria-hidden className={cx('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: categoryColorVar(id) }} />
}

export function CategoryLabel({ id, className }: { id: CategoryId; className?: string }) {
  const { t } = useI18n()
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2', className)}>
      <CategoryDot id={id} />
      <span className="truncate">{t(`category.${id}`)}</span>
    </span>
  )
}

/** Signed money; incoming amounts are tinted, outgoing stay in ink for calm tables. */
export function Money({
  amount,
  currency = 'TRY',
  signed = false,
  tint = false,
  decimals,
  className,
}: {
  amount: number
  currency?: CurrencyCode
  signed?: boolean
  tint?: boolean
  decimals?: 0 | 2
  className?: string
}) {
  const { f } = useI18n()
  const options = decimals === undefined ? { signed } : { signed, decimals }
  return <span className={cx('tnum', tint && amount > 0 && 'text-positive', className)}>{f.money(amount, currency, options)}</span>
}

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string | null
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink-2">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon aria-hidden className="size-5" />
      </span>
      {title && <p className="font-semibold text-ink">{title}</p>}
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/** Radio group styled as a segmented control (arrow keys move between options natively). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: Size
  className?: string
}) {
  const name = useId()
  return (
    <fieldset className={cx('inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const Icon = o.icon
        return (
          <label
            key={o.value}
            className={cx(
              'relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-semibold text-ink-2 transition-colors select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[0.8125rem]',
              value === o.value ? 'bg-surface text-ink shadow-card' : 'hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {Icon && <Icon aria-hidden className="size-3.5" />}
            {o.label}
          </label>
        )
      })}
    </fieldset>
  )
}

/** Thin progress meter; `marker` draws the "expected by today" tick. */
export function Meter({
  value,
  max,
  tone,
  marker,
  label,
}: {
  value: number
  max: number
  tone: 'ok' | 'warning' | 'danger'
  marker?: number
  label: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const markerPct = marker !== undefined && max > 0 ? Math.min(100, (marker / max) * 100) : undefined
  const fill = tone === 'danger' ? 'bg-negative' : tone === 'warning' ? 'bg-warning' : 'bg-accent'
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(Math.min(value, max))}
      className="relative h-2 w-full overflow-visible rounded-full bg-surface-3"
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
      {markerPct !== undefined && (
        <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink/70" style={{ left: `calc(${markerPct}% - 1px)` }} />
      )}
    </div>
  )
}
