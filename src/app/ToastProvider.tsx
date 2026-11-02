import { CircleCheck, CircleAlert, Info, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'
import { ToastContext, type ToastApi, type ToastInput } from './toast'

interface ToastItem extends ToastInput {
  id: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const notify = useCallback((toast: ToastInput) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { ...toast, id }])
  }, [])

  const api = useMemo<ToastApi>(() => ({ notify }), [notify])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.action ? 8000 : 4500)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.action, onDismiss])
  const Icon = toast.tone === 'danger' ? CircleAlert : toast.tone === 'success' ? CircleCheck : Info
  const iconColor = toast.tone === 'danger' ? 'text-negative' : toast.tone === 'success' ? 'text-positive' : 'text-ink-3'
  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-pop">
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <p className="min-w-0 flex-1 text-ink">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="shrink-0 font-semibold text-accent-soft-ink hover:underline"
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="-m-1 shrink-0 rounded p-1 text-ink-3 hover:text-ink" onClick={() => onDismiss(toast.id)}>
        <X aria-hidden className="size-4" />
        <span className="sr-only">{t('common.close')}</span>
      </button>
    </div>
  )
}
