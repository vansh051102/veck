import { test, expect, type Page } from '@playwright/test'

// Full lead lifecycle: create → qualify → quote → won.
//
// Requires a real Supabase test account with an active org. Provide it via:
//   E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run e2e
// The suite is skipped when credentials are not configured, so `npm run e2e`
// stays green in environments without a seeded test user.

const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

test.describe('lead lifecycle', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run this suite')

  async function logActivity(page: Page, title: string) {
    await page.getByLabel('Activity title').fill(title)
    await page.getByRole('button', { name: 'Log activity' }).click()
    await expect(page.getByText(title)).toBeVisible()
  }

  async function moveStage(page: Page, target: string) {
    const workflow = page.locator('text=Workflow').locator('..').locator('..')
    await workflow.getByRole('combobox').selectOption(target)
    await workflow.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText(target).first()).toBeVisible({ timeout: 10_000 })
  }

  test('create → qualify → quote → won', async ({ page }) => {
    test.setTimeout(180_000)
    const unique = Date.now()
    const company = `E2E Steel Traders ${unique}`

    // --- Sign in ---
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(EMAIL!)
    await page.getByLabel('Password').fill(PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 })

    // --- Create lead with a new contact ---
    await page.goto('/leads')
    await page.getByRole('button', { name: 'New Lead' }).click()
    await page.getByLabel('First name').fill('E2E')
    await page.getByLabel('Last name').fill('Buyer')
    await page.getByLabel('Email', { exact: true }).fill(`e2e-buyer-${unique}@veck.test`)
    await page.getByLabel('Phone').fill('+91 98765 43210')
    await page.getByLabel('Company name').fill(company)
    await page.getByRole('button', { name: 'Create lead' }).click()

    // Lands on the lead detail page
    await page.waitForURL(/\/leads\/[0-9a-f-]+/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: company })).toBeVisible()
    await expect(page.getByText('New Lead Qualification')).toBeVisible()

    // --- SOP gate: moving to Contacted is blocked until the required
    // qualification checklist is complete ---
    await logActivity(page, 'First outreach call')
    const workflow = page.locator('text=Workflow').locator('..').locator('..')
    await workflow.getByRole('combobox').selectOption('Contacted')
    await workflow.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText(/required checklist/i)).toBeVisible()

    // Complete the required checklist
    for (const checkbox of await page.getByRole('checkbox').all()) {
      if (!(await checkbox.isChecked())) await checkbox.check()
      await page.waitForTimeout(300) // sequential toggles hit the API one by one
    }

    // --- New Lead → Contacted ---
    await moveStage(page, 'Contacted')

    // --- Contacted → Qualified (needs 3 total activities) ---
    await logActivity(page, 'Follow-up call with buyer')
    await logActivity(page, 'Shared product catalogue')
    await moveStage(page, 'Qualified')

    // --- Create a quote ---
    await page.getByRole('button', { name: 'New quote' }).click()
    await page.getByLabel('Product or SKU').first().fill('MS-PIPE-40')
    await page.getByLabel('Quantity').first().fill('100')
    await page.getByLabel('Price').first().fill('550')
    const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    await page.getByLabel('Valid until').fill(validUntil)
    await page.getByRole('button', { name: 'Create quote' }).click()
    await expect(page.getByText(/QT-\d{4}-\d+/)).toBeVisible({ timeout: 10_000 })

    // --- Qualified → Quote Sent → Order Confirmed → Order Closed ---
    await moveStage(page, 'Quote Sent')
    await moveStage(page, 'Order Confirmed')
    await moveStage(page, 'Order Closed')
  })
})
