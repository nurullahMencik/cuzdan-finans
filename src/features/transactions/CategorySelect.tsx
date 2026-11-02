import { CATEGORIES } from '../../domain/categories'
import type { CategoryId, CategoryKind } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { cx } from '../../components/classes'

const KINDS: readonly CategoryKind[] = ['expense', 'income', 'transfer']

interface Props {
  value: CategoryId | ''
  onChange: (id: CategoryId) => void
  label: string
  id?: string
  className?: string
  placeholder?: string
  size?: 'sm' | 'md'
}

/** Native select grouped by kind: accessible, keyboard-friendly and fast in a long list. */
export function CategorySelect({ value, onChange, label, id, className, placeholder, size = 'sm' }: Props) {
  const { t } = useI18n()
  return (
    <select
      id={id}
      aria-label={id ? undefined : label}
      value={value}
      onChange={(e) => onChange(e.target.value as CategoryId)}
      className={cx('field', size === 'sm' && 'field-sm', className)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {KINDS.map((kind) => (
        <optgroup key={kind} label={t(`category.kind.${kind}`)}>
          {CATEGORIES.filter((c) => c.kind === kind).map((c) => (
            <option key={c.id} value={c.id}>
              {t(`category.${c.id}`)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
