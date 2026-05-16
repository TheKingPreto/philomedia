import { setupAuthUI } from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getPhilosopherReference,
  getQuoteCatalog,
  getSubmittedPhilosophers,
} from '/scripts/philosophersapi.js';
import { buildPhilosopherProfiles, filterPhilosopherCatalogQuotes } from '/scripts/philosopher-data.js';
import { getThinkerCopyForLocale, getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';

const PAGE_SIZE = 12;
const state = {
  profiles: [],
  page: 1,
};

function isIndexReadyProfile(profile) {
  if (!profile) return false;
  return profile.quoteCount >= 2 || profile.isCommunitySubmitted;
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
      <span class="profile-stat-label">Thinkers</span>
      <span class="profile-stat-value">${profiles.length}</span>
      <p class="profile-stat-caption">Voices with dedicated pages and thematic links inside the collection.</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">Quotes in focus</span>
      <span class="profile-stat-value">${totalQuotes}</span>
      <p class="profile-stat-caption">Curated lines used to shape the readings, lenses, and match logic throughout the site.</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">Linked works</span>
      <span class="profile-stat-value">${totalWorks}</span>
      <p class="profile-stat-caption">TMDB titles already connected to these thinkers through curated pairings.</p>
    </article>
  `;
}

function createThemeChips(profile) {
  return profile.topThemes
    .slice(0, 3)
    .map(theme => `<span class="philosopher-chip">${escapeHtml(profile.themeLabels[profile.topThemes.indexOf(theme)] || theme)}</span>`)
    .join('');
}

function renderPortrait(profile) {
  if (!profile.portraitUrl) {
    return `<div class="philosopher-sigil philosopher-sigil-small" aria-hidden="true">${escapeHtml(profile.initials)}</div>`;
  }

  return `
    <div class="philosopher-sigil philosopher-sigil-small philosopher-sigil-photo" aria-hidden="true">
      <img src="${profile.portraitUrl}" alt="${escapeHtml(profile.name)} portrait" loading="lazy">
    </div>
  `;
}

function renderCards(container, profiles) {
  if (!container) return;

  const loc = getUiLocale();
  container.innerHTML = profiles.map(profile => {
    const copy = getThinkerCopyForLocale(profile, loc);
    return `
    <a href="${profile.url}" class="philosopher-card-link" data-philosopher-slug="${profile.slug}">
      <article class="philosopher-card">
        <div class="philosopher-card-top">
          ${renderPortrait(profile)}
          <div class="philosopher-card-headline">
            <p class="philosopher-card-period" data-philosopher-period>${escapeHtml(profile.period)}</p>
            <h3>${escapeHtml(profile.name)}</h3>
          </div>
        </div>
        <p class="philosopher-card-summary" data-philosopher-summary>${escapeHtml(copy.summary)}</p>
        <div class="philosopher-chip-row">${createThemeChips(profile)}</div>
        <div class="philosopher-card-quote">
          <p>"${escapeHtml(profile.featuredQuotePreview)}"</p>
        </div>
        <div class="philosopher-card-footer">
          <span>${profile.quoteCount} quotes</span>
          <span>${profile.linkedWorkCount} related works</span>
        </div>
      </article>
    </a>
  `;
  }).join('');
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
  container.textContent = `Showing ${start}-${end} of ${state.profiles.length} thinkers.`;
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
    <button type="button" class="ghost-button" data-page-action="prev" ${state.page === 1 ? 'disabled' : ''}>Previous</button>
    <span class="philosopher-pagination-label">Page ${state.page} of ${pageCount}</span>
    <button type="button" class="ghost-button" data-page-action="next" ${state.page === pageCount ? 'disabled' : ''}>Next</button>
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

      const image = card.querySelector('.philosopher-sigil');
      if (image && profile.portraitUrl) {
        image.classList.add('philosopher-sigil-photo');
        image.innerHTML = `<img src="${profile.portraitUrl}" alt="${escapeHtml(profile.name)} portrait" loading="lazy">`;
      }

      const period = card.querySelector('[data-philosopher-period]');
      if (period) period.textContent = profile.period;

      const summary = card.querySelector('[data-philosopher-summary]');
      if (summary) summary.textContent = getThinkerCopyForLocale(profile, getUiLocale()).summary;
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
      <p class="error-state-text">Try reloading the page. If the quote source is unavailable, the thinker index cannot be built yet.</p>
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
    const [quotes, philosopherDirectory, submittedProfiles] = await Promise.all([
      getQuoteCatalog(locale),
      getPhilosopherDirectory(),
      getSubmittedPhilosophers(),
    ]);
    const profiles = buildPhilosopherProfiles(filterPhilosopherCatalogQuotes(quotes, locale), philosopherDirectory, submittedProfiles)
      .filter(isIndexReadyProfile);

    if (!profiles.length) {
      renderError(gridContainer, 'No thinker profiles are available right now.');
      return;
    }

    state.profiles = profiles;
    renderPage();
  } catch (error) {
    renderError(gridContainer, 'We could not build the thinker index.');
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
