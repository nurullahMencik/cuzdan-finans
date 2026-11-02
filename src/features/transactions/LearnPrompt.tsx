import { Sparkles, X } from 'lucide-react'
import { Button, IconButton } from '../../components/ui'
import type { CategoryId } from '../../domain/types'
import { useI18n } from '../../i18n/context'

export interface LearnState {
  merchant: string
  categoryId: CategoryId
  affected: number
}

/**
 * Shown after a manual category change: offers to turn the correction into a
 * rule so the same merchant is filed correctly next time.
 */
export function LearnPrompt({ state, onCreate, onDismiss, busy }: { state: LearnState; onCreate: () => void; onDismiss: () => void; busy: boolean }) {
  const { t } = useI18n()
  const category = t(`category.${state.categoryId}`)
  return (
    <div
      role="region"
      aria-labelledby="learn-title"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-pop sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-soft-ink">
          <Sparkles aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="learn-title" className="font-bold text-ink">
            {t('learn.title')}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {t('learn.body', { merchant: state.merchant, category })}{' '}
            {state.affected > 0 ? t('learn.affected', { count: state.affected }) : t('learn.affectedNone')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onCreate} disabled={busy}>
              {t('learn.create')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t('common.notNow')}
            </Button>
          </div>
        </div>
        <IconButton size="sm" icon={X} label={t('common.close')} onClick={onDismiss} />
      </div>
    </div>
  )
}
