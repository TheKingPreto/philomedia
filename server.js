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
import ratingRoutes from './src/routes/ratings.js';
import philosopherRoutes from './src/routes/philosophers.js';
import tmdbRoutes from './src/routes/tmdb.js';
import aiQuoteRoutes from './src/routes/aiQuotes.js';
import dailyPairingRoutes from './src/routes/dailyPairing.js';
import { specs } from './config/swagger.js';
import { connectMongo, registerMongoConnectionLogging } from './config/database.js';
import { buildPublicUrl, getPublicBaseUrl } from './src/utils/publicUrl.js';
import { preferredLocaleFromHeader } from './src/utils/preferredLocale.js';
import {
  buildCorsOptions,
  buildSessionCookieOptions,
  resolveTrustProxy,
  shouldExposeApiDocs,
} from './src/config/httpSecurity.js';
import { collectSitemapEntries } from './src/services/sitemapUrls.js';
import {
  fetchPhilosophersDirectoryAsset,
  fetchPortraitAsset,
  fetchWikiSummaryAsset,
} from './src/services/remoteAssetProxy.js';
import { serveDetailsHtml, servePhilosopherHtml } from './src/services/htmlPageSeo.js';

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

app.set('trust proxy', resolveTrustProxy());
app.use(express.json({ limit: '120kb' }));
app.use(express.urlencoded({ extended: true, limit: '120kb' }));

app.use(helmet({
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://image.tmdb.org",
      "connect-src 'self' https://api.themoviedb.org",
      "font-src 'self'",
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
app.use(cors(buildCorsOptions()));

const testNoopLimiter = (req, res, next) => next();

const globalLimiter = process.env.NODE_ENV === 'test'
  ? testNoopLimiter
  : rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
app.use(globalLimiter);

const authLimiter = process.env.NODE_ENV === 'test'
  ? testNoopLimiter
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Please try again in a few minutes.' },
  });

const tmdbLimiter = process.env.NODE_ENV === 'test'
  ? testNoopLimiter
  : rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many media lookup requests. Please slow down and try again shortly.' },
  });

const libraryWriteLimiter = process.env.NODE_ENV === 'test'
  ? testNoopLimiter
  : rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many library updates. Please wait a moment before trying again.' },
  });

const contributionWriteLimiter = process.env.NODE_ENV === 'test'
  ? testNoopLimiter
  : rateLimit({
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
  const urls = collectSitemapEntries();

  const escapeXml = value => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(entry => [
      '  <url>',
      `    <loc>${escapeXml(buildPublicUrl(req, entry.path))}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
  ].join('\n');

  res.type('application/xml').send(xml);
});

if (process.env.NODE_ENV !== 'test') {
  registerMongoConnectionLogging();
  try {
    await connectMongo(MONGODB_URI);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error(
      'Check MONGODB_URI and network (Atlas IP access list, VPN/DNS). For local dev you can use: mongodb://127.0.0.1:27017/philomedia'
    );
    process.exit(1);
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        dbName: mongoose.connection.db.databaseName,
      }),
      cookie: buildSessionCookieOptions(),
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

  if (req.path.startsWith('/api/tmdb') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  } else if (req.path.startsWith('/api/') || req.path.startsWith('/auth')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

function sendProxyError(res, error, fallbackMessage) {
  const status = Number(error?.status) || 502;
  if (status === 413) {
    res.status(413).json({ error: 'Upstream asset exceeds size limit.' });
    return;
  }
  res.status(status).json({ error: error?.message || fallbackMessage });
}

app.get('/api/assets/portrait', async (req, res) => {
  try {
    const asset = await fetchPortraitAsset(req.query.src);
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Cache-Control', asset.cacheControl);
    res.send(asset.body);
  } catch (error) {
    sendProxyError(res, error, 'Portrait proxy unavailable.');
  }
});

app.get('/api/assets/wiki-summary', async (req, res) => {
  try {
    const asset = await fetchWikiSummaryAsset(req.query.title, req.query.lang);
    res.setHeader('Content-Type', asset.contentType || 'application/json');
    res.setHeader('Cache-Control', asset.cacheControl);
    res.send(asset.body);
  } catch (error) {
    sendProxyError(res, error, 'Wiki summary proxy unavailable.');
  }
});

app.get('/api/assets/philosophers-directory', async (req, res) => {
  try {
    const asset = await fetchPhilosophersDirectoryAsset();
    res.setHeader('Content-Type', asset.contentType || 'application/json');
    res.setHeader('Cache-Control', asset.cacheControl);
    res.send(asset.body);
  } catch (error) {
    sendProxyError(res, error, 'Philosopher directory proxy unavailable.');
  }
});

app.get('/html/details.html', serveDetailsHtml);
app.get('/html/philosopher.html', servePhilosopherHtml);

app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders: (res, filePath) => {
    if (!filePath.endsWith('.html')) return;

    // i18n.js importa a tabela do locale ativo dinamicamente, o que só o
    // browser sabe resolver — e tarde, quando o grafo de módulos já executou.
    // Este hint antecipa o download para o momento da resposta do HTML.
    const locale = preferredLocaleFromHeader(res.req?.headers['accept-language']);
    res.setHeader('Link', `</scripts/services/translations.${locale}.js>; rel=modulepreload`);
  },
}));

if (shouldExposeApiDocs()) {
  app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

app.get('/favicon.ico', (req, res) => {
  res.redirect(302, '/favicon.svg');
});

app.get('/', (req, res) => {
  res.redirect('/html/index.html');
});

app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState;
  const dbLabel =
    ready === 1 ? 'connected'
    : ready === 2 ? 'connecting'
    : ready === 3 ? 'disconnecting'
    : 'disconnected';

  res.json({
    status: ready === 1 ? 'ok' : 'degraded',
    db: dbLabel,
    uptime: process.uptime(),
  });
});

app.use('/api/quotes', quoteRoutes);
app.use('/api/philosophers', applyLimiterToMethods(new Set(['POST']), contributionWriteLimiter), philosopherRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/me', applyLimiterToMethods(new Set(['POST', 'PATCH', 'PUT', 'DELETE']), libraryWriteLimiter), libraryRoutes);
app.use('/api/me', applyLimiterToMethods(new Set(['POST', 'PATCH', 'PUT', 'DELETE']), libraryWriteLimiter), ratingRoutes);
app.use('/api/daily-pairing', tmdbLimiter, dailyPairingRoutes);
app.use('/api/tmdb', tmdbLimiter, tmdbRoutes);
app.use('/api/ai/quotes', aiQuoteRoutes);
app.use('/auth', authLimiter, authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, _next) => {
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
    if (shouldExposeApiDocs()) {
      console.log(`API docs: http://localhost:${PORT}/api-docs`);
    }
    if (!oauthEnabled) {
      console.log('Google OAuth: disabled (add credentials to enable login)');
    }
  });
}

export default app;
