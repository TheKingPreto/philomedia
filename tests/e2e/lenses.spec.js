import { test, expect } from '@playwright/test';
import { SearchPage } from './pages/app.pages.js';

test.describe('Search lenses', () => {
  test('featured chips, lens URL, description, and clear filters @smoke', async ({ page }) => {
    const search = new SearchPage(page);
    await search.goto();

    await expect(search.featuredLenses).toHaveCount(5);
    await expect(search.seeAllButton).toBeVisible();

    await search.seeAllButton.click();
    await expect(page.getByRole('button', { name: /see less/i })).toBeVisible();

    await search.lensChip('epistemology').click();
    await expect(page).toHaveURL(/[?&]lens=epistemology/);
    await expect(search.lensSummary).toBeVisible();
    await expect(search.lensSummary).not.toBeEmpty();

    await expect(search.clearFiltersButton).toBeVisible();
    await search.clearFiltersButton.click();
    await expect(page).not.toHaveURL(/[?&]lens=/);
    await expect(search.lensSummary).toBeHidden();
  });
});
