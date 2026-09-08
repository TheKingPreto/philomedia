import { test, expect } from '@playwright/test';
import { ThinkerPage } from './pages/app.pages.js';

test.describe('Thinker pages', () => {
  test('curated thinker without quotes stays available with an honest empty @smoke', async ({ page }) => {
    const thinker = new ThinkerPage(page);
    await thinker.goto('isaac-newton');

    await expect(thinker.name).toHaveText(/Isaac Newton/i);
    await expect(thinker.notFound).toHaveCount(0);
    await expect(thinker.emptyQuotes).toBeVisible();
    await expect(thinker.emptyQuotes).toHaveText(/no quotes yet/i);
  });

  test('unknown thinker shows the not-found copy @smoke', async ({ page }) => {
    const thinker = new ThinkerPage(page);
    await thinker.goto('this-thinker-does-not-exist');

    await expect(thinker.notFound).toBeVisible();
    await expect(thinker.notFound).toHaveText(/not available/i);
  });
});
