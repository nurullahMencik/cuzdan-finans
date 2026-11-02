import { ArrowLeft, ArrowRight, Check, CircleAlert, Download, FileSpreadsheet, FileUp, RotateCcw } from 'lucide-react'
import { useId, useMemo, useRef, useState, type DragEvent } from 'react'
import { useData } from '../../app/data'
import { cx } from '../../components/classes'
import { Badge, Button, ButtonLink, CategoryLabel, Field, PageHeader } from '../../components/ui'
import { addTransactions, newId } from '../../db/repo'
import { transactionSchema } from '../../domain/schemas'
import type { CategoryId, Transaction } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { decodeBankFile, decodeWith, type TextEncodingName } from '../../lib/csv/encoding'
import { DATE_FORMATS, type DateFormat, type DecimalFormat } from '../../lib/csv/formats'
import { parseCsv } from '../../lib/csv/parse'
import { DELIMITERS, detectDelimiter, detectHeaderRow, guessFormats, guessMapping, NO_COLUMN, type ColumnMapping, type Delimiter } from '../../lib/csv/structure'
import { mappingComplete, useImportPreview, type PreviewItem } from './useImportPreview'

type Stage = 'file' | 'structure' | 'mapping' | 'done'
const STAGES: readonly Stage[] = ['file', 'structure', 'mapping', 'done']
const MAX_BYTES = 10 * 1024 * 1024

interface Loaded {
  fileName: string
  size: number
  bytes: Uint8Array
  text: string
  encoding: TextEncodingName
  delimiter: Delimiter
  rows: string[][]
  headerIndex: number
}

interface Formats {
  mapping: ColumnMapping
  dateFormat: DateFormat | null
  detectedDate: DateFormat | null
  decimalFormat: DecimalFormat
  detectedDecimal: DecimalFormat
}

interface Result {
  importId: string
  accountId: string
  added: number
  duplicates: number
  failed: number
  byCategory: { categoryId: CategoryId; count: number }[]
}

function guessAll(rows: string[][], headerIndex: number): Formats {
  const header = rows[headerIndex] ?? []
  const data = rows.slice(headerIndex + 1)
  const mapping = guessMapping(header, data)
  const { dateFormat, decimalFormat } = guessFormats(data, mapping)
  return { mapping, dateFormat, detectedDate: dateFormat, decimalFormat, detectedDecimal: decimalFormat }
}

export function ImportPage() {
  const { t } = useI18n()
  const { accounts } = useData()
  const [stage, setStage] = useState<Stage>('file')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [formats, setFormats] = useState<Formats | null>(null)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const readFile = async (file: File) => {
    setError(null)
    if (file.size > MAX_BYTES) return setError(t('import.error.tooLarge'))
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const decoded = decodeBankFile(bytes)
      const delimiter = detectDelimiter(decoded.text)
      const rows = parseCsv(decoded.text, delimiter)
      if (rows.length < 2) return setError(t('import.error.noData'))
      const headerIndex = detectHeaderRow(rows)
      setLoaded({ fileName: file.name, size: file.size, bytes, text: decoded.text, encoding: decoded.encoding, delimiter, rows, headerIndex })
      setFormats(guessAll(rows, headerIndex))
      setStage('structure')
    } catch {
      setError(t('import.error.read'))
    }
  }

  const reparse = (next: Partial<Pick<Loaded, 'encoding' | 'delimiter' | 'headerIndex'>>) => {
    if (!loaded) return
    const encoding = next.encoding ?? loaded.encoding
    const text = encoding === loaded.encoding ? loaded.text : decodeWith(loaded.bytes, encoding)
    const delimiter = next.delimiter ?? loaded.delimiter
    const rows = text === loaded.text && delimiter === loaded.delimiter ? loaded.rows : parseCsv(text, delimiter)
    const headerIndex = next.headerIndex ?? (rows === loaded.rows ? loaded.headerIndex : detectHeaderRow(rows))
    setLoaded({ ...loaded, encoding, text, delimiter, rows, headerIndex })
    setFormats(guessAll(rows, headerIndex))
  }

  const restart = () => {
    setStage('file')
    setLoaded(null)
    setFormats(null)
    setResult(null)
    setError(null)
  }

  return (
    <>
      <PageHeader title={t('import.title')} subtitle={t('import.subtitle')} />
      <Steps stage={stage} />
      {stage === 'file' && <FileStep onFile={(f) => void readFile(f)} error={error} />}
      {stage === 'structure' && loaded && (
        <StructureStep loaded={loaded} onChange={reparse} onBack={restart} onNext={() => setStage('mapping')} />
      )}
      {stage === 'mapping' && loaded && formats && (
        <MappingStep
          loaded={loaded}
          formats={formats}
          setFormats={setFormats}
          accountId={accountId}
          setAccountId={setAccountId}
          onBack={() => setStage('structure')}
          onDone={(r) => {
            setResult(r)
            setStage('done')
          }}
        />
      )}
      {stage === 'done' && result && <DoneStep result={result} onAgain={restart} />}
    </>
  )
}

function Steps({ stage }: { stage: Stage }) {
  const { t } = useI18n()
  const current = STAGES.indexOf(stage)
  const labels: Record<Stage, string> = {
    file: t('import.step.file'),
    structure: t('import.step.structure'),
    mapping: t('import.step.mapping'),
    done: t('import.step.done'),
  }
  return (
    <ol aria-label={t('import.steps')} className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STAGES.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className="flex items-center gap-2">
          <span
            className={cx(
              'grid size-6 place-items-center rounded-full text-xs font-bold',
              i < current ? 'bg-accent text-accent-ink' : i === current ? 'bg-ink text-page' : 'bg-surface-3 text-ink-3',
            )}
          >
            {i < current ? <Check aria-hidden className="size-3.5" /> : i + 1}
          </span>
          <span className={cx('font-semibold', i === current ? 'text-ink' : 'text-ink-3')}>{labels[s]}</span>
          {i < STAGES.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-line-strong sm:w-10" />}
        </li>
      ))}
    </ol>
  )
}

function FileStep({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const { t } = useI18n()
  const inputId = useId()
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx(
          'card flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-14 text-center transition-colors',
          over ? 'border-accent bg-accent-soft/50' : 'border-line-strong',
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
          <FileUp aria-hidden className="size-6" />
        </span>
        <p className="text-lg font-bold text-ink">{t('import.drop.title')}</p>
        <p className="text-sm text-ink-3">{t('import.drop.or')}</p>
        <input
          id={inputId}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          aria-label={t('import.drop.input')}
          className="peer sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
        <label
          htmlFor={inputId}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-ink shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus hover:bg-accent-hover"
        >
          {t('import.drop.browse')}
        </label>
        <p className="max-w-md text-xs text-ink-3">{t('import.drop.hint')}</p>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-negative">
            <CircleAlert aria-hidden className="size-4" />
            {error}
          </p>
        )}
      </div>
      <aside className="card flex flex-col gap-3 p-5" aria-labelledby="sample-title">
        <FileSpreadsheet aria-hidden className="size-6 text-accent" />
        <h2 id="sample-title" className="font-bold text-ink">
          {t('import.sample.title')}
        </h2>
        <p className="text-sm text-ink-2">{t('import.sample.body')}</p>
        <a
          href={`${import.meta.env.BASE_URL}ornek-ekstre.csv`}
          download="ornek-ekstre.csv"
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink shadow-card hover:bg-surface-2"
        >
          <Download aria-hidden className="size-4" />
          {t('import.sample.download')}
        </a>
      </aside>
    </div>
  )
}

function FileInfo({ loaded }: { loaded: Loaded }) {
  const { t, f } = useI18n()
  return (
    <p className="flex items-center gap-2 text-sm text-ink-2">
      <FileSpreadsheet aria-hidden className="size-4 text-ink-3" />
      {t('import.file', { name: loaded.fileName, size: `${f.number(loaded.size / 1024, 1)} KB` })}
    </p>
  )
}

function StructureStep({
  loaded,
  onChange,
  onBack,
  onNext,
}: {
  loaded: Loaded
  onChange: (next: Partial<Pick<Loaded, 'encoding' | 'delimiter' | 'headerIndex'>>) => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useI18n()
  const visible = loaded.rows.slice(0, Math.max(12, loaded.headerIndex + 6))
  const columns = Math.min(6, Math.max(...visible.map((r) => r.length)))
  return (
    <div className="flex flex-col gap-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,12rem))] sm:items-end">
        <div>
          <FileInfo loaded={loaded} />
          <p className="mt-1 text-xs text-ink-3">
            {t('import.detected.rows')}: {loaded.rows.length} · {t('import.detected.auto')}
          </p>
        </div>
        <Field label={t('import.detected.encoding')}>
          {({ id }) => (
            <select id={id} className="field" value={loaded.encoding} onChange={(e) => onChange({ encoding: e.target.value as TextEncodingName })}>
              <option value="utf-8">UTF-8</option>
              <option value="windows-1254">Windows-1254 (Türkçe)</option>
            </select>
          )}
        </Field>
        <Field label={t('import.detected.delimiter')}>
          {({ id }) => (
            <select id={id} className="field" value={loaded.delimiter} onChange={(e) => onChange({ delimiter: e.target.value as Delimiter })}>
              {DELIMITERS.map((d) => (
                <option key={d} value={d}>
                  {t(`import.delimiter.${d}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <fieldset className="card overflow-hidden">
        <legend className="sr-only">{t('import.header.title')}</legend>
        <div className="px-5 pt-4">
          <p className="font-bold text-ink" aria-hidden>
            {t('import.header.title')}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{t('import.header.hint')}</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.8125rem]">
            <tbody>
              {visible.map((row, i) => {
                const selected = i === loaded.headerIndex
                return (
                  <tr key={i} className={cx('border-t border-line', selected ? 'bg-accent-soft/70 font-semibold' : i < loaded.headerIndex ? 'text-ink-3' : '')}>
                    <td className="w-28 py-2 pr-2 pl-5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs whitespace-nowrap text-ink-2">
                        <input type="radio" name="header-row" checked={selected} onChange={() => onChange({ headerIndex: i })} className="accent-[var(--accent)]" />
                        {t('import.header.row', { number: i + 1 })}
                      </label>
                    </td>
                    {Array.from({ length: columns }, (_, c) => (
                      <td key={c} className="max-w-[16rem] truncate px-2 py-2">
                        {row[c] ?? ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
          {t('import.change')}
        </Button>
        <Button variant="primary" onClick={onNext}>
          {t('common.continue')}
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function MappingStep({
  loaded,
  formats,
  setFormats,
  accountId,
  setAccountId,
  onBack,
  onDone,
}: {
  loaded: Loaded
  formats: Formats
  setFormats: (f: Formats) => void
  accountId: string
  setAccountId: (id: string) => void
  onBack: () => void
  onDone: (result: Result) => void
}) {
  const { t, f } = useI18n()
  const { accounts } = useData()
  const [saving, setSaving] = useState(false)
  const header = useMemo(() => loaded.rows[loaded.headerIndex] ?? [], [loaded])
  const dataRows = useMemo(() => loaded.rows.slice(loaded.headerIndex + 1), [loaded])
  const { mapping } = formats
  const preview = useImportPreview(dataRows, mapping, formats.dateFormat, formats.decimalFormat, accountId)
  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, error: 0 }
    for (const item of preview ?? []) c[item.status]++
    return c
  }, [preview])
  const submitted = useRef(false)

  const setMapping = (patch: Partial<ColumnMapping>) => setFormats({ ...formats, mapping: { ...mapping, ...patch } })
  const columnSelect = (key: 'date' | 'description' | 'amount' | 'debit' | 'credit', label: string) => (
    <Field label={label}>
      {({ id }) => (
        <select id={id} className="field" value={mapping[key]} onChange={(e) => setMapping({ [key]: Number(e.target.value) })}>
          <option value={NO_COLUMN}>{t('common.notSelected')}</option>
          {header.map((h, i) => (
            <option key={i} value={i}>
              {h || `#${i + 1}`}
            </option>
          ))}
        </select>
      )}
    </Field>
  )

  const submit = async () => {
    if (!preview || submitted.current) return
    submitted.current = true
    setSaving(true)
    const importId = newId('import')
    const fresh: Transaction[] = preview
      .filter((p): p is Extract<PreviewItem, { tx: unknown }> => p.status === 'new')
      .map((p) => transactionSchema.parse({ ...p.tx, id: newId('tx'), importId }))
    await addTransactions(fresh, {
      id: importId,
      fileName: loaded.fileName,
      accountId,
      importedAt: new Date().toISOString(),
      added: fresh.length,
      duplicates: counts.duplicate,
      failed: counts.error,
    })
    const byCategory = new Map<CategoryId, number>()
    for (const tx of fresh) byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + 1)
    onDone({
      importId,
      accountId,
      added: fresh.length,
      duplicates: counts.duplicate,
      failed: counts.error,
      byCategory: [...byCategory].map(([categoryId, count]) => ({ categoryId, count })).sort((a, b) => b.count - a.count),
    })
  }

  // Problems first, so a broken row is never hidden below the fold.
  const shown = [...(preview ?? []).filter((p) => p.status !== 'new'), ...(preview ?? []).filter((p) => p.status === 'new')].slice(0, 12)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="card flex flex-col gap-4 p-5">
          <h2 className="font-bold text-ink">{t('import.mapping.title')}</h2>
          {columnSelect('date', t('import.mapping.date'))}
          {columnSelect('description', t('import.mapping.description'))}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">{t('import.mapping.amountMode')}</legend>
            {(['single', 'split'] as const).map((mode) => (
              <label
                key={mode}
                className={cx(
                  'flex cursor-pointer gap-3 rounded-xl border p-3 text-sm',
                  mapping.amountMode === mode ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-line-strong',
                )}
              >
                <input type="radio" name="amount-mode" checked={mapping.amountMode === mode} onChange={() => setMapping({ amountMode: mode })} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  <span className="block font-semibold text-ink">{t(`import.mapping.${mode}`)}</span>
                  <span className="block text-xs text-ink-3">{t(`import.mapping.${mode}Hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {mapping.amountMode === 'single' ? (
            columnSelect('amount', t('import.mapping.amount'))
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {columnSelect('debit', t('import.mapping.debit'))}
              {columnSelect('credit', t('import.mapping.credit'))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('import.format.date')}
              hint={formats.detectedDate ? `${t('import.format.detected')}: ${formats.detectedDate}` : t('import.format.notDetected')}
            >
              {({ id, describedBy }) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className="field"
                  value={formats.dateFormat ?? ''}
                  onChange={(e) => setFormats({ ...formats, dateFormat: (e.target.value || null) as DateFormat | null })}
                >
                  <option value="">—</option>
                  {DATE_FORMATS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('import.format.decimal')} hint={`${t('import.format.detected')}: ${t(`import.format.decimal.${formats.detectedDecimal}`)}`}>
              {({ id, describedBy }) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className="field"
                  value={formats.decimalFormat}
                  onChange={(e) => setFormats({ ...formats, decimalFormat: e.target.value as DecimalFormat })}
                >
                  <option value="tr">{t('import.format.decimal.tr')}</option>
                  <option value="en">{t('import.format.decimal.en')}</option>
                </select>
              )}
            </Field>
          </div>
          <Field label={t('import.account')}>
            {({ id }) => (
              <select id={id} className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <section className="card min-w-0" aria-labelledby="preview-title">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <h2 id="preview-title" className="font-bold text-ink">
              {t('import.preview.title')}
            </h2>
            {preview && (
              <p className="text-sm text-ink-2" data-testid="import-summary">
                {t('import.preview.summary', { ready: counts.new, duplicates: counts.duplicate, errors: counts.error })}
              </p>
            )}
          </div>
          {!preview ? (
            <p role="alert" className="flex items-center gap-2 px-5 py-8 text-sm text-warning">
              <CircleAlert aria-hidden className="size-4" />
              {t('import.error.mapping')}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-y border-line bg-surface-2/70 text-ink-3">
                    <th scope="col" className="py-2 pr-2 pl-5 font-semibold">
                      {t('import.preview.status')}
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      {t('tx.col.date')}
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      {t('tx.col.description')}
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold">
                      {t('tx.col.category')}
                    </th>
                    <th scope="col" className="py-2 pr-5 pl-2 text-right font-semibold">
                      {t('tx.col.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) =>
                    item.status === 'error' ? (
                      <tr key={item.line} className="border-b border-line/70">
                        <td className="py-2 pr-2 pl-5">
                          <Badge tone="danger">{t('import.status.error')}</Badge>
                        </td>
                        <td colSpan={4} className="truncate px-2 py-2 pr-5 text-ink-3">
                          {t(`import.error.${item.reason}`)} · <span className="font-mono text-xs">{item.raw}</span>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.line} className={cx('border-b border-line/70', item.status === 'duplicate' && 'text-ink-3')}>
                        <td className="py-2 pr-2 pl-5">
                          <Badge tone={item.status === 'new' ? 'positive' : 'neutral'}>{t(`import.status.${item.status}`)}</Badge>
                        </td>
                        <td className="tnum px-2 py-2 whitespace-nowrap">{f.date(item.tx.date, 'd MMM yyyy')}</td>
                        <td className="max-w-[18rem] px-2 py-2">
                          <p className="truncate font-semibold text-ink">{item.tx.merchant}</p>
                          <p className="truncate text-xs text-ink-3">{item.tx.description}</p>
                        </td>
                        <td className="px-2 py-2">
                          <CategoryLabel id={item.tx.categoryId} />
                        </td>
                        <td className={cx('tnum py-2 pr-5 pl-2 text-right font-semibold whitespace-nowrap', item.tx.amount > 0 && 'text-positive')}>
                          {f.money(item.tx.amount, item.tx.currency, { signed: item.tx.amount > 0 })}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {preview.length > shown.length && (
                <p className="px-5 py-3 text-xs text-ink-3">{t('import.preview.more', { count: preview.length - shown.length })}</p>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button variant="primary" disabled={!preview || counts.new === 0 || saving || !mappingComplete(mapping)} onClick={() => void submit()}>
          {counts.new === 0 && preview ? t('import.nothingToImport') : t('import.submit', { count: counts.new })}
        </Button>
      </div>
    </div>
  )
}

function DoneStep({ result, onAgain }: { result: Result; onAgain: () => void }) {
  const { t } = useI18n()
  const { accountsById } = useData()
  const account = accountsById.get(result.accountId)
  return (
    <section className="card mx-auto flex max-w-2xl flex-col gap-5 p-6" aria-labelledby="done-title">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-positive-soft text-positive">
          <Check aria-hidden className="size-6" />
        </span>
        <div>
          <h2 id="done-title" className="text-lg font-bold text-ink">
            {t('import.result.title')}
          </h2>
          {account && <p className="text-sm text-ink-3">{t('import.result.account', { account: account.name })}</p>}
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl bg-positive-soft p-4 text-positive">
          <p className="text-sm font-bold" data-testid="import-added">
            {t('import.result.added', { count: result.added })}
          </p>
        </li>
        <li className="rounded-xl bg-surface-2 p-4 text-ink-2">
          <p className="text-sm font-bold">{t('import.result.duplicates', { count: result.duplicates })}</p>
        </li>
        <li className={cx('rounded-xl p-4', result.failed > 0 ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-ink-2')}>
          <p className="text-sm font-bold">{t('import.result.failed', { count: result.failed })}</p>
        </li>
      </ul>
      {result.byCategory.length > 0 && (
        <div>
          <p className="eyebrow mb-2">{t('import.result.categories')}</p>
          <ul className="flex flex-wrap gap-2">
            {result.byCategory.map((c) => (
              <li key={c.categoryId} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
                <CategoryLabel id={c.categoryId} />
                <span className="tnum font-bold text-ink">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <ButtonLink to={`/transactions?import=${result.importId}`} variant="primary">
          {t('import.result.view')}
        </ButtonLink>
        <Button icon={RotateCcw} onClick={onAgain}>
          {t('import.result.another')}
        </Button>
      </div>
    </section>
  )
}
