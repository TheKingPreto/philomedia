import { test, expect } from '@playwright/test';
import { SearchPage } from './pages/app.pages.js';

test.describe('Search lenses', () => {
  test('featured chips, lens URL, description, and clear filters @smoke', async ({ page }) => {
    const search = new SearchPage(page);
    const discoverUrls = [];
    const reviewUrls = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/tmdb/discover')) discoverUrls.push(url);
      if (url.includes('/api/tmdb/reviews')) reviewUrls.push(url);
    });

    await search.goto();

    await expect(search.featuredLenses).toHaveCount(5);
    await expect(search.seeAllButton).toBeVisible();

    await search.seeAllButton.click();
    await expect(page.getByRole('button', { name: /see less/i })).toBeVisible();

    await search.lensChip('epistemology').click();
    await expect(page).toHaveURL(/[?&]lens=epistemology/);
    await expect(search.lensSummary).toBeVisible();
    await expect(search.lensSummary).not.toBeEmpty();
    await expect(page.locator('#search-results .media-card-shell').first()).toBeVisible();

    expect(reviewUrls, 'lens first click must not fetch TMDB reviews').toHaveLength(0);
    expect(discoverUrls.length, 'lens first paint is one discover per media, plus short-pool fallback').toBeGreaterThan(0);
    expect(discoverUrls.length).toBeLessThanOrEqual(6);
    console.log(`lens first click: ${discoverUrls.length} discover, ${reviewUrls.length} reviews`);

    await expect(search.clearFiltersButton).toBeVisible();
    await search.clearFiltersButton.click();
    await expect(page).not.toHaveURL(/[?&]lens=/);
    await expect(search.lensSummary).toBeHidden();
  });
});
