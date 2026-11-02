import { Lock, Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useMatches } from 'react-router'
import { cx } from '../components/classes'
import { Wordmark } from '../components/Logo'
import { IconButton, Segmented } from '../components/ui'
import { useI18n } from '../i18n/context'
import { useData } from './data'
import { NAV_ITEMS } from './nav'
import { useTheme, type ThemePreference } from './theme'

export function AppShell() {
  const { t } = useI18n()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('app.skip')}
      </a>
      <div className="hidden border-r border-line bg-surface/60 lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col px-4 pt-6 pb-5">
        <div className="px-2">
          <Wordmark />
          <p className="mt-1 pl-[2.375rem] text-xs text-ink-3">{t('app.tagline')}</p>
        </div>
        <Navigation className="mt-8" />
        <div className="mt-auto flex flex-col gap-4">
          <PrivacyNote />
          <Preferences />
        </div>
      </aside>
      </div>
      <div className="min-w-0">
        <MobileBar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-24 outline-none sm:px-6 lg:px-10 lg:pt-9">
          <Gate>
            <Outlet />
          </Gate>
        </main>
      </div>
    </div>
  )
}

/** Pages render only once IndexedDB has answered, so they never flash empty states. */
function Gate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { ready } = useData()
  // Routes flagged `selfLoading` render their own skeleton (the landing page paints its header immediately).
  const selfLoading = useMatches().some((m) => (m.handle as { selfLoading?: boolean } | undefined)?.selfLoading)
  if (!ready && !selfLoading) {
    return (
      <p role="status" className="py-24 text-center text-sm text-ink-3">
        {t('app.loading')}
      </p>
    )
  }
  return <Suspense fallback={null}>{children}</Suspense>
}

function Navigation({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { t } = useI18n()
  const groups = [
    { key: 'analyse' as const, label: t('nav.group.analyse') },
    { key: 'manage' as const, label: t('nav.group.manage') },
  ]
  return (
    <nav aria-label={t('nav.main')} className={cx('flex flex-col gap-6', className)}>
      {groups.map((group) => (
        <div key={group.key}>
          <p className="eyebrow px-3 pb-2">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((item) => item.group === group.key).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'group flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors',
                      isActive ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon aria-hidden className={cx('size-[1.0625rem]', isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2')} />
                      {t(item.label)}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function PrivacyNote() {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="flex items-center gap-2 text-xs font-bold text-ink">
        <Lock aria-hidden className="size-3.5 text-accent" />
        {t('privacy.badge')}
      </p>
      <p className="mt-1 text-[0.6875rem] leading-snug text-ink-3">{t('privacy.hint')}</p>
    </div>
  )
}

export function Preferences({ stacked = true }: { stacked?: boolean }) {
  const { t, locale, setLocale } = useI18n()
  const { preference, setPreference } = useTheme()
  const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: t('theme.system'), icon: Monitor },
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
  ]
  return (
    <div className={cx('flex gap-2', stacked ? 'flex-col' : 'flex-wrap items-center')}>
      <Segmented size="sm" label={t('theme.label')} value={preference} onChange={setPreference} options={themeOptions} className="w-fit" />
      <Segmented
        size="sm"
        label={t('language.label')}
        value={locale}
        onChange={setLocale}
        options={[
          { value: 'tr', label: 'Türkçe' },
          { value: 'en', label: 'English' },
        ]}
        className="w-fit"
      />
    </div>
  )
}

function MobileBar() {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const location = useLocation()

  useEffect(() => {
    dialog.current?.close()
  }, [location.pathname])

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-page/90 px-4 backdrop-blur lg:hidden">
      <Wordmark />
      <IconButton icon={Menu} label={t('nav.openMenu')} onClick={() => dialog.current?.showModal()} />
      <dialog
        ref={dialog}
        aria-label={t('nav.main')}
        className="m-0 ml-auto h-dvh max-h-none w-[min(320px,88vw)] max-w-none border-l border-line bg-page p-0 text-ink shadow-pop backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close()
        }}
      >
        <div className="flex h-full flex-col overflow-y-auto px-4 pt-4 pb-6">
          <div className="flex items-center justify-between">
            <Wordmark />
            <IconButton icon={X} label={t('nav.closeMenu')} onClick={() => dialog.current?.close()} />
          </div>
          <Navigation className="mt-6" onNavigate={() => dialog.current?.close()} />
          <div className="mt-auto flex flex-col gap-4 pt-8">
            <PrivacyNote />
            <Preferences />
          </div>
        </div>
      </dialog>
    </div>
  )
}
