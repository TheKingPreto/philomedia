import Match from '../models/Match.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  FORBIDDEN_MESSAGE,
  canManageResource,
  pickAllowedFields,
} from '../utils/resourceAccess.js';

/** `submittedBy` e `createdAt` são do servidor, nunca do corpo da requisição. */
const EDITABLE_MATCH_FIELDS = ['tmdbId', 'quoteId', 'mediaType'];

export const getAllMatches = asyncHandler(async (req, res) => {
  const matches = await Match.find({}).populate('quoteId');
  res.status(200).json(matches);
});

export const getMatchById = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).populate('quoteId');
  if (!match) {
    return res.status(404).json({ message: 'Curated match not found.' });
  }
  res.status(200).json(match);
});

export const createMatch = asyncHandler(async (req, res) => {
  const newMatch = new Match({
    ...pickAllowedFields(req.body, EDITABLE_MATCH_FIELDS),
    submittedBy: req.user?._id ?? null,
  });
  const savedMatch = await newMatch.save();
  res.status(201).json(savedMatch);
});

export const updateMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    return res.status(404).json({ message: 'Curated match not found for update.' });
  }

  if (!canManageResource(match, req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }

  match.set(pickAllowedFields(req.body, EDITABLE_MATCH_FIELDS));
  const updatedMatch = await match.save();
  res.status(200).json(updatedMatch);
});

export const deleteMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    return res.status(404).json({ message: 'Curated match not found for deletion.' });
  }

  if (!canManageResource(match, req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }

  await match.deleteOne();
  res.status(200).json({ message: 'Curated match successfully deleted.' });
});
