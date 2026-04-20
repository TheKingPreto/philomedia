import express from 'express';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';

import quoteRoutes from './src/routes/quotes.js';
import matchRoutes from './src/routes/matches.js';
import authRoutes from './src/routes/auth.js';
import libraryRoutes from './src/routes/library.js';
import philosopherRoutes from './src/routes/philosophers.js';
import tmdbRoutes from './src/routes/tmdb.js';
import aiQuoteRoutes from './src/routes/aiQuotes.js';
import { specs } from './config/swagger.js';
import { buildPublicUrl, getPublicBaseUrl } from './src/utils/publicUrl.js';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'GOOGLE_AI_API_KEY',
  'TMDB_API_KEY',
];

const OPTIONAL_ENV_VARS = {
  GOOGLE_CLIENT_ID: 'Google OAuth login will be unavailable.',
  GOOGLE_CLIENT_SECRET: 'Google OAuth login will be unavailable.',
  PUBLIC_SITE_URL: 'SEO links will fall back to the current request host.',
};

if (process.env.NODE_ENV !== 'test') {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Add the missing values to your .env before starting the server.'
    );
    process.exit(1);
  }

  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, hint]) => {
    if (!process.env[key]) {
      console.warn(`Optional env var ${key} not set - ${hint}`);
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

export const oauthEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://image.tmdb.org https://philosophersapi.com https://upload.wikimedia.org",
      "connect-src 'self' https://api.themoviedb.org https://corsproxy.io https://philosophersapi.com",
      "font-src 'self' https://fonts.gstatic.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
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

const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please try again in a few minutes.' },
});

const tmdbLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many media lookup requests. Please slow down and try again shortly.' },
});

const libraryWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many library updates. Please wait a moment before trying again.' },
});

const contributionWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contribution attempts. Please wait before publishing more quotes.' },
});

function applyLimiterToMethods(methods, limiter) {
  return (req, res, next) => {
    if (!methods.has(req.method)) {
      return next();
    }

    return limiter(req, res, next);
  };
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = getPublicBaseUrl(req);

  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /html/library.html',
    'Disallow: /html/profile.html',
    'Disallow: /html/contribute.html',
    `Sitemap: ${new URL('/sitemap.xml', `${baseUrl}/`).toString()}`,
  ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const urls = [
    { path: '/html/index.html', changefreq: 'daily', priority: '1.0' },
    { path: '/html/search.html', changefreq: 'weekly', priority: '0.9' },
    { path: '/html/philosophers.html', changefreq: 'weekly', priority: '0.9' },
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(entry => [
      '  <url>',
      `    <loc>${buildPublicUrl(req, entry.path)}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
  ].join('\n');

  res.type('application/xml').send(xml);
});

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

  if (oauthEnabled) {
    try {
      await import('./config/passport.js');
      console.log('Google OAuth strategy loaded');
    } catch (error) {
      console.error('Passport load error:', error);
    }
  } else {
    console.warn('Google OAuth disabled - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.');
  }
}

if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error('MongoDB error:', error.message));
}

app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/')
    || req.path.startsWith('/auth')
    || req.path === '/html/library.html'
    || req.path === '/html/profile.html'
    || req.path === '/html/contribute.html'
  ) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  if (req.path.startsWith('/api/') || req.path.startsWith('/auth')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/', (req, res) => {
  res.redirect('/html/index.html');
});

app.use('/api/quotes', quoteRoutes);
app.use('/api/philosophers', applyLimiterToMethods(new Set(['POST']), contributionWriteLimiter), philosopherRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/me', applyLimiterToMethods(new Set(['POST', 'PATCH', 'PUT', 'DELETE']), libraryWriteLimiter), libraryRoutes);
app.use('/api/tmdb', tmdbLimiter, tmdbRoutes);
app.use('/api/ai/quotes', aiQuoteRoutes);
app.use('/auth', authLimiter, authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error('[PhiloMedia] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`PhiloMedia running on http://localhost:${PORT}`);
    console.log(`API docs: http://localhost:${PORT}/api-docs`);
    if (!oauthEnabled) {
      console.log('Google OAuth: disabled (add credentials to enable login)');
    }
  });
}

export default app;
