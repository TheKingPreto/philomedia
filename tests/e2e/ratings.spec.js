import { test, expect } from '@playwright/test';
import { DetailsPage } from './pages/app.pages.js';

test.describe('Details ratings', () => {
  test('anonymous visitor sees star and thumb rating CTAs @smoke', async ({ page }) => {
    const details = new DetailsPage(page);
    await details.goto('550', 'movie');

    await expect(details.title).not.toBeEmpty();
    await expect(details.starButtons).toHaveCount(5);
    await expect(details.ratingHint).toBeVisible();
    await expect(details.ratingHint).toContainText(/sign in/i);

    await expect(details.quoteThumbs).toHaveCount(2);
    await expect(details.quoteHint).toBeVisible();
    await expect(details.quoteHint).toContainText(/sign in/i);
  });
});
