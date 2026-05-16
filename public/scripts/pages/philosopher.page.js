import { setupAuthUI } from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getPhilosopherReference,
  getQuoteCatalog,
  getSubmittedPhilosophers,
} from '/scripts/philosophersapi.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { getDetailsFromTMDB } from '/scripts/seriesapi.js';
import { discoverTMDBCached, searchTMDBCached } from '/scripts/services/tmdbCachedClient.js';
import { getReviewContextForItem } from '/scripts/services/searchLensReviewRerankService.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { updatePageSeo } from '/scripts/seo.js';
import { PHILOSOPHER_CONTEXT_STOPWORDS } from '/scripts/domain/detailsPageConfig.js';
import {
  mapDetailsToCandidate,
  mergeCandidateBuckets,
} from '/scripts/mediaRankCore.js';
import {
  CURATED_TV_IDS,
  THEME_GENRE_HINTS,
  formatThemeLabel,
  filterPhilosopherCatalogQuotes,
  getPhilosopherProfileBySlug,
} from '/scripts/philosopher-data.js';
import {
  getCuratedPhilosophicalProfile,
  scorePhilosophicalTagsAgainstThemeWeights,
} from '/scripts/curatedPhilosophicalProfiles.js';
import { escapeHtml, normalizeText } from '/scripts/ui/viewHelpers.js';
import { getThinkerCopyForLocale, getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';

const WORK_LIMIT = 8;
const QUOTE_LIMIT = 8;
const REVIEW_RERANK_LIMIT = 4;

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || '';
}

function buildThemeWeightMap(topThemes = []) {
  return new Map(
    topThemes.map((theme, index) => [theme, Math.max(6, 24 - index * 4)])
  );
}

function buildPhilosopherContext(profile) {
  const copy = getThinkerCopyForLocale(profile, getUiLocale());
  return [
    profile.name,
    copy.summary,
    copy.focus,
    ...(profile.quotes || []).slice(0, 4).map(quote => quote.quote),
  ]
    .filter(Boolean)
    .join(' ');
}

function extractContextKeywords(profile, limit = 8) {
  const authorTokens = new Set(
    normalizeText(profile.name)
      .split(' ')
      .filter(Boolean)
  );

  const keywords = normalizeText(buildPhilosopherContext(profile))
    .split(' ')
    .filter(token =>
      token.length >= 5
      && !PHILOSOPHER_CONTEXT_STOPWORDS.has(token)
      && !authorTokens.has(token)
    );

  return [...new Set(keywords)].slice(0, limit);
}

function getProfileContextKeywords(profile, limit = 12) {
  const explicitKeywords = (profile.contextKeywords || [])
    .map(keyword => normalizeText(keyword))
    .filter(Boolean);

  return [...new Set([
    ...explicitKeywords,
    ...extractContextKeywords(profile, limit),
  ])].slice(0, limit);
}

function getProfilePenaltyKeywords(profile, limit = 12) {
  return [...new Set(
    (profile.contextPenaltyKeywords || [])
      .map(keyword => normalizeText(keyword))
      .filter(Boolean)
  )].slice(0, limit);
}

function countKeywordMatches(text, keywords = []) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return 0;

  return keywords.reduce((count, keyword) => (
    keyword && normalizedText.includes(keyword) ? count + 1 : count
  ), 0);
}

function buildDiscoveryQueries(profile, limit = 4) {
  const explicitQueries = (profile.discoveryQueries || [])
    .map(query => String(query || '').trim())
    .filter(Boolean);
  const keywordQueries = getProfileContextKeywords(profile, 10)
    .filter(keyword => keyword.length >= 6)
    .slice(0, 6);

  return [...new Set([
    ...explicitQueries,
    ...keywordQueries,
  ])].slice(0, limit);
}

function getPreferredGenres(profile) {
  const movie = new Set();
  const tv = new Set();

  profile.topThemes.slice(0, 3).forEach(theme => {
    const hints = THEME_GENRE_HINTS[theme];
    if (!hints) return;
    (hints.movie || []).forEach(genre => movie.add(genre));
    (hints.tv || []).forEach(genre => tv.add(genre));
  });

  return {
    movie: [...movie],
    tv: [...tv],
  };
}

async function loadCuratedWorks(profile) {
  const results = await Promise.all(
    profile.linkedWorkIds
      .slice(0, 8)
      .map(async tmdbId => {
        const mediaType = CURATED_TV_IDS.has(String(tmdbId)) ? 'tv' : 'movie';
        try {
          const details = await getDetailsFromTMDB(tmdbId, mediaType);
          return mapDetailsToCandidate(details, mediaType);
        } catch (error) {
          return null;
        }
      })
  );

  return results.filter(Boolean);
}

async function loadThemeDiscovery(profile) {
  const preferredGenres = getPreferredGenres(profile);

  const [moviesByRating, moviesByPopularity, seriesByRating, seriesByPopularity] = await Promise.all([
    discoverTMDBCached('movie', {
      page: 1,
      withGenres: preferredGenres.movie.join('|'),
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('movie', {
      page: 1,
      withGenres: preferredGenres.movie.join('|'),
      sortBy: 'popularity.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      withGenres: preferredGenres.tv.join('|'),
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      withGenres: preferredGenres.tv.join('|'),
      sortBy: 'popularity.desc',
    }),
  ]);

  return mergeCandidateBuckets([
    { source: 'movie-rated', items: moviesByRating },
    { source: 'movie-popular', items: moviesByPopularity },
    { source: 'tv-rated', items: seriesByRating },
    { source: 'tv-popular', items: seriesByPopularity },
  ]);
}

async function loadBroadDiscovery() {
  const [moviesByRating, moviesByPopularity, seriesByRating, seriesByPopularity] = await Promise.all([
    discoverTMDBCached('movie', {
      page: 1,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('movie', {
      page: 1,
      sortBy: 'popularity.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      sortBy: 'popularity.desc',
    }),
  ]);

  return mergeCandidateBuckets([
    { source: 'movie-rated-fallback', items: moviesByRating },
    { source: 'movie-popular-fallback', items: moviesByPopularity },
    { source: 'tv-rated-fallback', items: seriesByRating },
    { source: 'tv-popular-fallback', items: seriesByPopularity },
  ]);
}

async function loadKeywordDiscovery(profile) {
  const queries = buildDiscoveryQueries(profile);

  if (!queries.length) {
    return [];
  }

  const results = await Promise.all(
    queries.map(async query => {
      try {
        return await searchTMDBCached(query);
      } catch (error) {
        return [];
      }
    })
  );

  return mergeCandidateBuckets(
    results.map((items, index) => ({
      source: `keyword-${index + 1}`,
      items,
    }))
  );
}

function scoreProfileTextAffinity(profile, text) {
  if (!text) return 0;

  const themeWeights = buildThemeWeightMap(profile.topThemes);
  const textThemes = new Set(
    analyzeWorkForThemes(text)
      .slice(0, 6)
      .map(match => match.theme)
  );
  const normalizedText = normalizeText(text);
  const contextKeywords = getProfileContextKeywords(profile);
  const penaltyKeywords = getProfilePenaltyKeywords(profile);
  const keywordHits = countKeywordMatches(normalizedText, contextKeywords);
  const penaltyHits = countKeywordMatches(normalizedText, penaltyKeywords);
  let score = 0;

  themeWeights.forEach((weight, theme) => {
    if (textThemes.has(theme)) {
      score += weight * 4.2;
    }
  });

  contextKeywords.forEach((keyword, index) => {
    if (normalizedText.includes(keyword)) {
      score += Math.max(2, 8 - index * 0.75);
    }
  });

  score += keywordHits * 4.5;

  profile.topThemes.slice(0, 3).forEach((theme, index) => {
    const label = normalizeText(formatThemeLabel(theme));
    if (label && normalizedText.includes(label)) {
      score += Math.max(3, 10 - index * 1.5);
    }
  });

  if (penaltyHits > 0) {
    const hasPositiveSignal = keywordHits > 0 || [...themeWeights.keys()].some(theme => textThemes.has(theme));
    score -= penaltyHits * (hasPositiveSignal ? 3 : 7);
  }

  return score;
}

function scoreCandidate(profile, candidate) {
  const themeWeights = buildThemeWeightMap(profile.topThemes);
  const title = candidate.title || candidate.name || '';
  const text = `${title} ${candidate.overview || ''}`.trim();
  const candidateThemes = new Set(
    analyzeWorkForThemes(text)
      .slice(0, 5)
      .map(match => match.theme)
  );
  const normalizedTitle = normalizeText(title);
  const normalized = normalizeText(text);
  const contextKeywords = getProfileContextKeywords(profile);
  const penaltyKeywords = getProfilePenaltyKeywords(profile);
  const keywordHits = countKeywordMatches(normalized, contextKeywords);
  const titleKeywordHits = countKeywordMatches(normalizedTitle, contextKeywords);
  const penaltyHits = countKeywordMatches(normalized, penaltyKeywords);
  const preferredGenres = getPreferredGenres(profile)[candidate.media_type] || [];
  const preferredGenreSet = new Set(preferredGenres);
  const candidateGenres = Array.isArray(candidate.genre_ids) ? candidate.genre_ids : [];

  let score = 0;

  themeWeights.forEach((weight, theme) => {
    if (candidateThemes.has(theme)) {
      score += weight * 4.5;
    }
  });

  profile.topThemes.slice(0, 3).forEach((theme, index) => {
    const label = normalizeText(formatThemeLabel(theme));
    if (label && normalized.includes(label)) {
      score += Math.max(4, 12 - index * 2);
    }
  });

  if (preferredGenres.length && candidateGenres.length) {
    const overlap = candidateGenres.filter(genreId => preferredGenreSet.has(genreId)).length;
    score += overlap * 5;
  }

  score += keywordHits * 9;
  score += titleKeywordHits * 12;

  if (contextKeywords.length && keywordHits === 0 && !candidateThemes.size) {
    score -= 12;
  }

  if (penaltyHits > 0) {
    score -= penaltyHits * (keywordHits > 0 || candidateThemes.size > 0 ? 4 : 12);
  }

  if ((candidate._sources || []).includes('curated')) {
    score += 42;
  }

  if ((candidate._sources || []).some(source => source.endsWith('-fallback'))) {
    score -= 4;
  }

  score += Math.max(0, Number(candidate.vote_average || 0) - 6) * 1.8;
  score += Math.min(5, (Number(candidate.popularity) || 0) / 40);

  if (!candidate.overview) {
    score -= 10;
  }

  score += Math.min(28, scoreProfileTextAffinity(profile, candidate.overview || ''));

  score += scorePhilosophicalTagsAgainstThemeWeights(
    getCuratedPhilosophicalProfile(candidate.id),
    themeWeights,
  );

  return score;
}

function renderState(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

function renderHeader(profile) {
  const copy = getThinkerCopyForLocale(profile, getUiLocale());
  updatePageSeo({
    title: `PhiloMedia | ${profile.name}`,
    description: copy.summary || `${profile.name} in PhiloMedia, with signature quotes, philosophical lenses, and related works.`,
    path: `${window.location.pathname}?slug=${encodeURIComponent(profile.slug)}`,
    image: profile.portraitUrl || '',
    type: 'profile',
  });

  const sigil = document.getElementById('philosopher-sigil');
  const name = document.getElementById('philosopher-name');
  const period = document.getElementById('philosopher-period');
  const summary = document.getElementById('philosopher-summary');
  const focus = document.getElementById('philosopher-focus');
  const lenses = document.getElementById('philosopher-lenses');

  if (sigil) {
    if (profile.portraitUrl) {
      sigil.classList.add('philosopher-sigil-photo');
      sigil.innerHTML = `<img src="${profile.portraitUrl}" alt="${escapeHtml(profile.name)} portrait" loading="eager" fetchpriority="high" decoding="async" width="104" height="104">`;
    } else {
      sigil.classList.remove('philosopher-sigil-photo');
      sigil.textContent = profile.initials;
    }
  }
  if (name) name.textContent = profile.name;
  if (period) period.textContent = profile.period;
  if (summary) summary.textContent = copy.summary;
  if (focus) focus.textContent = copy.focus;

  if (lenses) {
    lenses.innerHTML = profile.lenses
      .map(lens => `<a href="${lens.url}" class="philosopher-chip philosopher-lens-link">${escapeHtml(lens.label)}</a>`)
      .join('');
  }
}

function renderStats(profile) {
  const container = document.getElementById('philosopher-stats');
  if (!container) return;

  container.innerHTML = `
    <article class="profile-stat-card">
      <span class="profile-stat-label">Quotes</span>
      <span class="profile-stat-value">${profile.quoteCount}</span>
      <p class="profile-stat-caption">Curated lines in the collection that are attributed to ${escapeHtml(profile.name)}.</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">Related works</span>
      <span id="philosopher-related-count" class="profile-stat-value">${profile.linkedWorkCount}</span>
      <p id="philosopher-related-caption" class="profile-stat-caption">Titles already connected through PhiloMedia's quote pairings and thematic discovery.</p>
    </article>
    <article class="profile-stat-card">
      <span class="profile-stat-label">Core thread</span>
      <span class="profile-stat-value philosopher-stat-theme">${escapeHtml(profile.lenses?.[0]?.label || profile.themeLabels[0] || 'Philosophy')}</span>
      <p class="profile-stat-caption">The strongest recurring idea across this thinker's current quotes in the collection.</p>
    </article>
  `;
}

function updateRelatedWorkStat(profile, count) {
  const value = document.getElementById('philosopher-related-count');
  const caption = document.getElementById('philosopher-related-caption');
  if (value) value.textContent = String(Math.max(Number(count) || 0, Number(profile.linkedWorkCount) || 0));
  if (caption) {
    caption.textContent = `Works surfaced for ${profile.name} through curated links, thematic discovery, and philosophical reranking.`;
  }
}

function renderQuotes(profile) {
  const container = document.getElementById('philosopher-quotes');
  if (!container) return;

  container.innerHTML = profile.quotes
    .slice(0, QUOTE_LIMIT)
    .map(quote => `
      <article class="philosopher-quote-card">
        <p class="philosopher-quote-text">"${escapeHtml(quote.quote)}"</p>
        <div class="philosopher-chip-row">
          ${getQuoteThemeLabels(quote).map(label => `<span class="philosopher-chip">${escapeHtml(label)}</span>`).join('')}
        </div>
      </article>
    `)
    .join('');
}

function getQuoteThemeLabels(quote) {
  const explicitLabels = [...new Set(
    (quote.themes || [])
      .map(theme => formatThemeLabel(theme))
      .filter(label => label && label !== 'Philosophy')
  )];

  if (explicitLabels.length) {
    return explicitLabels.slice(0, 3);
  }

  return analyzeWorkForThemes(quote.quote || '')
    .slice(0, 3)
    .map(({ theme }) => formatThemeLabel(theme));
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
  if (!profile || !reference) return profile;

  return {
    ...profile,
    portraitUrl: profile.portraitUrl || reference.portraitUrl || '',
    period: needsReferenceMetadata(profile) && reference.period ? reference.period : profile.period,
    summary: needsReferenceMetadata(profile) && reference.summary ? reference.summary : profile.summary,
    focus: needsReferenceMetadata(profile) && reference.focus ? reference.focus : profile.focus,
    needsReferenceMetadata: false,
  };
}

function renderNotFound() {
  const state = document.getElementById('philosopher-state');
  const content = document.getElementById('philosopher-content');
  if (content) content.hidden = true;
  updatePageSeo({
    title: 'PhiloMedia | Thinker not found',
    description: 'The requested thinker page is not available in PhiloMedia right now.',
    path: window.location.pathname,
    type: 'website',
  });

  renderState(state, `
    <div class="error-state">
      <p class="error-state-title">This thinker is not available.</p>
      <p class="error-state-text">Return to the <a href="/html/philosophers.html">thinker index</a> and choose another voice from the collection.</p>
    </div>
  `);
}

async function rerankCandidatesWithReviews(profile, items) {
  const leadItems = items.slice(0, REVIEW_RERANK_LIMIT);
  const tailItems = items.slice(REVIEW_RERANK_LIMIT);

  const rerankedLead = await Promise.all(
    leadItems.map(async item => {
      const reviewContext = await getReviewContextForItem(item);
      const reviewScore = scoreProfileTextAffinity(profile, reviewContext);
      return {
        ...item,
        _reviewScore: reviewScore,
        _philosopherScore: (item._philosopherScore || 0) + reviewScore * 1.1 + (reviewContext ? 2 : 0),
      };
    })
  );

  return [...rerankedLead, ...tailItems].sort((a, b) =>
    (b._philosopherScore || 0) - (a._philosopherScore || 0)
    || (b._reviewScore || 0) - (a._reviewScore || 0)
    || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
    || (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
  );
}

async function renderRelatedWorks(profile) {
  const container = document.getElementById('philosopher-works');
  const summary = document.getElementById('philosopher-works-summary');

  if (!container) return;

  container.innerHTML = `
    <div class="loading-skeleton" aria-hidden="true">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
    <p class="loading-message">Tracing works that orbit ${escapeHtml(profile.name)}...</p>
  `;

  try {
    const [curatedWorks, discoveredWorks, keywordWorks] = await Promise.all([
      loadCuratedWorks(profile),
      loadThemeDiscovery(profile),
      loadKeywordDiscovery(profile),
    ]);

    let merged = mergeCandidateBuckets([
      { source: 'curated', items: curatedWorks },
      { source: 'discovery', items: discoveredWorks },
      { source: 'keyword', items: keywordWorks },
    ]);

    if (merged.length < WORK_LIMIT * 2) {
      const broadWorks = await loadBroadDiscovery();
      merged = mergeCandidateBuckets([
        { source: 'curated', items: curatedWorks },
        { source: 'discovery', items: discoveredWorks },
        { source: 'keyword', items: keywordWorks },
        { source: 'fallback', items: broadWorks },
      ]);
    }

    const rankedPool = merged
      .map(candidate => ({
        ...candidate,
        _philosopherScore: scoreCandidate(profile, candidate),
      }))
      .sort((a, b) =>
        b._philosopherScore - a._philosopherScore
        || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
        || (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
      );

    const reranked = await rerankCandidatesWithReviews(profile, rankedPool.slice(0, Math.max(WORK_LIMIT, REVIEW_RERANK_LIMIT)));
    const minimumScore = Number(profile.relatedWorkThreshold) || 24;
    const fallbackScore = Math.max(18, minimumScore - 8);
    const strongMatches = reranked.filter(item => (item._philosopherScore || 0) >= minimumScore);
    const fallbackMatches = reranked.filter(item => (item._philosopherScore || 0) >= fallbackScore);
    const ranked = (
      strongMatches.length >= Math.min(6, WORK_LIMIT)
        ? strongMatches
        : (fallbackMatches.length >= Math.min(4, WORK_LIMIT) ? fallbackMatches : reranked)
    ).slice(0, WORK_LIMIT);

    if (summary) {
      summary.textContent = `Works connected to ${profile.name} through curated quote pairings, thematic discovery, and philosophical reranking.`;
    }

    if (!ranked.length) {
      renderState(container, `
        <div class="empty-state">
          <p class="empty-state-title">No related works yet</p>
          <p class="empty-state-text">This thinker already has quotes in the collection, but the related works layer still needs more pairings.</p>
        </div>
      `);
      return;
    }

    updateRelatedWorkStat(profile, ranked.length);
    renderMediaCards(container, ranked, {
      overviewLength: 100,
    });
  } catch (error) {
    renderState(container, `
      <div class="error-state">
        <p class="error-state-title">We could not load related works.</p>
        <p class="error-state-text">The thinker page loaded, but the media layer could not be resolved right now.</p>
      </div>
    `);
  }
}

async function init() {
  setupLanguageChrome();
  setupAuthUI().catch(() => {});

  const slug = getSlugFromQuery();
  const state = document.getElementById('philosopher-state');
  const content = document.getElementById('philosopher-content');

  if (state) {
    state.innerHTML = `
      <div class="loading-skeleton philosopher-page-loading" aria-hidden="true">
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
    let profile = getPhilosopherProfileBySlug(
      filterPhilosopherCatalogQuotes(quotes, locale),
      slug,
      philosopherDirectory,
      submittedProfiles
    );

    if (!profile) {
      renderNotFound();
      return;
    }

    if (!profile.portraitUrl || needsReferenceMetadata(profile)) {
      const reference = await getPhilosopherReference(profile.name, profile.wikiTitle);
      if (reference) {
        profile = applyReferenceToProfile(profile, reference);
      }
    }

    if (state) state.innerHTML = '';
    if (content) content.hidden = false;

    renderHeader(profile);
    renderStats(profile);
    renderQuotes(profile);
    await renderRelatedWorks(profile);
  } catch (error) {
    renderNotFound();
  }
}

init();
