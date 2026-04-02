import mongoose from 'mongoose';

const philosopherProfileSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [120, 'Philosopher name cannot exceed 120 characters.'],
  },
  period: {
    type: String,
    default: '',
    trim: true,
    maxlength: [160, 'Period cannot exceed 160 characters.'],
  },
  summary: {
    type: String,
    default: '',
    trim: true,
    maxlength: [600, 'Summary cannot exceed 600 characters.'],
  },
  focus: {
    type: String,
    default: '',
    trim: true,
    maxlength: [600, 'Focus cannot exceed 600 characters.'],
  },
  aliases: {
    type: [String],
    default: [],
  },
  portraitUrl: {
    type: String,
    default: '',
    trim: true,
  },
  wikiTitle: {
    type: String,
    default: '',
    trim: true,
    maxlength: [180, 'wikiTitle cannot exceed 180 characters.'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

philosopherProfileSchema.index({ name: 1 });

export default mongoose.model('PhilosopherProfile', philosopherProfileSchema);
