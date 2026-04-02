import PhilosopherProfile from '../models/PhilosopherProfile.js';
import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';

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
  return {
    id: String(profile._id),
    slug: profile.slug,
    name: profile.name,
    period: profile.period || '',
    summary: profile.summary || '',
    focus: profile.focus || '',
    aliases: uniqStrings(profile.aliases || []),
    portraitUrl: profile.portraitUrl || '',
    wikiTitle: profile.wikiTitle || '',
  };
}

function buildProfileUpdates(input = {}) {
  const updates = {};

  ['period', 'summary', 'focus', 'portraitUrl', 'wikiTitle'].forEach(field => {
    const value = String(input[field] || '').trim();
    if (value) {
      updates[field] = value;
    }
  });

  if (Array.isArray(input.aliases) && input.aliases.length > 0) {
    updates.aliases = uniqStrings(input.aliases);
  }

  return updates;
}

function normalizeQuotesPayload(quotes = []) {
  return (quotes || [])
    .map(quote => ({
      quoteText: String(quote?.quoteText || '').trim(),
      themes: uniqStrings(quote?.themes || []),
    }))
    .filter(quote => quote.quoteText);
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
  const quotePayload = normalizeQuotesPayload(req.body.quotes);

  const existingProfile = await PhilosopherProfile.findOne({ slug });
  const profileData = {
    slug,
    name,
    createdBy: req.user._id || null,
    ...buildProfileUpdates(req.body),
  };

  if (aliases.length > 0) {
    profileData.aliases = uniqStrings([...(existingProfile?.aliases || []), ...aliases]);
  } else if (existingProfile?.aliases?.length) {
    profileData.aliases = uniqStrings(existingProfile.aliases);
  }

  const philosopherProfile = existingProfile
    ? await PhilosopherProfile.findOneAndUpdate(
        { slug },
        { $set: profileData },
        { new: true, runValidators: true }
      )
    : await PhilosopherProfile.create(profileData);

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
      quoteLanguage: 'en',
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
