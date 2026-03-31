import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import quoteRoutes from './src/routes/quotes.js';
import matchRoutes from './src/routes/matches.js';
import authRoutes from './src/routes/auth.js';
import tmdbRoutes from './src/routes/tmdb.js';
import aiQuoteRoutes from './src/routes/aiQuotes.js';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

// ─── Environment validation ───────────────────────────────────────────────────
// Only the vars that are truly required for the server to run at all.
// Google OAuth credentials are OPTIONAL until the login UI is built —
// missing them prints a warning but does NOT crash the server.
const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'GOOGLE_AI_API_KEY',
  'TMDB_API_KEY',
];

const OPTIONAL_ENV_VARS = {
  GOOGLE_CLIENT_ID:     'Google OAuth login will be unavailable.',
  GOOGLE_CLIENT_SECRET: 'Google OAuth login will be unavailable.',
};

if (process.env.NODE_ENV !== 'test') {
  const missing = REQUIRED_ENV_VARS.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      '   Copy .env.example to .env and fill in the missing values before starting.'
    );
    process.exit(1);
  }

  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, hint]) => {
    if (!process.env[key]) {
      console.warn(`⚠️  Optional env var ${key} not set — ${hint}`);
    }
  });
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
const PORT       = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// ─── Whether OAuth is available this session ─────────────────────────────────
export const oauthEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://image.tmdb.org",
      "connect-src 'self' https://api.themoviedb.org https://corsproxy.io https://philosophersapi.com",
      "font-src 'self' https://fonts.gstatic.com",
      "object-src 'none'",
    ].join('; ')
  );
  next();
});

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Sessions ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: MONGODB_URI }),
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Only load the Google OAuth strategy if credentials are present.
  // Without this guard the passport config throws on startup and the
  // server crashes — blocking deploy when OAuth is not yet configured.
  if (oauthEnabled) {
    import('./config/passport.js')
      .then(() => console.log('✅ Google OAuth strategy loaded'))
      .catch(err => console.error('Passport load error:', err));
  } else {
    console.warn('⚠️  Google OAuth disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.');
  }
}

// ─── Database ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB error:', err.message));
}

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static('public'));

// ─── Docs ─────────────────────────────────────────────────────────────────────
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/html/index.html');
});

app.use('/api/quotes',    quoteRoutes);
app.use('/api/matches',   matchRoutes);
app.use('/api/tmdb',      tmdbRoutes);
app.use('/api/ai/quotes', aiQuoteRoutes);

// Auth routes only mounted when OAuth is configured
if (oauthEnabled) {
  app.use('/auth', authRoutes);
} else {
  app.use('/auth', (req, res) => {
    res.status(503).json({
      error: 'Authentication is not configured on this server.',
    });
  });
}

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[PhiloMedia] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 PhiloMedia running on http://localhost:${PORT}`);
    console.log(`📚 API docs: http://localhost:${PORT}/api-docs`);
    if (!oauthEnabled) {
      console.log(`ℹ️  Google OAuth: disabled (add credentials to enable login)`);
    }
  });
}

export default app;
