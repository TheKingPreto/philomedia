/**
 * Catálogo de citações para páginas que não precisam do diretório Wikipedia
 * (details, home). philosophersapi.js reexporta estas funções e guarda o
 * restante (retratos, directory, contribuições).
 *
 * custom-quotes.js só entra no fallback se /api/quotes falhar — a página de
 * details não puxa ~12 KB de citações locais no caminho feliz.
 */

const API_QUOTES_ENDPOINT = '/api/quotes';
const API_QUOTES_CATALOG_ENDPOINT = '/api/quotes/catalog';

const quoteCatalogPromises = new Map();

async function fetchFromDB() {
  const pageSize = 500;
  let page = 1;
  const docs = [];

  for (;;) {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    const res = await fetch(`${API_QUOTES_ENDPOINT}?${qs.toString()}`);
    if (!res.ok) throw new Error(`/api/quotes responded ${res.status}`);

    const payload = await res.json();

    if (payload?.data && Array.isArray(payload.data)) {
      docs.push(...payload.data);
      const totalPages = typeof payload.totalPages === 'number' ? payload.totalPages : page;
      if (page >= totalPages || payload.data.length === 0) break;
      page += 1;
      continue;
    }

    if (Array.isArray(payload)) {
      docs.push(...payload);
      break;
    }

    throw new Error('Unexpected quotes payload shape from /api/quotes');
  }

  if (docs.length === 0) throw new Error('Empty quotes from DB');

  return docs.map(doc => {
    const orig = String(doc.quoteLanguage || 'en').trim().toLowerCase() || 'en';
    const trans = doc.quoteTranslations && typeof doc.quoteTranslations === 'object'
      ? doc.quoteTranslations
      : {};
    const canonical = String(doc.quoteText || '').trim();
    const quoteEn = String(trans.en || '').trim() || (orig === 'en' ? canonical : '');
    const quotePt = String(trans.pt || '').trim() || (orig === 'pt' ? canonical : '');

    return {
      id: doc.legacyId ?? doc._id,
      quote: canonical,
      author: doc.authorName,
      themes: doc.themes || [],
      originalLanguage: orig,
      quote_original: canonical,
      quote_en: quoteEn,
      quote_pt: quotePt,
    };
  });
}

async function fetchQuoteCatalogFromBackend(lang = 'en') {
  const res = await fetch(`${API_QUOTES_CATALOG_ENDPOINT}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`/api/quotes/catalog responded ${res.status}`);

  const docs = await res.json();
  if (!Array.isArray(docs) || docs.length === 0) throw new Error('Empty quote catalog');

  return docs.map(doc => ({
    id: doc.id,
    quote: doc.quote,
    author: doc.author,
    themes: doc.themes || [],
    source: doc.source || 'catalog',
    lang: doc.lang,
    originalLanguage: doc.originalLanguage,
    quote_original: doc.quote_original,
    quote_en: doc.quote_en,
    quote_pt: doc.quote_pt,
    translationStatus: doc.translationStatus,
  }));
}

async function fetchFromExternalAndLocal() {
  const { customQuotes } = await import('/scripts/custom-quotes.js');
  const { getCustomQuoteTranslationPt } = await import('/scripts/services/customQuoteTranslationsPt.js');

  let apiQuotes = [];

  try {
    const [quotesRes, philosophersRes] = await Promise.all([
      fetch('https://philosophersapi.com/api/quotes'),
      fetch('https://philosophersapi.com/api/philosophers'),
    ]);

    if (!quotesRes.ok || !philosophersRes.ok) {
      throw new Error('External philosophers API unavailable');
    }

    const quotesData = await quotesRes.json();
    const philosophersData = await philosophersRes.json();
    const philosopherMap = new Map(philosophersData.map(p => [p.id, p.name]));

    apiQuotes = quotesData.map(q => ({
      id: q.id || null,
      quote: q.quote,
      author: q.philosopher ? (philosopherMap.get(q.philosopher.id) || 'Unknown') : 'Unknown',
      themes: q.tags || [],
    }));
  } catch (err) {
    console.warn('[PhiloMedia] External API unavailable, using local quotes only:', err.message);
  }

  const combined = new Map();
  customQuotes.forEach(q => {
    const quotePt = getCustomQuoteTranslationPt(q.id);
    combined.set(q.quote, {
      id: q.id,
      quote: q.quote,
      author: q.author,
      themes: q.themes || [],
      originalLanguage: 'en',
      quote_original: q.quote,
      quote_en: q.quote,
      quote_pt: quotePt,
    });
  });
  apiQuotes.forEach(q => { if (!combined.has(q.quote)) combined.set(q.quote, q); });

  return Array.from(combined.values());
}

export async function getQuotes() {
  try {
    return await fetchFromDB();
  } catch (err) {
    console.warn('[PhiloMedia] DB quotes unavailable, falling back to external API:', err.message);
  }

  try {
    return await fetchFromExternalAndLocal();
  } catch (err) {
    console.warn('[PhiloMedia] All quote sources failed:', err.message);
    return [];
  }
}

export async function getQuoteCatalog(lang = 'en') {
  const locale = String(lang || 'en').trim().toLowerCase();

  if (!quoteCatalogPromises.has(locale)) {
    quoteCatalogPromises.set(locale, fetchQuoteCatalogFromBackend(locale)
      .catch(err => {
        console.warn('[PhiloMedia] Quote catalog unavailable, falling back to regular quotes:', err.message);
        return getQuotes();
      }));
  }

  return quoteCatalogPromises.get(locale);
}
