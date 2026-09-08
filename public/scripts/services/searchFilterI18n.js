import { getLensById } from '/scripts/domain/searchFilters.js';
import { t } from './i18n.js';

/**
 * @param {{ id: string, label: string, summary?: string }} filter
 * @param {'lens'|'media'|'rating'|'sort'} group
 */
export function getLocalizedFilterCopy(filter, group) {
  if (!filter?.id) {
    return { label: '', summary: '' };
  }

  const labelKey = `search.${group}.${filter.id}.label`;
  const label = t(labelKey);
  const resolvedLabel = label === labelKey ? filter.label : label;

  if (group !== 'lens') {
    return { label: resolvedLabel, summary: '' };
  }

  const summaryKey = `search.lens.${filter.id}.summary`;
  const summary = t(summaryKey);
  const resolvedSummary = summary === summaryKey ? (filter.summary || '') : summary;

  return { label: resolvedLabel, summary: resolvedSummary };
}

export function getLocalizedLensById(lensId) {
  const lens = getLensById(lensId);
  if (!lens) return null;

  const copy = getLocalizedFilterCopy(lens, 'lens');
  return { ...lens, label: copy.label, summary: copy.summary };
}

export function getLensToggleCopy(expanded) {
  return expanded ? t('search.lenses_show_fewer') : t('search.lenses_show_all');
}
