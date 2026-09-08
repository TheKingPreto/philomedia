import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  quoteText: {
    type: String,
    required: [true, 'Quote text is required.'],
    trim: true,
    maxlength: [500, 'Quote text cannot exceed 500 characters.'],
  },
  authorName: {
    type: String,
    required: [true, 'Author name is required.'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters.'],
  },
  themes: {
    type: [String],
    default: [],
  },
  submissionSource: {
    type: String,
    enum: ['system', 'import', 'user-submitted'],
    default: 'system',
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  /**
   * user-submitted começa em pending e só entra no catálogo público depois
   * de um admin aprovar. Legado sem campo conta como approved.
   */
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: undefined,
    index: true,
  },
  quoteLanguage: {
    type: String,
    default: 'en',
    trim: true,
    lowercase: true,
  },

  /** Texto derivado para exibição (revisão assistida); canônico permanece em quoteText + quoteLanguage */
  quoteTranslations: {
    en: {
      type: String,
      trim: true,
      maxlength: [500, 'Translated quote (en) cannot exceed 500 characters.'],
      default: '',
    },
    pt: {
      type: String,
      trim: true,
      maxlength: [500, 'Translated quote (pt) cannot exceed 500 characters.'],
      default: '',
    },
  },

  translationStatus: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
    maxlength: [32, 'translationStatus too long'],
  },

  // ─── Compatibilidade com curatedmatches.js ───────────────────────────────
  // Preserva o ID numérico original do custom-quotes.js (1001–1051).
  // O frontend usa esse campo para fazer o match curado:
  //   curatedMatches['157336'] === 1035  →  allQuotes.find(q => q.id === 1035)
  // Quotes geradas por IA não têm legacyId.
  legacyId: {
    type: Number,
    default: null,
    index: true,     // lookup frequente — precisa de índice
    sparse: true,    // permite null em múltiplos docs sem violar unique
    unique: true,
  },

  // ─── Campos de geração por IA (opcionais) ────────────────────────────────
  isGenerated: {
    type: Boolean,
    default: false,
  },
  generationContext: {
    mode: {
      type: String,
      enum: ['by-theme', 'by-philosopher', 'by-media-context'],
    },
    inputThemes:      { type: [String], default: undefined },
    inputPhilosopher: { type: String,   default: undefined },
    mediaContext: {
      tmdbId:    { type: String },
      mediaType: { type: String },
      title:     { type: String },
    },
    model:       { type: String, default: undefined },
    generatedAt: { type: Date,   default: undefined },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

quoteSchema.index({ isGenerated: 1 });

export default mongoose.model('Quote', quoteSchema);
