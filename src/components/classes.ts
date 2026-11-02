export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2 shadow-card',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-negative border border-line-strong hover:bg-danger-soft',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[0.8125rem] rounded-lg',
  md: 'h-10 gap-2 px-4 text-sm rounded-[10px]',
}

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    extra,
  )
}
