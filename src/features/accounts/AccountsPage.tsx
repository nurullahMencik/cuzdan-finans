import { ArrowRight, Coins, CreditCard, Landmark, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useData } from '../../app/data'
import { useToast } from '../../app/toast'
import { Badge, Button, ButtonLink, Field, PageHeader } from '../../components/ui'
import { newId, saveAccount } from '../../db/repo'
import { accountFormSchema } from '../../domain/schemas'
import type { Account, AccountType, CurrencyCode } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { rateFor } from '../../lib/fx'

const ICONS: Record<AccountType, typeof Landmark> = { checking: Landmark, credit: CreditCard, fx: Coins }

interface AccountStats {
  balance: number
  monthIn: number
  monthOut: number
  count: number
  lastDate: string | null
}

export function AccountsPage() {
  const { t, f } = useI18n()
  const { accounts, transactions, rateTable, today } = useData()
  const month = today.slice(0, 7)

  const stats = useMemo(() => {
    const map = new Map<string, AccountStats>()
    for (const a of accounts) map.set(a.id, { balance: a.openingBalance, monthIn: 0, monthOut: 0, count: 0, lastDate: null })
    for (const tx of transactions) {
      const s = map.get(tx.accountId)
      if (!s) continue
      s.balance += tx.amount
      s.count++
      if (!s.lastDate || tx.date > s.lastDate) s.lastDate = tx.date
      if (tx.date.startsWith(month)) {
        if (tx.amount > 0) s.monthIn += tx.amount
        else s.monthOut -= tx.amount
      }
    }
    return map
  }, [accounts, transactions, month])

  const netWorth = accounts.reduce((sum, a) => sum + (stats.get(a.id)?.balance ?? 0) * rateFor(a.currency, month, rateTable), 0)

  return (
    <>
      <PageHeader title={t('accounts.title')} subtitle={t('accounts.subtitle')} />
      <section className="card mb-4 flex flex-wrap items-end justify-between gap-4 p-5" aria-labelledby="networth">
        <div>
          <h2 id="networth" className="text-xs font-semibold text-ink-3">
            {t('accounts.total')}
          </h2>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{f.money(netWorth, 'TRY', { decimals: 0 })}</p>
          <p className="mt-1 text-xs text-ink-3">{t('accounts.totalHint')}</p>
        </div>
        <ButtonLink to="/settings" variant="ghost" size="sm">
          {t('accounts.editRates')}
          <ArrowRight aria-hidden className="size-3.5" />
        </ButtonLink>
      </section>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} stats={stats.get(a.id)} rate={rateFor(a.currency, month, rateTable)} />
        ))}
      </ul>

      <AddAccount />
    </>
  )
}

function AccountCard({ account: a, stats, rate }: { account: Account; stats: AccountStats | undefined; rate: number }) {
  const { t, f } = useI18n()
  const Icon = ICONS[a.type]
  const balance = stats?.balance ?? a.openingBalance
  return (
    <li className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
            <Icon aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-ink">{a.name}</h2>
            <p className="text-xs text-ink-3">{t(`accountType.${a.type}`)}</p>
          </div>
        </div>
        <Badge>{a.currency}</Badge>
      </div>
      <div>
        <p className="text-xs font-semibold text-ink-3">{t('accounts.balance')}</p>
        <p className={`mt-0.5 text-2xl font-bold tracking-tight ${balance < 0 ? 'text-negative' : 'text-ink'}`}>{f.money(balance, a.currency)}</p>
        {a.currency !== 'TRY' && (
          <p className="tnum text-sm text-ink-3">
            {t('accounts.inTry', { amount: f.money(balance * rate, 'TRY', { decimals: 0 }) })} · {t('accounts.rate', { currency: a.currency, rate: f.number(rate, 2) })}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs text-ink-3">{t('accounts.monthIn')}</dt>
          <dd className="tnum font-semibold text-positive">{f.money(stats?.monthIn ?? 0, a.currency, { decimals: 0 })}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('accounts.monthOut')}</dt>
          <dd className="tnum font-semibold text-ink">{f.money(stats?.monthOut ?? 0, a.currency, { decimals: 0 })}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-ink-3">
        <span>
          {t('accounts.txCount', { count: stats?.count ?? 0 })} ·{' '}
          {stats?.lastDate ? t('accounts.lastActivity', { date: f.date(stats.lastDate, 'd MMM') }) : t('accounts.noActivity')}
        </span>
        <Link to={`/transactions?account=${a.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-soft-ink hover:underline">
          {t('accounts.viewTransactions')}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </li>
  )
}

function AddAccount() {
  const { t } = useI18n()
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [currency, setCurrency] = useState<CurrencyCode>('TRY')
  const [opening, setOpening] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = accountFormSchema.safeParse({ name, type, currency, openingBalance: Number(opening.replace(',', '.')) })
    if (!parsed.success) {
      setError(t('accounts.form.nameRequired'))
      return
    }
    setError(null)
    void saveAccount({ ...parsed.data, id: newId('acc'), createdAt: new Date().toISOString() }).then(() => {
      notify({ message: t('accounts.added', { name: parsed.data.name }), tone: 'success' })
      setName('')
      setOpening('0')
    })
  }

  return (
    <form onSubmit={submit} noValidate className="card mt-4 p-5" aria-labelledby="add-account">
      <h2 id="add-account" className="font-bold text-ink">
        {t('accounts.add')}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <Field label={t('accounts.form.name')} error={error}>
          {({ id, describedBy, invalid }) => (
            <input id={id} className="field" value={name} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={t('accounts.form.type')}>
          {({ id }) => (
            <select id={id} className="field" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {(['checking', 'credit', 'fx'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`accountType.${v}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('accounts.form.currency')}>
          {({ id }) => (
            <select id={id} className="field" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
              {(['TRY', 'USD', 'EUR'] as const).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('accounts.form.opening')}>
          {({ id }) => <input id={id} className="field tnum" type="number" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" icon={Plus}>
          {t('accounts.add')}
        </Button>
      </div>
    </form>
  )
}
