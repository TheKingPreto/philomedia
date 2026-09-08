import { test, expect } from '@playwright/test';

test.describe('Library without login', () => {
  test('shows a stable empty state instead of crashing @smoke', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('philomedia_ui_lang', 'en');
    });
    await page.goto('/html/library.html');

    await expect(page.locator('.empty-state-title')).toBeVisible();
  });
});
