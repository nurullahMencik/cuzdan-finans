import {
  ArrowLeftRight,
  CalendarClock,
  FileUp,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  PiggyBank,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import type { MessageKey } from '../i18n/tr'

export interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
  group: 'analyse' | 'manage'
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'nav.overview', icon: LayoutDashboard, group: 'analyse' },
  { to: '/transactions', label: 'nav.transactions', icon: ArrowLeftRight, group: 'analyse' },
  { to: '/budgets', label: 'nav.budgets', icon: PiggyBank, group: 'analyse' },
  { to: '/subscriptions', label: 'nav.subscriptions', icon: CalendarClock, group: 'analyse' },
  { to: '/rules', label: 'nav.rules', icon: ListOrdered, group: 'manage' },
  { to: '/import', label: 'nav.import', icon: FileUp, group: 'manage' },
  { to: '/accounts', label: 'nav.accounts', icon: Landmark, group: 'manage' },
  { to: '/settings', label: 'nav.settings', icon: SlidersHorizontal, group: 'manage' },
]
