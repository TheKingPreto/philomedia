import { setupAuthUI } from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getPhilosopherPortrait,
  getPhilosopherReference,
  getQuoteCatalog,
  getSubmittedPhilosophers,
} from '/scripts/philosophersapi.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { getDetailsFromTMDB } from '/scripts/seriesapi.js';
import { discoverTMDBCached, searchTMDBCached } from '/scripts/services/tmdbCachedClient.js';
import { getReviewContextForItem } from '/scripts/services/searchLensReviewRerankService.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { getLensById } from '/scripts/domain/searchFilters.js';
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
import { fillPortraitHost } from '/scripts/domain/safePortraitUrl.js';
import {
  formatThemeLabelForLocale,
  localizeThinkerCard,
} from '/scripts/services/philosopherDisplayI18n.js';
import { getDisplayQuoteText } from '/scripts/services/quoteDisplayResolve.js';
import { t } from '/scripts/services/i18n.js';
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

function getProfileKeywordQuery(profile) {
  const ids = [];
  for (const lens of profile.lenses || []) {
    const definition = getLensById(lens.id);
    if (!definition) continue;
    for (const item of definition.tmdbKeywords || []) {
      const id = Number(item.id);
      if (Number.isInteger(id) && id > 0) ids.push(id);
    }
  }
  return [...new Set(ids)].join('|');
}

async function loadThemeDiscovery(profile) {
  const preferredGenres = getPreferredGenres(profile);
  const withKeywords = getProfileKeywordQuery(profile);

  const [moviesByRating, moviesByPopularity, seriesByRating, seriesByPopularity, keywordMovies, keywordSeries] = await Promise.all([
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
    withKeywords
      ? discoverTMDBCached('movie', { page: 1, withKeywords, sortBy: 'vote_average.desc' })
      : Promise.resolve([]),
    withKeywords
      ? discoverTMDBCached('tv', { page: 1, withKeywords, sortBy: 'vote_average.desc' })
      : Promise.resolve([]),
  ]);

  return mergeCandidateBuckets([
    { source: 'movie-rated', items: moviesByRating },
    { source: 'movie-popular', items: moviesByPopularity },
    { source: 'tv-rated', items: seriesByRating },
    { source: 'tv-popular', items: seriesByPopularity },
    { source: 'movie-keywords', items: keywordMovies },
    { source: 'tv-keywords', items: keywordSeries },
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

function showSigilFallback(sigil, profile) {
  if (!sigil) return;
  sigil.classList.remove('philosopher-sigil-photo');
  sigil.removeAttribute('aria-hidden');
  sigil.setAttribute('aria-hidden', 'true');
  sigil.innerHTML = '';
  sigil.textContent = profile.initials || '';
}

function bindPortraitFallback(sigil, profile) {
  const img = sigil?.querySelector('img');
  if (!img) return;

  img.addEventListener('error', () => {
    if (sigil.dataset.wikimediaTried === '1') {
      showSigilFallback(sigil, profile);
      return;
    }

    sigil.dataset.wikimediaTried = '1';
    showSigilFallback(sigil, profile);

    getPhilosopherPortrait(profile.name, profile.wikiTitle)
      .then(url => {
        if (!url || url === img.getAttribute('src')) return;
        applyPortrait(sigil, profile, url);
      })
      .catch(() => {});
  }, { once: true });
}

function applyPortrait(sigil, profile, url) {
  if (!sigil) return;

  const applied = fillPortraitHost(sigil, {
    url,
    alt: t('philosophers.portrait_alt', { name: profile.name }),
    initials: profile.initials,
    loading: 'eager',
    width: 176,
    height: 220,
    fetchPriority: 'high',
    decoding: 'async',
  });

  if (applied) {
    bindPortraitFallback(sigil, profile);
  } else {
    showSigilFallback(sigil, profile);
  }
}

function renderHeader(profile) {
  const loc = getUiLocale();
  const copy = getThinkerCopyForLocale(profile, loc);
  const display = localizeThinkerCard(profile, loc);
  updatePageSeo({
    title: t('philosopher.seo_title', { name: profile.name }),
    description: copy.summary || t('philosopher.seo_description', { name: profile.name }),
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
      applyPortrait(sigil, profile, profile.portraitUrl);
    } else {
      showSigilFallback(sigil, profile);
    }
  }
  if (name) name.textContent = profile.name;
  if (period) period.textContent = display.period;
  if (summary) summary.textContent = display.summary;
  if (focus) focus.textContent = display.focus || copy.focus;

  if (lenses) {
    lenses.innerHTML = profile.lenses
      .map(lens => {
        const label = formatLensLabel(lens, loc);
        return `<a href="${lens.url}" class="philosopher-chip philosopher-lens-link">${escapeHtml(label)}</a>`;
      })
      .join('');
  }
}

function formatLensLabel(lens, loc) {
  if (lens?.id) {
    const key = `search.lens.${lens.id}.label`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return formatThemeLabelForLocale(lens.id, loc);
  }
  return lens?.label || '';
}

function getCoreThreadLabel(profile) {
  const loc = getUiLocale();
  const lens = profile.lenses?.[0];
  if (lens?.id) return formatLensLabel(lens, loc);
  if (profile.topThemes?.[0]) return formatThemeLabelForLocale(profile.topThemes[0], loc);
  return t('philosopher.stat_thread_fallback');
}

function renderStats(profile) {
  const container = document.getElementById('philosopher-stats');
  if (!container) return;

  const hasQuotes = Number(profile.quoteCount) > 0;
  const quoteCaption = hasQuotes
    ? t('philosopher.stat_quotes_caption', { name: profile.name })
    : t('philosopher.stat_quotes_caption_empty', { name: profile.name });
  const threadCaption = hasQuotes
    ? t('philosopher.stat_thread_caption')
    : t('philosopher.stat_thread_caption_empty');

  container.innerHTML = `
    <div class="philosopher-meta-item">
      <span class="philosopher-meta-label">${escapeHtml(t('philosopher.stat_quotes'))}</span>
      <span class="philosopher-meta-value">${profile.quoteCount}</span>
      <p class="philosopher-meta-caption">${escapeHtml(quoteCaption)}</p>
    </div>
    <div class="philosopher-meta-item">
      <span class="philosopher-meta-label">${escapeHtml(t('philosopher.stat_works'))}</span>
      <span id="philosopher-related-count" class="philosopher-meta-value">${profile.linkedWorkCount}</span>
      <p id="philosopher-related-caption" class="philosopher-meta-caption">${escapeHtml(t('philosopher.stat_works_caption'))}</p>
    </div>
    <div class="philosopher-meta-item">
      <span class="philosopher-meta-label">${escapeHtml(t('philosopher.stat_thread'))}</span>
      <span class="philosopher-meta-value philosopher-stat-theme">${escapeHtml(getCoreThreadLabel(profile))}</span>
      <p class="philosopher-meta-caption">${escapeHtml(threadCaption)}</p>
    </div>
  `;
}

function updateRelatedWorkStat(profile, count) {
  const value = document.getElementById('philosopher-related-count');
  const caption = document.getElementById('philosopher-related-caption');
  if (value) value.textContent = String(Math.max(Number(count) || 0, Number(profile.linkedWorkCount) || 0));
  if (caption) {
    caption.textContent = t('philosopher.stat_works_caption_live', { name: profile.name });
  }
}

function renderQuotes(profile) {
  const container = document.getElementById('philosopher-quotes');
  if (!container) return;

  const quotes = profile.quotes || [];
  if (!quotes.length) {
    container.innerHTML = `
      <div class="empty-state philosopher-empty-state">
        <p class="empty-state-title">${escapeHtml(t('philosopher.quotes_empty_title'))}</p>
        <p class="empty-state-text">${escapeHtml(t('philosopher.quotes_empty_text'))}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = quotes
    .slice(0, QUOTE_LIMIT)
    .map(quote => `
      <article class="philosopher-quote-card">
        <p class="philosopher-quote-text">"${escapeHtml(getDisplayQuoteText(quote))}"</p>
        <div class="philosopher-chip-row">
          ${getQuoteThemeLabels(quote).map(label => `<span class="philosopher-chip">${escapeHtml(label)}</span>`).join('')}
        </div>
      </article>
    `)
    .join('');
}

function getQuoteThemeLabels(quote) {
  const loc = getUiLocale();
  const fallback = t('philosopher.stat_thread_fallback');
  const explicitLabels = [...new Set(
    (quote.themes || [])
      .map(theme => formatThemeLabelForLocale(theme, loc))
      .filter(label => label && label !== fallback)
  )];

  if (explicitLabels.length) {
    return explicitLabels.slice(0, 3);
  }

  return analyzeWorkForThemes(quote.quote || '')
    .slice(0, 3)
    .map(({ theme }) => formatThemeLabelForLocale(theme, loc))
    .filter(label => label && label !== fallback);
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
    title: t('philosopher.seo_not_found_title'),
    description: t('philosopher.seo_not_found_description'),
    path: window.location.pathname,
    type: 'website',
  });

  renderState(state, `
    <div class="error-state">
      <p class="error-state-title">${escapeHtml(t('philosopher.not_found_title'))}</p>
      <p class="error-state-text">${escapeHtml(t('philosopher.not_found_text'))}</p>
      <p><a href="/html/philosophers.html">${escapeHtml(t('philosopher.not_found_link'))}</a></p>
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
    <p class="loading-message">${escapeHtml(t('philosopher.works_loading', { name: profile.name }))}</p>
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

    if (merged.length < WORK_LIMIT * 2 && (profile.quoteCount > 0 || (profile.linkedWorkIds || []).length > 0)) {
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
      summary.textContent = t('philosopher.works_summary', { name: profile.name });
    }

    if (!ranked.length) {
      renderState(container, `
        <div class="empty-state philosopher-empty-state">
          <p class="empty-state-title">${escapeHtml(t('philosopher.works_empty_title'))}</p>
          <p class="empty-state-text">${escapeHtml(t('philosopher.works_empty_text'))}</p>
        </div>
      `);
      return;
    }

    updateRelatedWorkStat(profile, ranked.length);
    renderMediaCards(container, ranked, {
      overviewLength: 100,
      philosopherSlug: profile.slug,
    });
  } catch (error) {
    renderState(container, `
      <div class="error-state">
        <p class="error-state-title">${escapeHtml(t('philosopher.works_error_title'))}</p>
        <p class="error-state-text">${escapeHtml(t('philosopher.works_error_text'))}</p>
      </div>
    `);
  }
}

async function hydrateReference(profile) {
  if (!profile) return null;
  if (profile.portraitUrl && !needsReferenceMetadata(profile)) return null;

  try {
    const reference = await getPhilosopherReference(profile.name, profile.wikiTitle);
    if (!reference) return null;
    return applyReferenceToProfile(profile, reference);
  } catch (error) {
    return null;
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

    if (state) state.innerHTML = '';
    if (content) content.hidden = false;

    renderHeader(profile);
    renderStats(profile);
    renderQuotes(profile);

    const referenceTask = hydrateReference(profile)
      .then(updated => {
        if (!updated) return;
        profile = updated;
        renderHeader(profile);
        renderStats(profile);
      })
      .catch(() => {});

    await Promise.all([
      renderRelatedWorks(profile),
      referenceTask,
    ]);
  } catch (error) {
    renderNotFound();
  }
}

init();
