import { getUiLocale, normalizeUiLocale } from '/scripts/services/uiLocale.js';

const PORTUGUESE_MARKERS = [
  ' não ', ' voce ', ' você ', ' para ', ' porque ', ' quando ',
  ' uma ', ' umas ', ' está ', ' esse ', ' essa ', 'ção', 'ões',
];

function looksPortuguese(text) {
  const value = ` ${String(text || '').toLowerCase()} `;
  return PORTUGUESE_MARKERS.some(marker => value.includes(marker));
}

export function itemAlreadyLocalized(item, locale) {
  if (!item?.overview) return false;
  if (item._overviewLocale === locale) return true;
  if (locale === 'pt' && looksPortuguese(item.overview)) return true;
  return false;
}

/**
 * Texto EN para o motor hermenêutico; overview visível pode ser PT.
 */
export function scoringOverview(item) {
  if (!item) return '';
  return String(item._overviewEn || item.overview || '');
}

/**
 * Overlay de sinopses PT sobre o catálogo EN, sem getDetails extra.
 */
export function overlayPortugueseOverviews(catalogItems, ptItems) {
  if (!Array.isArray(catalogItems) || !catalogItems.length) return catalogItems;
  const ptById = new Map();
  (ptItems || []).forEach(item => {
    const id = item?.id ?? item.tmdbId;
    if (id == null) return;
    ptById.set(String(id), item);
  });

  return catalogItems.map(item => {
    const id = item?.id ?? item.tmdbId;
    const pt = id == null ? null : ptById.get(String(id));
    const overviewEn = item._overviewEn || item.overview || '';
    if (!pt?.overview) {
      return { ...item, _overviewEn: overviewEn };
    }
    return {
      ...item,
      _overviewEn: overviewEn,
      overview: pt.overview,
      _overviewLocale: 'pt',
    };
  });
}

/**
 * Mantém o pool de obras do catálogo EN, mas substitui sinopses visíveis em PT-BR.
 * Não refetch se o item já veio com overview no locale (discover/search/details PT).
 * Sem getDetails extra — related/home/search devem trazer PT no payload da lista.
 */
export function localizeItemOverviews(items, locale = getUiLocale()) {
  const loc = normalizeUiLocale(locale);
  if (loc !== 'pt' || !Array.isArray(items) || !items.length) {
    return items;
  }

  return items.map((item) => {
    if (itemAlreadyLocalized(item, 'pt')) {
      return item._overviewLocale ? item : { ...item, _overviewLocale: 'pt' };
    }
    return item;
  });
}
