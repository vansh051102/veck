import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const OUT = path.join(__dirname, '..', 'docs', 'screenshots', 'walkthrough')
const EMAIL = process.env.E2E_USER_EMAIL ?? 'admin@veck.local'
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'VeckAdmin!2026'

async function snap(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
}

test.describe('walkthrough screenshots', () => {
  test('capture app screens', async ({ page }) => {
    test.setTimeout(180_000)
    fs.mkdirSync(OUT, { recursive: true })

    await page.setViewportSize({ width: 1440, height: 900 })

    // --- Auth (no login required) ---
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await snap(page, '00-login')

    await page.goto('/auth/signup')
    await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible({
      timeout: 10_000,
    })
    await snap(page, '01-signup')

    await page.goto('/auth/forgot-password')
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible({
      timeout: 10_000,
    })
    await snap(page, '02-forgot-password')

    // --- Sign in ---
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/(dashboard|leads)/, { timeout: 25_000 })

    // --- Leads ---
    await page.goto('/leads')
    await expect(page.getByText('Total leads')).toBeVisible({ timeout: 20_000 })
    await snap(page, '03-leads-list')

    // Open first lead drawer if a row exists
    const firstRow = page.locator('table tbody tr').first()
    if (await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstRow.click()
      await page.waitForTimeout(800)
      await snap(page, '04-lead-drawer')

      const quoteBtn = page.getByRole('button', { name: /view quote|create quote/i }).first()
      if (await quoteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await quoteBtn.click()
        await page.waitForTimeout(800)
        await snap(page, '05-lead-quote')
      }

      // Close drawer overlay before interacting with sidebar
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }

    // --- Sidebar collapsed ---
    const collapseBtn = page.getByRole('button', { name: 'Collapse sidebar' })
    if (await collapseBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await collapseBtn.click({ force: true })
      await page.waitForTimeout(300)
      await snap(page, '06-sidebar-collapsed')
    }

    // --- Contacts ---
    await page.goto('/contacts')
    await page.waitForTimeout(600)
    await snap(page, '07-contacts')

    // --- Profile ---
    await page.goto('/profile')
    await page.waitForTimeout(600)
    await snap(page, '08-profile')

    // --- Admin ---
    await page.goto('/admin')
    await page.waitForTimeout(800)
    await snap(page, '09-admin-picker')

    const orgLink = page.locator('a[href*="/admin/workspace/"]').first()
    if (await orgLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await orgLink.getAttribute('href')
      if (href) {
        await page.goto(href)
        await page.waitForTimeout(800)
        await snap(page, '10-admin-workspace')
      }
    }
  })
})
