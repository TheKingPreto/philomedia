import mongoose from 'mongoose';

const savedMediaSchema = new mongoose.Schema({
  tmdbId: {
    type: String,
    required: true,
    trim: true,
  },
  mediaType: {
    type: String,
    enum: ['movie', 'tv'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  posterPath: {
    type: String,
    default: '',
  },
  releaseDate: {
    type: String,
    default: '',
  },
  /** Public TMDB score copied at save time — never the user's personal rating. */
  voteAverage: {
    type: Number,
    default: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  avatarUrl: {
    type: String,
    default: '',
  },

  /**
   * Só um admin pode alterar conteúdo sem dono (o editorial e o importado).
   * Promoção é manual, direto no banco — não há rota que atribua o papel.
   */
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  watchlist: {
    type: [savedMediaSchema],
    default: [],
  },
  favorites: {
    type: [savedMediaSchema],
    default: [],
  },
  watched: {
    type: [savedMediaSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', userSchema);

export default User;
