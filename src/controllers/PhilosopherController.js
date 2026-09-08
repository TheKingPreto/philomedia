import PhilosopherProfile from '../models/PhilosopherProfile.js';
import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';
import { normalizeQuoteThemes } from '../../public/scripts/domain/canonicalThemes.js';
import { isCuratedPhilosopherSlug } from '../../public/scripts/domain/philosopherAuthors.js';
import { sanitizePortraitUrl } from '../../public/scripts/domain/safePortraitUrl.js';
import { resolvePhilosopherTextField } from '../domain/i18n/quoteDisplay.js';
import {
  canManageResource,
  pickAllowedFields,
} from '../utils/resourceAccess.js';

const EDITABLE_QUOTE_FIELDS = ['quoteText', 'themes', 'quoteLanguage'];
const SLUG_CONFLICT_MESSAGE = 'A thinker with this name already exists.';
const CURATED_CONFLICT_MESSAGE = 'Curated thinkers cannot be overwritten.';

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeKey(value).replace(/\s+/g, '-');
}

function uniqStrings(values = []) {
  return [...new Set(
    (values || [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function toPlainProfile(profile) {
  const summaryI18n = profile.summaryI18n || { en: '', pt: '' };
  const focusI18n = profile.focusI18n || { en: '', pt: '' };

  return {
    id: String(profile._id),
    slug: profile.slug,
    name: profile.name,
    period: profile.period || '',
    summary: profile.summary || '',
    focus: profile.focus || '',
    originalLanguage: profile.originalLanguage || 'en',
    summaryI18n,
    focusI18n,
    summaryForLocale: {
      en: resolvePhilosopherTextField(profile, 'summary', 'en'),
      pt: resolvePhilosopherTextField(profile, 'summary', 'pt'),
    },
    focusForLocale: {
      en: resolvePhilosopherTextField(profile, 'focus', 'en'),
      pt: resolvePhilosopherTextField(profile, 'focus', 'pt'),
    },
    aliases: uniqStrings(profile.aliases || []),
    portraitUrl: sanitizePortraitUrl(profile.portraitUrl) || '',
    wikiTitle: profile.wikiTitle || '',
  };
}

function buildProfileUpdates(input = {}) {
  const updates = {};

  ['period', 'summary', 'focus', 'portraitUrl', 'wikiTitle'].forEach(field => {
    const value = String(input[field] || '').trim();
    if (!value) return;
    if (field === 'portraitUrl') {
      const safeUrl = sanitizePortraitUrl(value);
      if (safeUrl) updates.portraitUrl = safeUrl;
      return;
    }
    updates[field] = value;
  });

  const lang = String(input.originalLanguage || '').trim().toLowerCase();
  if (lang === 'en' || lang === 'pt') {
    updates.originalLanguage = lang;
  }

  if (input.summaryI18n && typeof input.summaryI18n === 'object') {
    updates.summaryI18n = {
      en: String(input.summaryI18n.en || '').trim(),
      pt: String(input.summaryI18n.pt || '').trim(),
    };
  }

  if (input.focusI18n && typeof input.focusI18n === 'object') {
    updates.focusI18n = {
      en: String(input.focusI18n.en || '').trim(),
      pt: String(input.focusI18n.pt || '').trim(),
    };
  }

  if (Array.isArray(input.aliases) && input.aliases.length > 0) {
    updates.aliases = uniqStrings(input.aliases);
  }

  return updates;
}

function normalizeQuotesPayload(quotes = [], defaultLang = 'en') {
  const langDefault = String(defaultLang || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';

  return (quotes || [])
    .map(quote => pickAllowedFields(quote, EDITABLE_QUOTE_FIELDS))
    .map(quote => {
      const ql = String(quote?.quoteLanguage || langDefault).trim().toLowerCase();
      return {
        quoteText: String(quote?.quoteText || '').trim(),
        themes: normalizeQuoteThemes(uniqStrings(quote?.themes || [])),
        quoteLanguage: ql === 'pt' ? 'pt' : 'en',
      };
    })
    .filter(quote => quote.quoteText);
}

function canManagePhilosopher(profile, user) {
  return canManageResource({
    submittedBy: profile?.createdBy || profile?.submittedBy || null,
  }, user);
}

export const listPhilosopherProfiles = asyncHandler(async (req, res) => {
  const profiles = await PhilosopherProfile.find({})
    .sort({ name: 1 })
    .lean();

  return res.status(200).json(profiles.map(toPlainProfile));
});

export const createPhilosopherSubmission = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required. Please log in to perform this action.',
    });
  }

  const name = String(req.body.name || '').trim();
  const slug = slugify(name);
  const aliases = uniqStrings(req.body.aliases || []).filter(alias => normalizeKey(alias) !== normalizeKey(name));
  const quotePayload = normalizeQuotesPayload(req.body.quotes, req.body.originalLanguage);

  if (isCuratedPhilosopherSlug(slug)) {
    return res.status(409).json({
      message: CURATED_CONFLICT_MESSAGE,
      slug,
    });
  }

  const existingProfile = await PhilosopherProfile.findOne({ slug });
  if (existingProfile && !canManagePhilosopher(existingProfile, req.user)) {
    return res.status(409).json({
      message: SLUG_CONFLICT_MESSAGE,
      slug,
    });
  }

  const updates = buildProfileUpdates(req.body);
  if (aliases.length > 0) {
    updates.aliases = uniqStrings([...(existingProfile?.aliases || []), ...aliases]);
  } else if (existingProfile?.aliases?.length) {
    updates.aliases = uniqStrings(existingProfile.aliases);
  }

  const philosopherProfile = existingProfile
    ? await PhilosopherProfile.findOneAndUpdate(
        { slug },
        { $set: updates },
        { new: true, runValidators: true }
      )
    : await PhilosopherProfile.create({
        slug,
        name,
        createdBy: req.user._id || null,
        ...updates,
      });

  const existingQuotes = await Quote.find({
    authorName: philosopherProfile.name,
    quoteText: { $in: quotePayload.map(quote => quote.quoteText) },
  })
    .select('quoteText')
    .lean();

  const existingQuoteKeys = new Set(existingQuotes.map(quote => normalizeKey(quote.quoteText)));
  const quotesToCreate = quotePayload
    .filter(quote => !existingQuoteKeys.has(normalizeKey(quote.quoteText)))
    .map(quote => ({
      quoteText: quote.quoteText,
      authorName: philosopherProfile.name,
      themes: quote.themes,
      submissionSource: 'user-submitted',
      quoteLanguage: quote.quoteLanguage,
      submittedBy: req.user._id || null,
    }));

  if (quotesToCreate.length > 0) {
    await Quote.insertMany(quotesToCreate);
  }

  return res.status(existingProfile ? 200 : 201).json({
    philosopher: toPlainProfile(philosopherProfile),
    createdQuotes: quotesToCreate.length,
    skippedQuotes: quotePayload.length - quotesToCreate.length,
  });
});
