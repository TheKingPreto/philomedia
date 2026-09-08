# PhiloMedia

> Discover films and series through the lens of philosophy — with AI-powered interpretations.

![PhiloMedia Screenshot](./docs/screenshot.png)

🔗 **[Live Demo](https://philomedia.onrender.com/)**

---

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat&logo=google&logoColor=white)
![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=flat&logo=render&logoColor=white)

---

## About

PhiloMedia connects films and TV series to philosophical quotes. Browse featured pairings, search the TMDB catalog through 12 philosophical lenses, open a thinker's page, and read a curated quote plus an optional AI interpretation — in **English** and **Brazilian Portuguese**.

## User Flow

1. Search for a movie or series, or pick a lens
2. Open its details page
3. Read a resonant philosophical quote
4. Optionally sign in for an AI-generated interpretation and a personal library

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Backend** | Node.js, Express |
| **Database** | MongoDB + Mongoose |
| **AI** | Google Gemini API |
| **Auth** | Passport.js + Google OAuth |
| **External API** | TMDB |
| **Docs** | Swagger UI (non-production only) |
| **Deployment** | Render |

## Key Features

- **Lenses:** Twelve philosophical discovery filters on search (themes, TMDB keywords, genres, crew).
- **Thinkers:** Curated philosopher pages with quotes and related works. Community submissions stay pending until an admin approves their quotes.
- **Internationalization (i18n):** EN/PT via `localStorage` and `Accept-Language`. TMDB metadata, catalogs, and biographies follow the locale.
- **AI Interpretation:** Gemini readings for a title. Requires a session. Automatic model fallback handles rate limits.
- **User Library:** Google OAuth with watchlist, favorites, watched, and quote/media ratings that bias the details ranking.
- **API Documentation:** Swagger UI at `/api-docs` in development and test — not mounted in production.
- **Data Utilities:** npm scripts for seeding quotes, importing Wikiquote, downloading fonts, and benchmarking lenses.

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/Lucassilva027/philomedia.git
cd philomedia

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Fill in: MONGODB_URI, SESSION_SECRET, TMDB_API_KEY, GOOGLE_AI_API_KEY
# Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CORS_ORIGIN, PUBLIC_SITE_URL
# Behind a reverse proxy set TRUST_PROXY=1 (on automatically when NODE_ENV=production)

# 4. Start development server
npm run dev
# App running at http://localhost:3000
```

Useful data scripts (see `package.json`):

```bash
npm run seed:quotes
npm run import:wikiquote
npm run fonts:download
npm run benchmark:lenses
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Process and database health check |
| GET | `/api/quotes/catalog` | Public quote catalog (approved + curated) |
| POST | `/api/ai/quotes/generate/media-context` | AI interpretation by `tmdbId` + `mediaType` (authenticated) |
| GET | `/api-docs` | Swagger UI (non-production only) |

## Roadmap

- [x] Discovery filters and lens-based browsing
- [x] Thinker pages and community submissions
- [ ] Improved metadata layout and editorial tooling
- [ ] Social sharing and community feedback
- [ ] Browser extension
