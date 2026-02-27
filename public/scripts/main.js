/**
 * Home page content: quote (API local ou fallback) + destaques (discover TMDB).
 * Fluxo leve: sem centenas de chamadas details/reviews.
 */
const API_BASE = '/api';

async function getQuoteForHome() {
  try {
    const res = await fetch(`${API_BASE}/quotes`);
    if (!res.ok) throw new Error('Quotes API error');
    const quotes = await res.json();
    if (Array.isArray(quotes) && quotes.length > 0) {
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      return {
        quote: q.quoteText || q.quote,
        author: q.authorName || q.author,
        themes: q.themes || [],
      };
    }
  } catch (e) {
    console.warn('Local quotes failed, using fallback:', e.message);
  }
  const { getQuotes } = await import('/scripts/philosophersapi.js');
  const allQuotes = await getQuotes();
  if (allQuotes.length === 0) {
    return { quote: 'Think deeply, watch meaningfully.', author: 'PhiloMedia', themes: [] };
  }
  const q = allQuotes[Math.floor(Math.random() * allQuotes.length)];
  return { quote: q.quote, author: q.author, themes: q.themes || [] };
}

async function getFeaturedMedia() {
  try {
    const randomMoviePage = Math.floor(Math.random() * 10) + 1;
    const randomTvPage = Math.floor(Math.random() * 10) + 1;

    const [movieRes, tvRes] = await Promise.all([
      fetch(`${API_BASE}/tmdb/discover?media=movie&page=${randomMoviePage}`),
      fetch(`${API_BASE}/tmdb/discover?media=tv&page=${randomTvPage}`),
    ]);
    const movies = movieRes.ok ? await movieRes.json() : [];
    const tv = tvRes.ok ? await tvRes.json() : [];
    const combined = [
      ...(movies || []).map((m) => ({ ...m, media_type: 'movie' })),
      ...(tv || []).map((m) => ({ ...m, media_type: 'tv' })),
    ];
    // Remove duplicados por id e embaralha para variar recomendações
    const byId = new Map();
    combined.forEach((item) => {
      if (item && item.id != null) {
        byId.set(item.id, item);
      }
    });
    const unique = Array.from(byId.values());
    unique.sort(() => Math.random() - 0.5);
    return unique.slice(0, 12);
  } catch (e) {
    console.warn('Discover failed:', e.message);
    return [];
  }
}

export async function loadContent() {
  const [quoteData, results] = await Promise.all([
    getQuoteForHome(),
    getFeaturedMedia(),
  ]);
  return {
    quote: quoteData.quote,
    author: quoteData.author,
    results: Array.isArray(results) ? results : [],
  };
}
