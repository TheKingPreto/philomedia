import { formatThemeLabel } from '/scripts/domain/canonicalThemes.js';
import { resolveQuoteForLocale } from '/scripts/domain/quoteDisplay.js';
import { PHILOSOPHER_DEF_PT } from '/scripts/services/philosopherDefPt.js';
import { t } from '/scripts/services/i18n.js';
import { getThinkerCopyForLocale, getUiLocale, normalizeUiLocale } from '/scripts/services/uiLocale.js';

const THEME_LABEL_KEYS = {
  epistemology: 'theme.label.epistemology',
  'self-knowledge': 'theme.label.self_knowledge',
  virtue: 'theme.label.virtue',
  'power-corruption': 'theme.label.power_corruption',
  'political-philosophy': 'theme.label.political_philosophy',
  existentialism: 'theme.label.existentialism',
  stoicism: 'theme.label.stoicism',
  'memory-time': 'theme.label.memory_time',
  alienation: 'theme.label.alienation',
  'social-justice': 'theme.label.social_justice',
  'consciousness-ai': 'theme.label.consciousness_ai',
  'utopia-dystopia': 'theme.label.utopia_dystopia',
  humanism: 'theme.label.humanism',
  metaphysics: 'theme.label.metaphysics',
  'truth-deception': 'theme.label.truth_deception',
  'sacred-profane': 'theme.label.sacred_profane',
  suffering: 'theme.label.suffering',
  aesthetics: 'theme.label.aesthetics',
  hedonism: 'theme.label.hedonism',
  'technology-modernity': 'theme.label.technology_modernity',
  'language-semiotics': 'theme.label.language_semiotics',
  'social-contract': 'theme.label.social_contract',
  romanticism: 'theme.label.romanticism',
  'feminism-equality': 'theme.label.feminism_equality',
  idealism: 'theme.label.idealism',
  utilitarianism: 'theme.label.utilitarianism',
  'conformity-individuality': 'theme.label.conformity_individuality',
  'the-other-alterity': 'theme.label.the_other_alterity',
  'heros-journey': 'theme.label.heros_journey',
};

export function formatThemeLabelForLocale(theme, locale = getUiLocale()) {
  const key = THEME_LABEL_KEYS[theme];
  if (!key) return formatThemeLabel(theme);
  const label = t(key);
  return label === key ? formatThemeLabel(theme) : label;
}

export function resolveClientQuoteText(quote, locale = getUiLocale()) {
  return resolveQuoteForLocale(quote, locale);
}

export function localizeThinkerCard(profile, locale = getUiLocale()) {
  if (!profile) return { period: '', summary: '', themeLabels: [], quotePreview: '' };

  const loc = normalizeUiLocale(locale);
  const copy = getThinkerCopyForLocale(profile, loc);
  const ptDef = PHILOSOPHER_DEF_PT[profile.slug];

  const period = loc === 'pt' && ptDef?.period ? ptDef.period : profile.period;
  let summary = copy.summary;
  if (loc === 'pt' && ptDef?.summary) {
    summary = ptDef.summary;
  }

  const themeLabels = (profile.topThemes || []).map(theme => formatThemeLabelForLocale(theme, loc));

  const featured = profile.featuredQuote || profile.quotes?.[0];
  const quotePreview = featured
    ? resolveClientQuoteText(featured, loc)
    : profile.featuredQuotePreview;

  return { period, summary, themeLabels, quotePreview };
}
