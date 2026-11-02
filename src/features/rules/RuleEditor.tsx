import { CircleCheck, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState, type FormEvent } from 'react'
import { useData } from '../../app/data'
import { Button, Field, IconButton, Money, Segmented } from '../../components/ui'
import type { AmountDirection } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { previewRule, validateRule } from '../../lib/rules'
import { CategorySelect } from '../transactions/CategorySelect'
import { toRule, type RuleDraft } from './draft'

interface Props {
  initial: RuleDraft
  onSave: (draft: RuleDraft) => void
  onClose: () => void
  saving: boolean
}

export function RuleEditor({ initial, onSave, onClose, saving }: Props) {
  const { t, f } = useI18n()
  const { transactions, rules } = useData()
  const [draft, setDraft] = useState(initial)
  const [touched, setTouched] = useState(false)
  const deferred = useDeferredValue(draft)
  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const candidate = toRule(draft, rules)
  const error = validateRule(candidate)
  const impact = useMemo(() => {
    const rule = toRule(deferred, rules)
    if (validateRule(rule)) return null
    return previewRule(rule, transactions, rules)
  }, [deferred, rules, transactions])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!error) onSave(draft)
  }
  const shownError = touched && error ? t(`rules.error.${error}`) : null

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5" aria-labelledby="rule-editor-title" noValidate>
      <div className="flex items-center justify-between">
        <h2 id="rule-editor-title" className="font-bold text-ink">
          {draft.id ? t('rules.editTitle') : t('rules.newTitle')}
        </h2>
        <IconButton size="sm" icon={X} label={t('common.close')} onClick={onClose} />
      </div>

      <Segmented
        label={t('rules.type')}
        value={draft.type}
        onChange={(v) => set('type', v)}
        options={[
          { value: 'contains', label: t('rules.type.contains') },
          { value: 'regex', label: t('rules.type.regex') },
          { value: 'amount', label: t('rules.type.amount') },
        ]}
        className="w-full [&>label]:flex-1"
      />

      {draft.type === 'amount' ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('rules.field.min')} error={shownError}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                className="field tnum"
                type="number"
                min={0}
                inputMode="decimal"
                value={draft.min}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(e) => set('min', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('rules.field.max')}>
            {({ id }) => <input id={id} className="field tnum" type="number" min={0} inputMode="decimal" value={draft.max} onChange={(e) => set('max', e.target.value)} />}
          </Field>
        </div>
      ) : (
        <Field
          label={draft.type === 'regex' ? t('rules.field.regex') : t('rules.field.pattern')}
          hint={draft.type === 'regex' ? t('rules.field.regexHint') : undefined}
          error={shownError}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="field font-mono"
              value={draft.pattern}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="off"
              spellCheck={false}
              placeholder={draft.type === 'regex' ? 'MIGROS|A101|\\bBIM\\b' : 'NETFLIX'}
              onChange={(e) => set('pattern', e.target.value)}
            />
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('rules.field.direction')}>
          {({ id }) => (
            <select id={id} className="field" value={draft.direction} onChange={(e) => set('direction', e.target.value as AmountDirection)}>
              <option value="any">{t('rules.direction.any')}</option>
              <option value="expense">{t('rules.direction.expense')}</option>
              <option value="income">{t('rules.direction.income')}</option>
            </select>
          )}
        </Field>
        <Field label={t('rules.field.category')}>
          {({ id }) => <CategorySelect id={id} size="md" label={t('rules.field.category')} value={draft.categoryId} onChange={(v) => set('categoryId', v)} />}
        </Field>
      </div>

      <Field label={t('rules.field.position')}>
        {({ id }) => (
          <select id={id} className="field" value={draft.position} onChange={(e) => set('position', e.target.value as RuleDraft['position'])}>
            {draft.id && <option value="keep">{t('rules.position.keep')}</option>}
            <option value="top">{t('rules.position.top')}</option>
            <option value="bottom">{t('rules.position.bottom')}</option>
          </select>
        )}
      </Field>

      <section aria-labelledby="impact-title" aria-live="polite" className="rounded-xl border border-line bg-surface-2/60 p-4">
        <h3 id="impact-title" className="eyebrow">
          {t('rules.preview.title')}
        </h3>
        {impact === null || impact.matches === 0 ? (
          <p className="mt-2 text-sm text-ink-2">{t('rules.preview.none')}</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-semibold text-ink">{t('rules.preview.matches', { count: f.number(impact.matches) })}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
              <CircleCheck aria-hidden className="size-4 text-accent" />
              <span data-testid="rule-impact-changes">{t('rules.preview.changes', { count: f.number(impact.changes) })}</span>
            </p>
            {impact.manualKept > 0 && <p className="mt-1 text-xs text-ink-3">{t('rules.preview.manual', { count: impact.manualKept })}</p>}
            {impact.sample.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-ink-3">{t('rules.preview.sample')}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {impact.sample.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-ink-2">
                        {tx.merchant} <span className="text-ink-3">· {t(`category.${tx.categoryId}`)}</span>
                      </span>
                      <Money amount={tx.amount} currency={tx.currency} className="shrink-0 text-ink-2" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
