import { CircleAlert, Compass } from 'lucide-react'
import { useRouteError } from 'react-router'
import { Button, ButtonLink, EmptyState } from '../components/ui'
import { useI18n } from '../i18n/context'

export function ErrorPage() {
  const { t } = useI18n()
  const error = useRouteError()
  console.error(error)
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState icon={CircleAlert} title={t('app.error.title')}>
        <p>{t('app.error.body')}</p>
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
          {t('app.error.reload')}
        </Button>
      </EmptyState>
    </div>
  )
}

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState icon={Compass} title={t('app.notFound.title')}>
        <p>{t('app.notFound.body')}</p>
        <ButtonLink to="/" variant="primary" className="mt-4">
          {t('app.notFound.home')}
        </ButtonLink>
      </EmptyState>
    </div>
  )
}
