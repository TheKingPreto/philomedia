/**
 * IDs de tema canônicos (slugs) + aliases PT/EN para normalização estável
 * em matching, filtros e armazenamento — sem depender do idioma da UI.
 */
import { THEME_DATABASE } from '../themedatabase.js';

export const CANONICAL_THEME_IDS = new Set(Object.keys(THEME_DATABASE));

export const THEME_ALIASES = {
  idealismo: 'idealism',
  empirismo: 'epistemology',
  ciencia: 'epistemology',
  literatura: 'aesthetics',
  existencialismo: 'existentialism',
  'filosofia politica': 'political-philosophy',
  utilitarismo: 'utilitarianism',
  patristica: 'sacred-profane',
  evolucao: 'epistemology',
  evolution: 'epistemology',
  biologia: 'epistemology',
  biology: 'epistemology',
  'selecao natural': 'epistemology',
  'natural selection': 'epistemology',
  'historia natural': 'epistemology',
  'natural history': 'epistemology',
  'metodo cientifico': 'epistemology',
  'scientific method': 'epistemology',
  'investigacao cientifica': 'epistemology',
  'scientific inquiry': 'epistemology',
  adaptacao: 'epistemology',
  adaptation: 'epistemology',
  'origem das especies': 'epistemology',
  'origin of species': 'epistemology',
  'literatura brasileira': 'aesthetics',
  'psicologia e filosofia': 'self-knowledge',
  psicanalise: 'self-knowledge',
  iluminismo: 'humanism',
  linguagem: 'language-semiotics',
  pessimismo: 'suffering',
  racionalismo: 'epistemology',
  feminismo: 'feminism-equality',
  'filosofia pre socratica': 'metaphysics',
  'ciencia e filosofia': 'epistemology',
  'matematica e filosofia': 'epistemology',
  neoplatonismo: 'metaphysics',
  hedonismo: 'hedonism',
  invencao: 'technology-modernity',
  'politica e ciencia': 'political-philosophy',
  educacao: 'humanism',
  'filosofia e literatura': 'aesthetics',
  budismo: 'sacred-profane',
  cosmologia: 'metaphysics',
  'arte e ciencia': 'aesthetics',
  contratualismo: 'social-contract',
  'direitos humanos': 'social-justice',
  'direitos civis': 'social-justice',
  'filosofia chinesa': 'humanism',
  romantismo: 'romanticism',
  estoicismo: 'stoicism',
  etica: 'virtue',
  politica: 'political-philosophy',
};

export function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhilosopherTheme(theme) {
  const rawTheme = String(theme || '').trim().toLowerCase();
  if (!rawTheme) return '';
  if (CANONICAL_THEME_IDS.has(rawTheme)) return rawTheme;

  const normalized = normalizeKey(rawTheme);
  if (!normalized) return '';

  const hyphenated = normalized.replace(/\s+/g, '-');
  if (CANONICAL_THEME_IDS.has(hyphenated)) return hyphenated;

  return THEME_ALIASES[normalized] || '';
}

export function normalizeQuoteThemes(themes = []) {
  return [...new Set(
    (themes || [])
      .map(normalizePhilosopherTheme)
      .filter(Boolean)
  )];
}

export function formatThemeLabel(theme) {
  const normalizedTheme = normalizePhilosopherTheme(theme) || String(theme || '').trim().toLowerCase();

  return String(normalizedTheme || '')
    .split('-')
    .filter(Boolean)
    .map(part => (part === 'ai' ? 'AI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}
