import { setupAuthUI } from '/scripts/auth-ui.js';
import {
  getPhilosopherDirectory,
  getPhilosopherReference,
  getQuoteCatalog,
  getSubmittedPhilosophers,
} from '/scripts/philosophersapi.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { discoverTMDB, getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { updatePageSeo } from '/scripts/seo.js';
import {
  CURATED_TV_IDS,
  THEME_GENRE_HINTS,
  formatThemeLabel,
  filterPhilosopherCatalogQuotes,
  getPhilosopherProfileBySlug,
} from '/scripts/philosopher-data.js';

const WORK_LIMIT = 8;
const QUOTE_LIMIT = 8;
const REVIEW_RERANK_LIMIT = 10;
const REVIEW_CONTEXT_LIMIT = 4200;
const reviewContextCache = new Map();
const CONTEXT_STOPWORDS = new Set([
  'about', 'across', 'after', 'always', 'appears', 'around', 'before', 'being',
  'between', 'beyond', 'collection', 'connected', 'discipline', 'examination',
  'experience', 'inside', 'layer', 'media', 'philosopher', 'philosophical',
  'philosophy', 'practice', 'presence', 'questions', 'reading', 'readings',
  'resonates', 'shape', 'shapes', 'site', 'stories', 'story', 'their', 'these',
  'through', 'title', 'titles', 'voice', 'works', 'world', 'would',
]);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || '';
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildThemeWeightMap(topThemes = []) {
  return new Map(
    topThemes.map((theme, index) => [theme, Math.max(6, 24 - index * 4)])
  );
}

function buildPhilosopherContext(profile) {
  return [
    profile.name,
    profile.summary,
    profile.focus,
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
      && !CONTEXT_STOPWORDS.has(token)
      && !authorTokens.has(token)
    );

  return [...new Set(keywords)].slice(0, limit);
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

function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return 'unknown';
}

function mergeCandidates(buckets) {
  const merged = new Map();

  buckets.forEach(({ source, items }) => {
    (items || []).forEach(item => {
      if (!item || item.id == null) return;

      const mediaType = getMediaType(item);
      if (mediaType !== 'movie' && mediaType !== 'tv') return;

      const key = `${mediaType}:${item.id}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          ...item,
          media_type: mediaType,
          _sources: [source],
        });
        return;
      }

      merged.set(key, {
        ...existing,
        ...item,
        media_type: mediaType,
        overview: existing.overview || item.overview || '',
        poster_path: existing.poster_path || item.poster_path || null,
        vote_average: Math.max(Number(existing.vote_average) || 0, Number(item.vote_average) || 0),
        popularity: Math.max(Number(existing.popularity) || 0, Number(item.popularity) || 0),
        genre_ids: Array.isArray(existing.genre_ids) && existing.genre_ids.length > 0
          ? existing.genre_ids
          : (item.genre_ids || []),
        _sources: [...new Set([...(existing._sources || []), source])],
      });
    });
  });

  return [...merged.values()];
}

function mapDetailsToCandidate(details, mediaType) {
  return {
    id: details.id,
    title: details.title ?? details.name,
    name: details.name ?? details.title,
    overview: details.overview || '',
    media_type: mediaType,
    poster_path: details.poster_path || null,
    release_date: details.release_date || null,
    first_air_date: details.first_air_date || null,
    vote_average: details.vote_average || 0,
    popularity: details.popularity || 0,
    genre_ids: Array.isArray(details.genres)
      ? details.genres.map(genre => genre?.id).filter(Boolean)
      : [],
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
    discoverTMDB('movie', {
      page: 1,
      withGenres: preferredGenres.movie.join('|'),
      sortBy: 'vote_average.desc',
    }),
    discoverTMDB('movie', {
      page: 1,
      withGenres: preferredGenres.movie.join('|'),
      sortBy: 'popularity.desc',
    }),
    discoverTMDB('tv', {
      page: 1,
      withGenres: preferredGenres.tv.join('|'),
      sortBy: 'vote_average.desc',
    }),
    discoverTMDB('tv', {
      page: 1,
      withGenres: preferredGenres.tv.join('|'),
      sortBy: 'popularity.desc',
    }),
  ]);

  return mergeCandidates([
    { source: 'movie-rated', items: moviesByRating },
    { source: 'movie-popular', items: moviesByPopularity },
    { source: 'tv-rated', items: seriesByRating },
    { source: 'tv-popular', items: seriesByPopularity },
  ]);
}

async function loadBroadDiscovery() {
  const [moviesByRating, moviesByPopularity, seriesByRating, seriesByPopularity] = await Promise.all([
    discoverTMDB('movie', {
      page: 1,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDB('movie', {
      page: 1,
      sortBy: 'popularity.desc',
    }),
    discoverTMDB('tv', {
      page: 1,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDB('tv', {
      page: 1,
      sortBy: 'popularity.desc',
    }),
  ]);

  return mergeCandidates([
    { source: 'movie-rated-fallback', items: moviesByRating },
    { source: 'movie-popular-fallback', items: moviesByPopularity },
    { source: 'tv-rated-fallback', items: seriesByRating },
    { source: 'tv-popular-fallback', items: seriesByPopularity },
  ]);
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
  const contextKeywords = extractContextKeywords(profile);
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

  profile.topThemes.slice(0, 3).forEach((theme, index) => {
    const label = normalizeText(formatThemeLabel(theme));
    if (label && normalizedText.includes(label)) {
      score += Math.max(3, 10 - index * 1.5);
    }
  });

  return score;
}

function scoreCandidate(profile, candidate) {
  const themeWeights = buildThemeWeightMap(profile.topThemes);
  const text = `${candidate.title || candidate.name || ''} ${candidate.overview || ''}`.trim();
  const candidateThemes = new Set(
    analyzeWorkForThemes(text)
      .slice(0, 5)
      .map(match => match.theme)
  );
  const normalized = normalizeText(text);
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

  return score;
}

function renderState(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

function renderHeader(profile) {
  updatePageSeo({
    title: `PhiloMedia | ${profile.name}`,
    description: profile.summary || `${profile.name} in PhiloMedia, with signature quotes, philosophical lenses, and related works.`,
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
      sigil.innerHTML = `<img src="${profile.portraitUrl}" alt="${escapeHtml(profile.name)} portrait" loading="lazy">`;
    } else {
      sigil.classList.remove('philosopher-sigil-photo');
      sigil.textContent = profile.initials;
    }
  }
  if (name) name.textContent = profile.name;
  if (period) period.textContent = profile.period;
  if (summary) summary.textContent = profile.summary;
  if (focus) focus.textContent = profile.focus;

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
      <span class="profile-stat-label">Dominant theme</span>
      <span class="profile-stat-value philosopher-stat-theme">${escapeHtml(profile.themeLabels[0] || 'Philosophy')}</span>
      <p class="profile-stat-caption">The strongest recurring idea across this philosopher's current quotes in the collection.</p>
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
    title: 'PhiloMedia | Philosopher not found',
    description: 'The requested philosopher page is not available in PhiloMedia right now.',
    path: window.location.pathname,
    type: 'website',
  });

  renderState(state, `
    <div class="error-state">
      <p class="error-state-title">This philosopher is not available.</p>
      <p class="error-state-text">Return to the <a href="/html/philosophers.html">philosopher index</a> and choose another thinker from the collection.</p>
    </div>
  `);
}

function buildReviewContext(reviews = []) {
  return reviews
    .map(review => review?.content || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, REVIEW_CONTEXT_LIMIT);
}

async function getReviewContextForItem(item) {
  const cacheKey = `${item.media_type}:${item.id}`;
  if (reviewContextCache.has(cacheKey)) {
    return reviewContextCache.get(cacheKey);
  }

  const reviews = await getReviewsFromTMDB(item.id, item.media_type).catch(() => []);
  const context = buildReviewContext(reviews);
  reviewContextCache.set(cacheKey, context);
  return context;
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
    const [curatedWorks, discoveredWorks, broadWorks] = await Promise.all([
      loadCuratedWorks(profile),
      loadThemeDiscovery(profile),
      loadBroadDiscovery(),
    ]);

    const merged = mergeCandidates([
      { source: 'curated', items: curatedWorks },
      { source: 'discovery', items: discoveredWorks },
      { source: 'fallback', items: broadWorks },
    ]);

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
    const strongMatches = reranked.filter(item => (item._philosopherScore || 0) >= 24);
    const ranked = (strongMatches.length >= 6 ? strongMatches : reranked).slice(0, WORK_LIMIT);

    if (summary) {
      summary.textContent = `Works connected to ${profile.name} through curated quote pairings, thematic discovery, and philosophical reranking.`;
    }

    if (!ranked.length) {
      renderState(container, `
        <div class="empty-state">
          <p class="empty-state-title">No related works yet</p>
          <p class="empty-state-text">This philosopher already has quotes in the collection, but the related works layer still needs more pairings.</p>
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
        <p class="error-state-text">The philosopher page loaded, but the media layer could not be resolved right now.</p>
      </div>
    `);
  }
}

async function init() {
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
    const [quotes, philosopherDirectory, submittedProfiles] = await Promise.all([
      getQuoteCatalog('en'),
      getPhilosopherDirectory(),
      getSubmittedPhilosophers(),
    ]);
    let profile = getPhilosopherProfileBySlug(
      filterPhilosopherCatalogQuotes(quotes),
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
