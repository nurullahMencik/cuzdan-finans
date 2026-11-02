import { ListOrdered, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../../app/data'
import { useToast } from '../../app/toast'
import { Button, EmptyState, PageHeader } from '../../components/ui'
import { deleteRule, saveRule, saveRuleOrder, setRuleEnabled } from '../../db/repo'
import type { Rule } from '../../domain/types'
import { useI18n } from '../../i18n/context'
import { draftFromRule, EMPTY_DRAFT, toRule, type RuleDraft } from './draft'
import { RuleEditor } from './RuleEditor'
import { RuleList } from './RuleList'

export function RulesPage() {
  const { t } = useI18n()
  const { notify } = useToast()
  const { rules, transactions } = useData()
  const [editing, setEditing] = useState<RuleDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)

  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tx of transactions) if (tx.ruleId) counts.set(tx.ruleId, (counts.get(tx.ruleId) ?? 0) + 1)
    return counts
  }, [transactions])

  // Show the new order immediately while IndexedDB commits and re-categorizes.
  const displayed = useMemo(() => {
    if (!optimisticOrder || optimisticOrder.length !== rules.length) return rules
    const byId = new Map(rules.map((r) => [r.id, r]))
    const list = optimisticOrder.map((id) => byId.get(id))
    return list.every((r): r is Rule => r !== undefined) ? list : rules
  }, [optimisticOrder, rules])

  const reorder = (ids: string[]) => {
    setOptimisticOrder(ids)
    void saveRuleOrder(ids).then((count) => {
      setOptimisticOrder(null)
      notify({ message: t('rules.reordered', { count }), tone: 'success' })
    })
  }

  const save = (draft: RuleDraft) => {
    setSaving(true)
    void saveRule(toRule(draft, rules))
      .then((count) => {
        notify({ message: t('rules.saved', { count }), tone: 'success' })
        setEditing(null)
      })
      .finally(() => setSaving(false))
  }

  const remove = (rule: Rule) => {
    void deleteRule(rule.id).then((count) =>
      notify({
        message: t('rules.deleted', { count }),
        action: { label: t('common.undo'), onClick: () => void saveRule(rule) },
      }),
    )
  }

  const toggle = (rule: Rule) => {
    void setRuleEnabled(rule.id, !rule.enabled).then((count) => notify({ message: t('rules.toggled', { count }) }))
  }

  return (
    <>
      <PageHeader
        title={t('rules.title')}
        subtitle={t('rules.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing({ ...EMPTY_DRAFT })}>
            {t('rules.new')}
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {displayed.length === 0 ? (
            <div className="card">
              <EmptyState icon={ListOrdered}>{t('rules.empty')}</EmptyState>
            </div>
          ) : (
            <RuleList
              rules={displayed}
              matchCounts={matchCounts}
              selectedId={editing?.id ?? null}
              onReorder={reorder}
              onEdit={(rule) => setEditing(draftFromRule(rule))}
              onDelete={remove}
              onToggle={toggle}
            />
          )}
        </div>
        {editing && (
          <div className="order-first lg:sticky lg:top-6 lg:order-none">
            <RuleEditor key={editing.id ?? 'new'} initial={editing} saving={saving} onSave={save} onClose={() => setEditing(null)} />
          </div>
        )}
      </div>
    </>
  )
}
