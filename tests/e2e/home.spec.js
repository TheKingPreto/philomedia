import { test, expect } from '@playwright/test';
import { HomePage } from './pages/app.pages.js';

test.describe('Home pairing', () => {
  test('hero copy and daily quote stay on the catalog pipeline @smoke', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.hero).toBeVisible();
    await expect(home.quoteText).not.toHaveText(/loading quote/i, { timeout: 20_000 });
    await expect(home.quoteText).not.toBeEmpty();
    await expect(home.quoteText).not.toHaveText(/something went wrong/i);
    await expect(home.quoteAuthor).not.toBeEmpty();
  });
});
