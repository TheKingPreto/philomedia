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

// Load environment file except during tests to avoid noisy tips/logs
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
  if (!process.env.TMDB_API_KEY) {
    console.warn('TMDB_API_KEY is not set. TMDB proxy endpoints will fail.');
  }
}

// ─── Environment validation ───────────────────────────────────────────────────
// Fail fast on startup if any required env variable is missing.
// Add new required vars here as the project grows (e.g. GOOGLE_AI_API_KEY in Phase 2).
const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_AI_API_KEY',
];

if (process.env.NODE_ENV !== 'test') {
  const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missingVars.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missingVars.join(', ')}\n` +
      '   Copy _env to .env and fill in the missing values before starting the server.'
    );
    process.exit(1);
  }
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Defina CSP manualmente (única vez)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // JS
      "script-src 'self'",
      // CSS (Google Fonts)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Imagens (TMDB)
      "img-src 'self' data: https://image.tmdb.org",
      // Fetch / APIs
      "connect-src 'self' https://api.themoviedb.org https://corsproxy.io https://philosophersapi.com",
      // Fontes
      "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai",
      // Segurança extra
      "object-src 'none'",
    ].join('; ')
  );
  next();
});
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// In production set CORS_ORIGIN to your front origin (e.g. https://yourdomain.com).
// With origin '*' browsers will not send credentials; use a specific origin for cookie/session auth.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Global limiter — protects all endpoints.
// AI-specific endpoints (Phase 2+) will have their own stricter limiter.
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(globalLimiter);

// ─── Auth & session ───────────────────────────────────────────────────────────
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

  // Dynamically load passport strategy so tests don't construct
  // OAuth strategies that require real environment variables.
  import('./config/passport.js').catch((err) =>
    console.error('Passport load error:', err)
  );
}

// ─── Database ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB error:', err.message));
}

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ─── Static files (public + scripts) ───────────────────────────────────────────
app.use(express.static('public'));
app.use('/scripts', express.static('scripts'));

// ─── Docs ─────────────────────────────────────────────────────────────────────
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Welcome to the PhiloMedia REST API! Check the documentation route for endpoints.');
});

app.use('/auth', authRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/ai/quotes', aiQuoteRoutes);

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.originalUrl} was not found on this server.`,
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ error: 'Validation Error', messages });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID Format',
      message: `The ID provided is not valid: ${err.value}`,
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong on the server side. Check the logs.',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 PhiloMedia server running on port ${PORT}`);
  });

  app.use((err, req, res, next) => {
  console.error(err); // <- aqui vai aparecer o motivo real
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

}

export default app;