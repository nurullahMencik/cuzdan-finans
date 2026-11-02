import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SAMPLE = fileURLToPath(new URL('../public/ornek-ekstre.csv', import.meta.url))

// Sample data is generated relative to "today"; pinning the clock makes every run identical.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+03:00'))
})

async function openApp(page: Page, path = '') {
  await page.goto(path)
  // The first visit seeds ~2 000 sample transactions into IndexedDB.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
}

async function importSample(page: Page) {
  await openApp(page, 'import')
  await page.getByLabel('CSV dosyası seç').setInputFiles(SAMPLE)
  await expect(page.getByLabel('Kodlama')).toHaveValue('windows-1254')
  await expect(page.getByLabel('Ayraç')).toHaveValue(';')
  await page.getByRole('button', { name: 'Devam' }).click()
}

test.describe('import wizard', () => {
  test('imports the sample statement and skips duplicates on a second run', async ({ page }) => {
    await importSample(page)
    await expect(page.getByLabel('Tarih biçimi')).toHaveValue('dd.MM.yyyy')
    await expect(page.getByLabel('Sayı biçimi')).toHaveValue('tr')
    await expect(page.getByLabel('Hedef hesap')).toHaveValue('acc-checking')
    // Salary and rent on 1-2 Oct are already in the account (same date, amount and
    // normalized description, despite "MAAŞ" vs "MAAS"), so they are flagged.
    await expect(page.getByTestId('import-summary')).toHaveText('28 yeni · 2 mükerrer · 1 hatalı')

    await page.getByRole('button', { name: '28 işlemi içe aktar' }).click()
    await expect(page.getByTestId('import-added')).toHaveText('28 işlem eklendi')

    await page.getByRole('link', { name: 'İşlemleri görüntüle' }).click()
    await expect(page.getByText('28 işlem gösteriliyor')).toBeVisible()
    await page.getByLabel('Açıklama veya satıcı ara').fill('çiçekçilik')
    await expect(page.getByText('Lale Çiçekçilik', { exact: true })).toBeVisible()

    // Same file again: every row is recognised as a duplicate.
    await importSample(page)
    await expect(page.getByTestId('import-summary')).toHaveText('0 yeni · 30 mükerrer · 1 hatalı')
    await expect(page.getByRole('button', { name: 'Eklenecek yeni işlem yok' })).toBeDisabled()
  })
})

test('changing a category offers a rule and applies it to the merchant', async ({ page }) => {
  await openApp(page, 'transactions')
  await page.getByLabel('Açıklama veya satıcı ara').fill('kuaför erkan')
  const selects = page.getByRole('combobox', { name: 'Kategori: Kuaför Erkan' })
  await expect(selects.first()).toBeVisible()
  const rows = await selects.count()
  expect(rows).toBeGreaterThan(1)

  await selects.first().selectOption('shopping')
  const prompt = page.getByRole('region', { name: 'Bu satıcı için kural oluşturulsun mu?' })
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText(`Mevcut ${rows - 1} işlem de güncellenecek.`)
  await prompt.getByRole('button', { name: 'Kural oluştur' }).click()
  await expect(page.getByText(`Kural oluşturuldu · ${rows - 1} işlem güncellendi`)).toBeVisible()

  for (let i = 0; i < rows; i++) await expect(selects.nth(i)).toHaveValue('shopping')

  await page.getByRole('link', { name: 'Kurallar' }).click()
  const first = page.getByRole('list', { name: 'Kurallar, öncelik sırasıyla' }).getByRole('listitem').first()
  await expect(first).toContainText('“Kuaför Erkan” içerir')
  await expect(first).toContainText('Öğrenildi')
})

test('overview renders KPIs and all three charts', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('heading', { name: 'Genel Bakış', level: 1 })).toBeVisible()
  for (const label of ['Gelir', 'Gider', 'Net', 'Tasarruf oranı']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  }
  await expect(page.locator('.recharts-surface')).toHaveCount(3)
  expect(await page.locator('.recharts-bar-rectangle').count()).toBeGreaterThan(20)
  expect(await page.locator('.recharts-pie-sector').count()).toBeGreaterThanOrEqual(3)
  await expect(page.locator('.recharts-area-area')).toHaveCount(1)

  // Every chart has a table twin.
  await page.getByRole('button', { name: 'Tablo görünümü' }).first().click()
  await expect(page.getByRole('columnheader', { name: 'Gelir' })).toBeVisible()
})

test('data persists across reloads', async ({ page }) => {
  await openApp(page, 'budgets')
  await page.getByRole('button', { name: 'Limiti düzenle: Market' }).click()
  await page.getByLabel('Market için aylık limit').fill('22222')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText('Market bütçesi kaydedildi')).toBeVisible()

  await page.locator('label').filter({ hasText: /^Koyu$/ }).first().click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bütçeler', level: 1 })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Market' }).first()).toContainText('₺22.222')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // Sample data seeding happens once; the edited budget is not overwritten.
  await page.goto('transactions')
  await expect(page.getByText(/Toplam [\d.]+ işlem/)).toBeVisible()
  await page.goto('budgets')
  await expect(page.getByRole('listitem').filter({ hasText: 'Market' }).first()).toContainText('₺22.222')
})

test('switches to English and keeps locale formatting', async ({ page }) => {
  await openApp(page)
  await page.locator('label').filter({ hasText: /^English$/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: 'Transactions' }).click()
  await expect(page.getByText(/[\d,]+ transactions in total/)).toBeVisible()
})

test.describe('small screens', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  for (const path of ['', 'transactions', 'budgets', 'subscriptions', 'rules', 'import', 'accounts', 'settings']) {
    test(`no horizontal page scroll at 375px: /${path}`, async ({ page }) => {
      await openApp(page, path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
