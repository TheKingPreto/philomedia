import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  quoteText: {
    type: String,
    required: [true, 'Quote text is required.'],
    trim: true,
    maxlength: [500, 'Quote text cannot exceed 500 characters.']
  },
  authorName: {
    type: String,
    required: [true, 'Author name is required.'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters.']
  },
  themes: {
    type: [String],
    default: [],
  },

  // ─── Campos de geração por IA (opcionais — backward compatible) ───────────
  isGenerated: {
    type: Boolean,
    default: false,
  },
  generationContext: {
    mode: {
      type: String,
      enum: ['by-theme', 'by-philosopher', 'by-media-context'],
    },
    inputThemes: {
      type: [String],
      default: undefined,
    },
    inputPhilosopher: {
      type: String,
      default: undefined,
    },
    mediaContext: {
      tmdbId: { type: String },
      mediaType: { type: String },
      title: { type: String },
    },
    model: {
      type: String,
      default: undefined,
    },
    generatedAt: {
      type: Date,
      default: undefined,
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Índice para facilitar buscas por citações geradas por IA
quoteSchema.index({ isGenerated: 1 });

export default mongoose.model('Quote', quoteSchema);