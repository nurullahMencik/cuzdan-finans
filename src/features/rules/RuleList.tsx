import { GripVertical, Pencil, Trash } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cx } from '../../components/classes'
import { Badge, CategoryLabel, IconButton } from '../../components/ui'
import type { Rule } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { useRuleText } from './ruleText'

interface Props {
  rules: readonly Rule[]
  matchCounts: ReadonlyMap<string, number>
  selectedId: string | null
  onReorder: (orderedIds: string[], moved: Rule, position: number) => void
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
  onToggle: (rule: Rule) => void
}

interface DragState {
  id: string
  pointerId: number
  startY: number
  y: number
  fromIndex: number
  /** Slot geometry captured when the drag started. */
  slots: { top: number; mid: number }[]
  baseOrder: string[]
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * Priority list. Reorder by dragging the handle (mouse, pen or touch via
 * pointer events) or by focusing the handle and pressing ↑ / ↓.
 */
export function RuleList({ rules, matchCounts, selectedId, onReorder, onEdit, onDelete, onToggle }: Props) {
  const { t } = useI18n()
  const describe = useRuleText()
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const handleRefs = useRef(new Map<string, HTMLButtonElement>())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)

  const byId = new Map(rules.map((r) => [r.id, r]))
  const ids = rules.map((r) => r.id)

  let order = ids
  let targetIndex = -1
  if (drag) {
    const index = drag.slots.findIndex((s) => drag.y < s.mid)
    targetIndex = index === -1 ? drag.slots.length - 1 : index
    order = move(drag.baseOrder, drag.fromIndex, targetIndex)
  }

  // Keep keyboard focus on the moved rule's handle after it re-renders in its new slot.
  useEffect(() => {
    if (focusId) handleRefs.current.get(focusId)?.focus()
  }, [focusId, rules])

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const slots = ids.map((rid) => {
      const rect = itemRefs.current.get(rid)?.getBoundingClientRect()
      return { top: rect?.top ?? 0, mid: rect ? rect.top + rect.height / 2 : 0 }
    })
    setDrag({ id, pointerId: e.pointerId, startY: e.clientY, y: e.clientY, fromIndex: ids.indexOf(id), slots, baseOrder: ids })
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    setDrag({ ...drag, y: e.clientY })
  }

  const finish = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const moved = byId.get(drag.id)
    setDrag(null)
    if (moved && targetIndex !== drag.fromIndex) onReorder(order, moved, targetIndex + 1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, rule: Rule, index: number) => {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    e.preventDefault()
    const to = index + delta
    if (to < 0 || to >= ids.length) return
    setFocusId(rule.id)
    setAnnouncement(t('rules.moved', { rule: describe(rule), position: to + 1 }))
    onReorder(move(ids, index, to), rule, to + 1)
  }

  return (
    <>
      <ol aria-label={t('rules.listLabel')} className="flex flex-col gap-2">
        {order.map((id, index) => {
          const rule = byId.get(id)
          if (!rule) return null
          const dragging = drag?.id === id
          const offset = dragging && drag ? drag.y - drag.startY - ((drag.slots[targetIndex]?.top ?? 0) - (drag.slots[drag.fromIndex]?.top ?? 0)) : 0
          const count = matchCounts.get(id) ?? 0
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) itemRefs.current.set(id, el)
                else itemRefs.current.delete(id)
              }}
              style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
              className={cx(
                'card relative flex items-center gap-2 py-2.5 pr-2 pl-1.5 sm:gap-3 sm:pr-3',
                dragging ? 'z-10 shadow-pop ring-2 ring-accent' : drag && 'transition-transform',
                selectedId === id && !dragging && 'ring-2 ring-accent/60',
              )}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) handleRefs.current.set(id, el)
                  else handleRefs.current.delete(id)
                }}
                aria-label={t('rules.dragHandle', { rule: describe(rule) })}
                className={cx('grid size-9 shrink-0 touch-none place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink', dragging ? 'cursor-grabbing' : 'cursor-grab')}
                onPointerDown={(e) => onPointerDown(e, id)}
                onPointerMove={onPointerMove}
                onPointerUp={finish}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => onKeyDown(e, rule, index)}
                onBlur={() => setFocusId((current) => (current === id ? null : current))}
              >
                <GripVertical aria-hidden className="size-4" />
              </button>
              <span className="tnum w-6 shrink-0 text-center text-xs font-bold text-ink-3">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate font-mono text-[0.8125rem]', rule.enabled ? 'text-ink' : 'text-ink-3 line-through')} title={describe(rule)}>
                  {describe(rule)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                  <span aria-hidden>→</span>
                  <CategoryLabel id={rule.categoryId} className="font-semibold text-ink-2" />
                  <span>· {t('rules.matchCount', { count })}</span>
                  <Badge tone={rule.origin === 'learned' ? 'accent' : 'neutral'}>{t(`rules.origin.${rule.origin}`)}</Badge>
                  {!rule.enabled && <Badge tone="warning">{t('rules.disabled')}</Badge>}
                </p>
              </div>
              <Switch checked={rule.enabled} label={`${t('rules.enabled')}: ${describe(rule)}`} onChange={() => onToggle(rule)} />
              <IconButton size="sm" icon={Pencil} label={`${t('common.edit')}: ${describe(rule)}`} onClick={() => onEdit(rule)} />
              <IconButton size="sm" icon={Trash} label={`${t('common.delete')}: ${describe(rule)}`} onClick={() => onDelete(rule)} />
            </li>
          )
        })}
      </ol>
      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>
    </>
  )
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3 ring-1 ring-line-strong')}
    >
      <span className={cx('absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  )
}
