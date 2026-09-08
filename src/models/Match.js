import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  tmdbId: {
    type: String,
    required: [true, 'TMDB ID is required for the media.'],
    trim: true,
    unique: true 
  },

  quoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: [true, 'Quote ID is required for the match.'],
  },
  mediaType: {
    type: String,
    enum: ['movie', 'tv', 'anime', 'unknown'],
    default: 'unknown'
  },

  /** Quem submeteu. Nulo em matches editoriais, que só admins podem alterar. */
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Match', matchSchema);