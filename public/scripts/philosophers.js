import { setupAuthUI } from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getPhilosopherReference,
  getQuoteCatalog,
  getSubmittedPhilosophers,
} from '/scripts/philosophersapi.js';
import {
  buildPhilosopherIndexProfiles,
  PHILOSOPHER_DEFINITIONS,
  filterPhilosopherCatalogQuotes,
} from '/scripts/philosopher-data.js';
import {
  localizeThinkerCard,
} from '/scripts/services/philosopherDisplayI18n.js';
import { t } from '/scripts/services/i18n.js';
import { getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';
import { fillPortraitHost } from '/scripts/domain/safePortraitUrl.js';

const PAGE_SIZE = 12;
const state = {
  profiles: [],
  page: 1,
};

function isIndexReadyProfile(profile) {
  if (!profile) return false;
  if (PHILOSOPHER_DEFINITIONS.some(definition => definition.slug === profile.slug)) return true;
  return profile.quoteCount >= 1 || profile.isCommunitySubmitted;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderStats(container, profiles) {
  if (!container) return;

  const totalQuotes = profiles.reduce((sum, profile) => sum + profile.quoteCount, 0);
  const totalWorks = profiles.reduce((sum, profile) => sum + profile.linkedWorkCount, 0);

  container.innerHTML = `
    <article class="profile-stat-card">
      <span class="profile-stat-label">${escapeHtml(t('philosophers.stat_thinkers'))}</span>
      <span class="profile-stat-value">${profiles.length}</span>
      <p class="profile-stat-caption">${escapeHtml(t('philosophers.stat_thinkers_caption'))}</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">${escapeHtml(t('philosophers.stat_quotes'))}</span>
      <span class="profile-stat-value">${totalQuotes}</span>
      <p class="profile-stat-caption">${escapeHtml(t('philosophers.stat_quotes_caption'))}</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">${escapeHtml(t('philosophers.stat_works'))}</span>
      <span class="profile-stat-value">${totalWorks}</span>
      <p class="profile-stat-caption">${escapeHtml(t('philosophers.stat_works_caption'))}</p>
    </article>
  `;
}

function createThemeChips(profile, themeLabels) {
  return (themeLabels || profile.themeLabels || [])
    .slice(0, 3)
    .map(label => `<span class="philosopher-chip">${escapeHtml(label)}</span>`)
    .join('');
}

function renderPortraitPlaceholder() {
  return '<div class="philosopher-sigil philosopher-sigil-small" data-portrait-host aria-hidden="true"></div>';
}

function applyCardPortrait(card, profile) {
  const host = card?.querySelector('[data-portrait-host], .philosopher-sigil');
  if (!host) return;
  fillPortraitHost(host, {
    url: profile.portraitUrl,
    alt: t('philosophers.portrait_alt', { name: profile.name }),
    initials: profile.initials,
    loading: 'lazy',
  });
}

function renderCards(container, profiles) {
  if (!container) return;

  const loc = getUiLocale();
  container.innerHTML = profiles.map(profile => {
    const display = localizeThinkerCard(profile, loc);
    return `
    <a href="${profile.url}" class="philosopher-card-link" data-philosopher-slug="${profile.slug}">
      <article class="philosopher-card">
        <div class="philosopher-card-top">
          ${renderPortraitPlaceholder()}
          <div class="philosopher-card-headline">
            <p class="philosopher-card-period" data-philosopher-period>${escapeHtml(display.period)}</p>
            <h3>${escapeHtml(profile.name)}</h3>
          </div>
        </div>
        <p class="philosopher-card-summary" data-philosopher-summary>${escapeHtml(display.summary)}</p>
        <div class="philosopher-chip-row">${createThemeChips(profile, display.themeLabels)}</div>
        <div class="philosopher-card-quote">
          <p>${display.quotePreview ? `"${escapeHtml(display.quotePreview)}"` : ''}</p>
        </div>
        <div class="philosopher-card-footer">
          <span>${escapeHtml(t('philosophers.quotes_count', { count: profile.quoteCount }))}</span>
          <span>${escapeHtml(t('philosophers.works_count', { count: profile.linkedWorkCount }))}</span>
        </div>
      </article>
    </a>
  `;
  }).join('');

  profiles.forEach(profile => {
    const card = container.querySelector(`[data-philosopher-slug="${profile.slug}"]`);
    applyCardPortrait(card, profile);
  });
}

function getPageCount() {
  return Math.max(1, Math.ceil(state.profiles.length / PAGE_SIZE));
}

function getVisibleProfiles() {
  const start = (state.page - 1) * PAGE_SIZE;
  return state.profiles.slice(start, start + PAGE_SIZE);
}

function renderPaginationSummary(container) {
  if (!container) return;
  if (!state.profiles.length) {
    container.textContent = '';
    return;
  }

  const start = ((state.page - 1) * PAGE_SIZE) + 1;
  const end = Math.min(state.page * PAGE_SIZE, state.profiles.length);
  container.textContent = t('philosophers.pagination_summary', {
    start,
    end,
    total: state.profiles.length,
  });
}

function renderPaginationControls(container) {
  if (!container) return;

  const pageCount = getPageCount();
  if (pageCount <= 1) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <button type="button" class="ghost-button" data-page-action="prev" ${state.page === 1 ? 'disabled' : ''}>${escapeHtml(t('philosophers.prev'))}</button>
    <span class="philosopher-pagination-label">${escapeHtml(t('philosophers.page_label', { page: state.page, total: pageCount }))}</span>
    <button type="button" class="ghost-button" data-page-action="next" ${state.page === pageCount ? 'disabled' : ''}>${escapeHtml(t('philosophers.next'))}</button>
  `;
}

function needsReferenceMetadata(profile) {
  return Boolean(
    profile?.needsReferenceMetadata
    || String(profile?.period || '').toLowerCase().includes('voice in the collection')
    || String(profile?.period || '').toLowerCase().includes('thinker in the archive')
    || String(profile?.summary || '').toLowerCase().includes('broader philomedia archive')
  );
}

function applyReferenceToProfile(profile, reference) {
  if (!profile || !reference) return false;

  let changed = false;

  if (!profile.portraitUrl && reference.portraitUrl) {
    profile.portraitUrl = reference.portraitUrl;
    changed = true;
  }

  if (needsReferenceMetadata(profile)) {
    if (reference.period && reference.period !== profile.period) {
      profile.period = reference.period;
      changed = true;
    }
    if (reference.summary && reference.summary !== profile.summary) {
      profile.summary = reference.summary;
      changed = true;
    }
    if (reference.focus && reference.focus !== profile.focus) {
      profile.focus = reference.focus;
      changed = true;
    }
    profile.needsReferenceMetadata = false;
  }

  return changed;
}

async function hydrateVisibleProfiles(container, profiles) {
  const pendingProfiles = profiles.filter(profile => !profile.portraitUrl || needsReferenceMetadata(profile));
  if (!pendingProfiles.length) return;

  await Promise.all(
    pendingProfiles.map(async profile => {
      const reference = await getPhilosopherReference(profile.name, profile.wikiTitle);
      if (!reference) return;

      const changed = applyReferenceToProfile(profile, reference);
      if (!changed) return;

      const card = container.querySelector(`[data-philosopher-slug="${profile.slug}"]`);
      if (!card) return;

      applyCardPortrait(card, profile);

      const period = card.querySelector('[data-philosopher-period]');
      const localized = localizeThinkerCard(profile, getUiLocale());
      if (period) period.textContent = localized.period;

      const summary = card.querySelector('[data-philosopher-summary]');
      if (summary) summary.textContent = localizeThinkerCard(profile, getUiLocale()).summary;
    })
  );
}

function renderPage() {
  const statsContainer = document.getElementById('philosophers-stats');
  const gridContainer = document.getElementById('philosophers-grid');
  const summaryContainer = document.getElementById('philosophers-pagination-summary');
  const paginationContainer = document.getElementById('philosophers-pagination');

  renderStats(statsContainer, state.profiles);

  const visibleProfiles = getVisibleProfiles();
  renderCards(gridContainer, visibleProfiles);
  renderPaginationSummary(summaryContainer);
  renderPaginationControls(paginationContainer);
  hydrateVisibleProfiles(gridContainer, visibleProfiles).catch(() => {});
}

function renderError(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-state">
      <p class="error-state-title">${escapeHtml(message)}</p>
      <p class="error-state-text">${escapeHtml(t('philosophers.error_reload'))}</p>
    </div>
  `;
}

async function init() {
  setupLanguageChrome();
  setupAuthUI().catch(() => {});

  const gridContainer = document.getElementById('philosophers-grid');

  if (gridContainer) {
    gridContainer.innerHTML = `
      <div class="loading-skeleton" aria-hidden="true">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }

  try {
    const locale = getUiLocale();
    const [quotesForIndex, philosopherDirectory, submittedProfiles] = await Promise.all([
      getQuoteCatalog(locale),
      getPhilosopherDirectory(),
      getSubmittedPhilosophers(),
    ]);
    const profiles = buildPhilosopherIndexProfiles(
      filterPhilosopherCatalogQuotes(quotesForIndex, locale),
      philosopherDirectory,
      submittedProfiles,
    )
      .filter(isIndexReadyProfile);

    if (!profiles.length) {
      renderError(gridContainer, t('philosophers.error_none'));
      return;
    }

    state.profiles = profiles;
    renderPage();
  } catch (error) {
    renderError(gridContainer, t('philosophers.error_build'));
  }
}

document.getElementById('philosophers-pagination')?.addEventListener('click', event => {
  const button = event.target.closest('[data-page-action]');
  if (!button) return;

  const pageCount = getPageCount();
  if (button.dataset.pageAction === 'prev' && state.page > 1) {
    state.page -= 1;
  }
  if (button.dataset.pageAction === 'next' && state.page < pageCount) {
    state.page += 1;
  }

  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

init();
