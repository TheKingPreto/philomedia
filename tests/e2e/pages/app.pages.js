export class SearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.featuredLenses = page.locator('#lens-suggestions > button.filter-chip:not(.lens-expand-chip)');
    this.seeAllButton = page.getByRole('button', { name: /see all/i });
    this.lensSummary = page.locator('#lens-active-summary');
    this.clearFiltersButton = page.getByRole('button', { name: /clear filters/i });
  }

  async goto() {
    await this.page.addInitScript(() => {
      localStorage.setItem('philomedia_ui_lang', 'en');
    });
    await this.page.goto('/html/search.html');
  }

  lensChip(lensId) {
    return this.page.locator(`#lens-suggestions button[data-group="lens"][data-value="${lensId}"]`);
  }
}

export class ThinkerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.name = page.locator('#philosopher-name');
    this.emptyQuotes = page.locator('.philosopher-empty-state .empty-state-title');
    this.notFound = page.locator('.error-state-title');
  }

  async goto(slug) {
    await this.page.addInitScript(() => {
      localStorage.setItem('philomedia_ui_lang', 'en');
    });
    await this.page.goto(`/html/philosopher.html?slug=${encodeURIComponent(slug)}`);
  }
}

export class DetailsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('#details-title');
    this.starButtons = page.locator('#details-star-rating .star-rating-button');
    this.ratingHint = page.locator('#details-rating-hint');
    this.quoteThumbs = page.locator('#quote-rating .quote-rating-button');
    this.quoteHint = page.locator('#quote-rating-hint');
  }

  async goto(id, type = 'movie') {
    await this.page.addInitScript(() => {
      localStorage.setItem('philomedia_ui_lang', 'en');
    });
    await this.page.goto(`/html/details.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
  }
}
