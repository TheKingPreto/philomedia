import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tmdbClient from './tmdbClient.js';
import { buildPublicUrl } from '../utils/publicUrl.js';
import { preferredLocaleFromHeader } from '../utils/preferredLocale.js';
import { getPhilosopherAuthorBySlug } from '../../public/scripts/domain/philosopherAuthors.js';
import { PHILOSOPHER_DEFINITIONS } from '../../public/scripts/philosopher-data.js';
import { PHILOSOPHER_DEF_PT } from '../../public/scripts/services/philosopherDefPt.js';

const PUBLIC_HTML_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/html'
);

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const htmlCache = new Map();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function resolvePageLocale(req) {
  const queryLang = String(req.query?.lang || req.query?.locale || '').trim().toLowerCase();
  if (queryLang.startsWith('pt')) return 'pt';
  if (queryLang.startsWith('en')) return 'en';
  return preferredLocaleFromHeader(req.get?.('accept-language'));
}

export function tmdbLanguageForLocale(locale) {
  return String(locale).startsWith('pt') ? 'pt-BR' : 'en-US';
}

function replaceMetaByAttr(html, attr, key, content) {
  const safe = escapeHtml(content);
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${key}["'][^>]*>`,
    'i'
  );
  const tag = `<meta ${attr}="${key}" content="${safe}">`;
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  return html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceTitle(html, title) {
  const safe = escapeHtml(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace('</head>', `  <title>${safe}</title>\n</head>`);
}

function replaceCanonical(html, href) {
  const safe = escapeHtml(href);
  if (/<link\s+[^>]*rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(
      /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${safe}">`
    );
  }
  return html.replace('</head>', `  <link rel="canonical" href="${safe}">\n</head>`);
}

function replaceHtmlLang(html, locale) {
  const lang = locale === 'pt' ? 'pt-BR' : 'en';
  return html.replace(/<html\b([^>]*)>/i, (match, attrs) => {
    if (/\blang=/.test(attrs)) {
      return `<html${attrs.replace(/\blang=["'][^"']*["']/, `lang="${lang}"`)}>`;
    }
    return `<html lang="${lang}"${attrs}>`;
  });
}

function injectJsonLd(html, jsonLd) {
  if (!jsonLd) return html;
  const script = `<script type="application/ld+json">${escapeJsonLd(jsonLd)}</script>`;
  if (html.includes('application/ld+json')) {
    return html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
      script
    );
  }
  return html.replace('</head>', `  ${script}\n</head>`);
}

export function applyHtmlSeo(html, {
  title,
  description,
  canonical,
  image = '',
  type = 'website',
  locale = 'en',
  jsonLd = null,
} = {}) {
  let next = replaceHtmlLang(html, locale);
  next = replaceTitle(next, title);
  next = replaceMetaByAttr(next, 'name', 'description', description);
  next = replaceMetaByAttr(next, 'property', 'og:title', title);
  next = replaceMetaByAttr(next, 'property', 'og:description', description);
  next = replaceMetaByAttr(next, 'property', 'og:type', type);
  next = replaceMetaByAttr(next, 'property', 'og:url', canonical);
  next = replaceMetaByAttr(next, 'name', 'twitter:title', title);
  next = replaceMetaByAttr(next, 'name', 'twitter:description', description);
  next = replaceCanonical(next, canonical);

  if (image) {
    next = replaceMetaByAttr(next, 'property', 'og:image', image);
    next = replaceMetaByAttr(next, 'name', 'twitter:image', image);
    next = replaceMetaByAttr(next, 'name', 'twitter:card', 'summary_large_image');
  }

  return injectJsonLd(next, jsonLd);
}

async function readStaticHtml(fileName) {
  const cached = htmlCache.get(fileName);
  if (cached && process.env.NODE_ENV === 'production') return cached;
  const html = await fs.readFile(path.join(PUBLIC_HTML_DIR, fileName), 'utf8');
  htmlCache.set(fileName, html);
  return html;
}

function posterUrl(posterPath) {
  if (!posterPath) return '';
  if (String(posterPath).startsWith('http')) return String(posterPath);
  return `${TMDB_IMAGE_BASE}${posterPath}`;
}

export function buildDetailsSeoPayload(details, {
  id,
  mediaType,
  locale,
  canonical,
} = {}) {
  const isTv = mediaType === 'tv';
  const name = String(details?.title || details?.name || '').trim() || 'PhiloMedia';
  const overview = String(details?.overview || '').trim();
  const description = overview
    || (locale === 'pt'
      ? `Leitura filosófica de ${name} no PhiloMedia.`
      : `A philosophical reading of ${name} on PhiloMedia.`);
  const image = posterUrl(details?.poster_path);
  const year = String(details?.release_date || details?.first_air_date || '').slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': isTv ? 'TVSeries' : 'Movie',
    name,
    description,
    url: canonical,
    ...(image ? { image } : {}),
    ...(year ? { datePublished: year } : {}),
  };

  return {
    title: `${name} | PhiloMedia`,
    description,
    canonical,
    image,
    type: 'video.movie',
    locale,
    jsonLd,
    id,
  };
}

export function buildPhilosopherSeoPayload(slug, locale, canonical) {
  const curated = PHILOSOPHER_DEFINITIONS.find(item => item.slug === slug)
    || getPhilosopherAuthorBySlug(slug);
  const ptCopy = PHILOSOPHER_DEF_PT[slug] || {};
  const name = curated?.name || slug;
  const summary = locale === 'pt'
    ? (ptCopy.summary || curated?.summary || '')
    : (curated?.summary || ptCopy.summary || '');
  const description = summary
    || (locale === 'pt'
      ? `Citações e obras relacionadas de ${name} no PhiloMedia.`
      : `Quotes and related works for ${name} on PhiloMedia.`);

  return {
    title: `${name} | PhiloMedia`,
    description,
    canonical,
    image: '',
    type: 'profile',
    locale,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      description,
      url: canonical,
    },
  };
}

export async function renderDetailsHtml(req) {
  const html = await readStaticHtml('details.html');
  const id = String(req.query?.id || '').trim();
  const mediaType = req.query?.type === 'tv' ? 'tv' : (req.query?.type === 'movie' ? 'movie' : '');
  const locale = resolvePageLocale(req);
  const canonical = buildPublicUrl(
    req,
    `/html/details.html${id && mediaType ? `?id=${encodeURIComponent(id)}&type=${encodeURIComponent(mediaType)}` : ''}`
  );

  if (!id || !mediaType) {
    return applyHtmlSeo(html, {
      title: locale === 'pt' ? 'PhiloMedia | Uma leitura filosófica' : 'PhiloMedia | A philosophical reading',
      description: locale === 'pt'
        ? 'Uma leitura filosófica de um filme ou série: citação, lente e obras relacionadas.'
        : 'A philosophical reading of a film or series: quote, lens, thinker, and related works.',
      canonical,
      locale,
      type: 'article',
    });
  }

  try {
    const details = await tmdbClient.getDetails(id, mediaType, {
      language: tmdbLanguageForLocale(locale),
    });
    return applyHtmlSeo(html, buildDetailsSeoPayload(details, {
      id,
      mediaType,
      locale,
      canonical,
    }));
  } catch {
    return applyHtmlSeo(html, {
      title: locale === 'pt' ? 'PhiloMedia | Uma leitura filosófica' : 'PhiloMedia | A philosophical reading',
      description: locale === 'pt'
        ? 'Uma leitura filosófica de um filme ou série no PhiloMedia.'
        : 'A philosophical reading of a film or series inside PhiloMedia.',
      canonical,
      locale,
      type: 'article',
    });
  }
}

export async function renderPhilosopherHtml(req) {
  const html = await readStaticHtml('philosopher.html');
  const slug = String(req.query?.slug || '').trim();
  const locale = resolvePageLocale(req);
  const canonical = buildPublicUrl(
    req,
    `/html/philosopher.html${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`
  );

  if (!slug) {
    return applyHtmlSeo(html, {
      title: locale === 'pt' ? 'PhiloMedia | Pensador' : 'PhiloMedia | Thinker',
      description: locale === 'pt'
        ? 'Explore citações, temas e obras relacionadas de um pensador no PhiloMedia.'
        : 'Explore a thinker\'s signature quotes, recurring themes, and related works inside PhiloMedia.',
      canonical,
      locale,
      type: 'profile',
    });
  }

  return applyHtmlSeo(html, buildPhilosopherSeoPayload(slug, locale, canonical));
}

export async function serveDetailsHtml(req, res, next) {
  try {
    const html = await renderDetailsHtml(req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
}

export async function servePhilosopherHtml(req, res, next) {
  try {
    const html = await renderPhilosopherHtml(req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
}
