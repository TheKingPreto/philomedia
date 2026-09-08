import mongoose from 'mongoose';
import { normalizeRatingValue } from '../../public/scripts/domain/userRatings.js';

/**
 * One user rating per target. Never store this on savedMediaSchema.voteAverage —
 * that field is the public TMDB score copied into watchlist/favorites/watched.
 */
const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetType: {
    type: String,
    enum: ['media', 'quote'],
    required: true,
  },
  targetId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  value: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

ratingSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
ratingSchema.index({ userId: 1, targetType: 1 });

ratingSchema.path('value').validate(function validateRatingValue(value) {
  return normalizeRatingValue(this.targetType, value) !== null;
}, 'Invalid rating value for this target type.');

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
