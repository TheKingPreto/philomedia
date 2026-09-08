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

  test('anonymous visitor sees a catalog quote and related works', async ({ page }) => {
    const details = new DetailsPage(page);
    await details.goto('550', 'movie');

    await expect(details.quoteText).not.toBeEmpty();
    await expect(details.quoteText).not.toHaveText(/loading/i);
    await expect(details.relatedWorks).toBeVisible();
    await expect(page.locator('#related-results .media-card-shell').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /details\.html/);
  });
});
