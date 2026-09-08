import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildQuoteCatalog, catalogVisibilityFilter } from '../services/quoteCatalog.js';
import {
  FORBIDDEN_MESSAGE,
  canManageResource,
  isAdmin,
  pickAllowedFields,
} from '../utils/resourceAccess.js';

/**
 * Campos que o cliente pode definir. Tudo o resto — `legacyId`, `isGenerated`,
 * `generationContext`, `submittedBy`, `submissionSource` — é do servidor.
 */
const EDITABLE_QUOTE_FIELDS = [
  'quoteText',
  'authorName',
  'themes',
  'quoteLanguage',
  'quoteTranslations',
  'translationStatus',
];

const QUOTE_TRANSLATION_FIELDS = ['en', 'pt'];

function sanitizeQuoteBody(body) {
  const payload = pickAllowedFields(body, EDITABLE_QUOTE_FIELDS);

  if (payload.quoteTranslations !== undefined) {
    payload.quoteTranslations = pickAllowedFields(
      payload.quoteTranslations,
      QUOTE_TRANSLATION_FIELDS
    );
  }

  return payload;
}

export const getAllQuotes = asyncHandler(async (req, res, _next) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limitRaw = parseInt(String(req.query.limit || '50'), 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
  const lang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : '';

  const filter = {};
  if (lang) {
    filter.quoteLanguage = lang;
  }
  if (!isAdmin(req.user)) {
    Object.assign(filter, catalogVisibilityFilter());
  }

  const skip = (page - 1) * limit;

  const [quotes, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quote.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.status(200).json({
    data: quotes,
    page,
    limit,
    total,
    totalPages,
  });
});

export const getQuoteCatalog = asyncHandler(async (req, res, _next) => {
  const quotes = await buildQuoteCatalog(req.query.lang || 'en');
  res.status(200).json(quotes);
});

export const getQuoteById = asyncHandler(async (req, res, _next) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) {
    return res.status(404).json({ message: 'Quote not found.' });
  }
  res.status(200).json(quote);
});

export const createQuote = asyncHandler(async (req, res, _next) => {
  const newQuote = new Quote({
    ...sanitizeQuoteBody(req.body),
    submissionSource: 'user-submitted',
    submittedBy: req.user?._id ?? null,
    moderationStatus: 'pending',
  });
  const savedQuote = await newQuote.save();
  res.status(201).json(savedQuote);
});

export const updateQuote = asyncHandler(async (req, res, _next) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) {
    return res.status(404).json({ message: 'Quote not found for update.' });
  }

  if (!canManageResource(quote, req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }

  quote.set(sanitizeQuoteBody(req.body));
  const updatedQuote = await quote.save();
  res.status(200).json(updatedQuote);
});

export const deleteQuote = asyncHandler(async (req, res, _next) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) {
    return res.status(404).json({ message: 'Quote not found for deletion.' });
  }

  if (!canManageResource(quote, req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }

  await quote.deleteOne();
  res.status(200).json({ message: 'Quote successfully deleted.' });
});

export const moderateQuote = asyncHandler(async (req, res, _next) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }

  const status = String(req.body?.status || req.body?.moderationStatus || '').trim().toLowerCase();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'moderationStatus must be pending, approved, or rejected.' });
  }

  const quote = await Quote.findById(req.params.id);
  if (!quote) {
    return res.status(404).json({ message: 'Quote not found.' });
  }

  quote.moderationStatus = status;
  const saved = await quote.save();
  res.status(200).json(saved);
});
