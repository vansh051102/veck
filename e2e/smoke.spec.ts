import { test, expect } from '@playwright/test'

// Baseline smoke tests that don't require a logged-in session or seeded
// test data. Deeper flows (create lead, move stages, send quote) need a
// real Supabase test account and are left for a follow-up "authenticated
// E2E" suite once a seeding strategy exists (see note in PHASE1 docs).

test('health check API responds ok', async ({ request }) => {
  const res = await request.get('/api/v1/health')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)
})

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('login with bad credentials shows an error', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill('nonexistent-user@veck.test')
  await page.getByLabel('Password').fill('wrong-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/invalid|credentials/i)).toBeVisible({ timeout: 10_000 })
})
