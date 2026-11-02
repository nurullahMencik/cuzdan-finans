import '@fontsource-variable/manrope'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { loadMessages, readStoredLocale } from './i18n/context'

const locale = readStoredLocale()
const messages = await loadMessages(locale)

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing')

createRoot(root).render(
  <StrictMode>
    <App initialLocale={locale} initialMessages={messages} />
  </StrictMode>,
)
