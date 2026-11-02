import { createBrowserRouter, RouterProvider } from 'react-router'
import { OverviewPage } from '../features/overview/OverviewPage'
import type { Locale } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Messages } from '../i18n/tr'
import { AppShell } from './AppShell'
import { DataProvider } from './DataProvider'
import { ErrorPage, NotFoundPage } from './ErrorPage'
import { MonthProvider } from './MonthProvider'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './ToastProvider'

const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: AppShell,
      ErrorBoundary: ErrorPage,
      HydrateFallback: () => null,
      children: [
        { index: true, Component: OverviewPage },
        { path: 'transactions', lazy: { Component: async () => (await import('../features/transactions/TransactionsPage')).TransactionsPage } },
        { path: 'budgets', lazy: { Component: async () => (await import('../features/budgets/BudgetsPage')).BudgetsPage } },
        { path: 'subscriptions', lazy: { Component: async () => (await import('../features/subscriptions/SubscriptionsPage')).SubscriptionsPage } },
        { path: 'rules', lazy: { Component: async () => (await import('../features/rules/RulesPage')).RulesPage } },
        { path: 'import', lazy: { Component: async () => (await import('../features/import/ImportPage')).ImportPage } },
        { path: 'accounts', lazy: { Component: async () => (await import('../features/accounts/AccountsPage')).AccountsPage } },
        { path: 'settings', lazy: { Component: async () => (await import('../features/settings/SettingsPage')).SettingsPage } },
        { path: '*', Component: NotFoundPage },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
)

export function App({ initialLocale, initialMessages }: { initialLocale: Locale; initialMessages: Messages }) {
  return (
    <I18nProvider initialLocale={initialLocale} initialMessages={initialMessages}>
      <ThemeProvider>
        <DataProvider>
          <MonthProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </MonthProvider>
        </DataProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
