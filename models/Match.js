import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  tmdbId: {
    type: String,
    required: [true, 'TMDB ID is required for the media.'],
    trim: true,
    unique: true 
  },

  quoteId: {
    type: String, 
    required: [true, 'Quote ID is required for the match.'],
    trim: true
  },
  mediaType: {
    type: String,
    enum: ['movie', 'tv', 'anime', 'unknown'],
    default: 'unknown'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Match', matchSchema);