import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const OUT = (name: string) => fileURLToPath(new URL(`../../docs/screenshots/${name}`, import.meta.url))
const SAMPLE = fileURLToPath(new URL('../../public/ornek-ekstre.csv', import.meta.url))

// Late in the month: budgets have a forecast and upcoming payments are populated.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T10:00:00+03:00'))
})

async function settle(page: Page) {
  await page.evaluate(async () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    await document.fonts.ready
  })
  // Park the pointer on empty space so no hover state is captured.
  await page.mouse.move(1590, 990)
  await page.waitForTimeout(400)
}

async function open(page: Page, path: string, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => localStorage.setItem('cuzdan.theme', t), theme)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
}

test('01 overview (hero)', async ({ page }) => {
  await open(page, '')
  await expect(page.locator('.recharts-surface')).toHaveCount(3)
  await settle(page)
  await page.screenshot({ path: OUT('01-hero.png') })
})

test('02 transactions with rule suggestion', async ({ page }) => {
  await open(page, 'transactions')
  const search = page.getByLabel('Açıklama veya satıcı ara')
  await search.fill('kuaför')
  await page.getByRole('combobox', { name: 'Kategori: Kuaför Erkan' }).first().selectOption('shopping')
  await expect(page.getByRole('region', { name: 'Bu satıcı için kural oluşturulsun mu?' })).toBeVisible()
  await search.fill('')
  await expect(page.getByText(/Toplam [\d.]+ işlem · [\d.]+ işlem gösteriliyor/)).toBeVisible()
  await settle(page)
  await page.screenshot({ path: OUT('02-transactions.png') })
})

test('03 subscriptions (dark)', async ({ page }) => {
  await open(page, 'subscriptions', 'dark')
  await expect(page.getByRole('tab', { name: /Önerilen/ })).toBeVisible()
  await settle(page)
  await page.screenshot({ path: OUT('03-subscriptions.png') })
})

test('04 import preview', async ({ page }) => {
  await open(page, 'import')
  await page.getByLabel('CSV dosyası seç').setInputFiles(SAMPLE)
  await page.getByRole('button', { name: 'Devam' }).click()
  await expect(page.getByTestId('import-summary')).toBeVisible()
  await settle(page)
  await page.screenshot({ path: OUT('04-import-preview.png') })
})

test('05 budgets', async ({ page }) => {
  await open(page, 'budgets')
  await settle(page)
  await page.screenshot({ path: OUT('05-budgets.png') })
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })

  test('06 overview on a phone', async ({ page }) => {
    await open(page, '')
    await expect(page.locator('.recharts-surface').first()).toBeVisible()
    await settle(page)
    await page.screenshot({ path: OUT('06-mobile.png') })
  })
})
