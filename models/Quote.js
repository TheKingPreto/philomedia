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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Quote', quoteSchema);