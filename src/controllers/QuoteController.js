import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildQuoteCatalog } from '../services/quoteCatalog.js';

export const getAllQuotes = asyncHandler(async (req, res, _next) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limitRaw = parseInt(String(req.query.limit || '50'), 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
  const lang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : '';

  const filter = {};
  if (lang) {
    filter.quoteLanguage = lang;
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
  const newQuote = new Quote(req.body);
  const savedQuote = await newQuote.save();
  res.status(201).json(savedQuote);
});

export const updateQuote = asyncHandler(async (req, res, _next) => {
  const updatedQuote = await Quote.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!updatedQuote) {
    return res.status(404).json({ message: 'Quote not found for update.' });
  }
  res.status(200).json(updatedQuote);
});

export const deleteQuote = asyncHandler(async (req, res, _next) => {
  const deletedQuote = await Quote.findByIdAndDelete(req.params.id);
  if (!deletedQuote) {
    return res.status(404).json({ message: 'Quote not found for deletion.' });
  }
  res.status(200).json({ message: 'Quote successfully deleted.' });
});
