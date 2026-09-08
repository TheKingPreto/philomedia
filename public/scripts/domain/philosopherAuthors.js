import { normalizeKey } from './canonicalThemes.js';

/**
 * @file philosopherAuthors.js
 * @description Identidade dos pensadores curados: slug, nome canónico e apelidos.
 *
 * Existe separado de philosopher-data.js porque a home e a página de detalhes
 * só precisam resolver "nome do autor" → nome exibível e URL do perfil. Importar
 * o módulo completo trazia ~40 KB de biografias que essas páginas nunca leem.
 * philosopher-data.js consome esta lista para montar PHILOSOPHER_DEFINITIONS,
 * então continua havendo uma única fonte de verdade para slugs e apelidos.
 */
export const PHILOSOPHER_AUTHORS = [
  {
    slug: 'socrates',
    name: 'Socrates',
    aliases: ['Socrates'],
  },
  {
    slug: 'plato',
    name: 'Plato',
    aliases: ['Plato'],
  },
  {
    slug: 'aristotle',
    name: 'Aristotle',
    aliases: ['Aristotle'],
  },
  {
    slug: 'niccolo-machiavelli',
    name: 'Niccolò Machiavelli',
    aliases: ['Niccolò Machiavelli', 'Niccolo Machiavelli', 'NiccolÃ² Machiavelli'],
  },
  {
    slug: 'john-locke',
    name: 'John Locke',
    aliases: ['John Locke'],
  },
  {
    slug: 'charles-darwin',
    name: 'Charles Darwin',
    aliases: ['Charles Darwin', 'Darwin'],
  },
  {
    slug: 'karl-marx',
    name: 'Karl Marx',
    aliases: ['Karl Marx'],
  },
  {
    slug: 'friedrich-nietzsche',
    name: 'Friedrich Nietzsche',
    aliases: ['Friedrich Nietzsche', 'Nietzsche'],
  },
  {
    slug: 'simone-de-beauvoir',
    name: 'Simone de Beauvoir',
    aliases: ['Simone de Beauvoir'],
  },
  {
    slug: 'clovis-de-barros-filho',
    name: 'Clóvis de Barros Filho',
    aliases: ['Clóvis de Barros Filho', 'Clovis de Barros Filho', 'ClÃ³vis de Barros Filho'],
  },
  {
    slug: 'leandro-karnal',
    name: 'Leandro Karnal',
    aliases: ['Leandro Karnal'],
  },
  {
    slug: 'mario-sergio-cortella',
    name: 'Mário Sergio Cortella',
    aliases: ['Mário Sergio Cortella', 'Mario Sergio Cortella', 'MÃ¡rio Sergio Cortella'],
  },
  {
    slug: 'lucas-costa-roxo',
    name: 'Lucas Costa Roxo',
    aliases: ['Lucas Costa Roxo', 'Lucas C. Roxo'],
  },
  {
    slug: 'immanuel-kant',
    name: 'Immanuel Kant',
    aliases: ['Immanuel Kant'],
  },
  {
    slug: 'baruch-spinoza',
    name: 'Baruch Spinoza',
    aliases: ['Baruch Spinoza'],
  },
  {
    slug: 'david-hume',
    name: 'David Hume',
    aliases: ['David Hume'],
  },
  {
    slug: 'ludwig-wittgenstein',
    name: 'Ludwig Wittgenstein',
    aliases: ['Ludwig Wittgenstein'],
  },
  {
    slug: 'arthur-schopenhauer',
    name: 'Arthur Schopenhauer',
    aliases: ['Arthur Schopenhauer'],
  },
  {
    slug: 'heraclitus',
    name: 'Heraclitus',
    aliases: ['Heráclito', 'Heraclitus'],
  },
  {
    slug: 'epicurus',
    name: 'Epicurus',
    aliases: ['Epicuro', 'Epicurus'],
  },
  {
    slug: 'blaise-pascal',
    name: 'Blaise Pascal',
    aliases: ['Blaise Pascal'],
  },
  {
    slug: 'francis-bacon',
    name: 'Francis Bacon',
    aliases: ['Francis Bacon'],
  },
  {
    slug: 'voltaire',
    name: 'Voltaire',
    aliases: ['Voltaire'],
  },
  {
    slug: 'john-stuart-mill',
    name: 'John Stuart Mill',
    aliases: ['John Stuart Mill'],
  },
  {
    slug: 'saint-augustine',
    name: 'Saint Augustine',
    aliases: ['Santo Agostinho', 'Saint Augustine', 'Augustine of Hippo', 'Agostinho'],
  },
  {
    slug: 'soren-kierkegaard',
    name: 'Søren Kierkegaard',
    aliases: ['Søren Kierkegaard', 'Soren Kierkegaard'],
  },
  {
    slug: 'hannah-arendt',
    name: 'Hannah Arendt',
    aliases: ['Hannah Arendt'],
  },
  {
    slug: 'augusto-cury',
    name: 'Augusto Cury',
    aliases: ['Augusto Cury'],
  },
  {
    slug: 'sigmund-freud',
    name: 'Sigmund Freud',
    aliases: ['Sigmund Freud'],
  },
  {
    slug: 'plotinus',
    name: 'Plotinus',
    aliases: ['Plotino', 'Plotinus'],
  },
  {
    slug: 'isaac-newton',
    name: 'Isaac Newton',
    aliases: ['Isaac Newton'],
  },
];

const BY_SLUG = new Map(PHILOSOPHER_AUTHORS.map((author) => [author.slug, author]));

const BY_ALIAS = new Map();
PHILOSOPHER_AUTHORS.forEach((author) => {
  [author.name, ...(author.aliases || [])].forEach((alias) => {
    const key = normalizeKey(alias);
    if (key) BY_ALIAS.set(key, author.slug);
  });
});

export function getPhilosopherSlugByAuthor(author) {
  return BY_ALIAS.get(normalizeKey(author)) || null;
}

export function getPhilosopherAuthorBySlug(slug) {
  return BY_SLUG.get(String(slug || '').trim()) || null;
}

export function isCuratedPhilosopherSlug(slug) {
  return BY_SLUG.has(String(slug || '').trim().toLowerCase());
}

/** Nome canónico do pensador, ou o nome recebido quando não é um curado. */
export function getDisplayAuthorName(author) {
  const slug = getPhilosopherSlugByAuthor(author);
  return (slug && BY_SLUG.get(slug)?.name) || String(author || 'Unknown');
}

export function getPhilosopherUrl(slug) {
  if (!slug) return null;
  return `/html/philosopher.html?slug=${encodeURIComponent(slug)}`;
}

/** Slug de emergência para autores que não estão entre os curados. */
export function slugifyName(value) {
  return normalizeKey(value).replace(/\s+/g, '-');
}

export function getPhilosopherUrlByAuthor(author) {
  const slug = getPhilosopherSlugByAuthor(author) || slugifyName(author);
  return slug ? getPhilosopherUrl(slug) : null;
}
