import { Lock, RotateCcw, Trash } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Preferences } from '../../app/AppShell'
import { useData } from '../../app/data'
import { useToast } from '../../app/toast'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, Card, PageHeader } from '../../components/ui'
import { clearAllData, resetToSampleData, saveFxRate } from '../../db/repo'
import { fxRateSchema } from '../../domain/schemas'
import type { FxRate } from '../../domain/types'
import { useI18n } from '../../i18n/context'

export function SettingsPage() {
  const { t, f } = useI18n()
  const { notify } = useToast()
  const { fxRates, transactions, rules, accounts } = useData()
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card title={t('settings.appearance')} subtitle={t('settings.appearanceHint')}>
            <Preferences stacked={false} />
          </Card>

          <Card title={t('settings.data.title')}>
            <p className="flex gap-2 text-sm leading-relaxed text-ink-2">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              {t('settings.data.privacy')}
            </p>
            <p className="tnum mt-3 text-xs text-ink-3">
              {t('settings.data.stats', { transactions: f.number(transactions.length), rules: rules.length, accounts: accounts.length })}
            </p>
            <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xs text-sm text-ink-2">{t('settings.data.resetHint')}</p>
                <Button icon={RotateCcw} onClick={() => setConfirm('reset')}>
                  {t('settings.data.reset')}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xs text-sm text-ink-2">{t('settings.data.clearHint')}</p>
                <Button variant="danger" icon={Trash} onClick={() => setConfirm('clear')}>
                  {t('settings.data.clear')}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card title={t('settings.fx.title')} subtitle={t('settings.fx.hint')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="py-2 font-semibold">
                  {t('common.month')}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t('settings.fx.usd')}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t('settings.fx.eur')}
                </th>
              </tr>
            </thead>
            <tbody>
              {fxRates.map((rate) => (
                <RateRow key={rate.month} rate={rate} />
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'clear' ? t('settings.data.clear') : t('settings.data.reset')}
        body={confirm === 'clear' ? t('settings.data.clearConfirm') : t('settings.data.resetConfirm')}
        confirmLabel={t('settings.data.confirm')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm === 'clear' ? clearAllData : resetToSampleData
          const done = confirm === 'clear' ? t('settings.data.clearDone') : t('settings.data.resetDone')
          void action().then(() => notify({ message: done, tone: 'success' }))
        }}
      />
    </>
  )
}

function RateRow({ rate }: { rate: FxRate }) {
  const { t, f } = useI18n()
  const { notify } = useToast()
  const [usd, setUsd] = useState(String(rate.USD))
  const [eur, setEur] = useState(String(rate.EUR))
  const [invalid, setInvalid] = useState(false)
  const dirty = usd !== String(rate.USD) || eur !== String(rate.EUR)

  const save = (e?: FormEvent) => {
    e?.preventDefault()
    if (!dirty) return
    const parsed = fxRateSchema.safeParse({ month: rate.month, USD: Number(usd.replace(',', '.')), EUR: Number(eur.replace(',', '.')) })
    if (!parsed.success) {
      setInvalid(true)
      notify({ message: t('settings.fx.invalid'), tone: 'danger' })
      return
    }
    setInvalid(false)
    void saveFxRate(parsed.data).then(() => notify({ message: t('settings.fx.saved', { month: f.month(rate.month) }), tone: 'success' }))
  }

  const input = (label: string, value: string, set: (v: string) => void) => (
    <input
      aria-label={`${label} · ${f.month(rate.month)}`}
      aria-invalid={invalid}
      className="field field-sm tnum w-full max-w-[7.5rem]"
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={() => save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save()
      }}
    />
  )

  return (
    <tr className="border-b border-line/70 last:border-0">
      <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink capitalize">
        {f.month(rate.month)}
      </th>
      <td className="py-1.5 pr-3">{input(t('settings.fx.usd'), usd, setUsd)}</td>
      <td className="py-1.5">{input(t('settings.fx.eur'), eur, setEur)}</td>
    </tr>
  )
}
