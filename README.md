# PhiloMedia

PhiloMedia is a media discovery project that connects films and TV series to philosophical quotes. The current MVP lets you browse featured works, search TMDB, open a details page with richer work metadata, and receive both a curated philosophical quote and an AI-generated interpretive reading for the selected title.

## Current Status

The MVP is production-shaped: TMDB search and details, curated and AI-assisted quotes, Mongo-backed storage, Google OAuth, user library collections, Swagger docs, and Render deployment config.

Roadmap (non-blocking for the core flow):

- Richer search filters and sorting
- Deeper metadata and presentation polish
- Community and sharing features

## Product Scope

The MVP is focused on one main promise:

1. Find a movie or series.
2. Open its details page.
3. Read a philosophical quote that resonates with that work.
4. Get an AI interpretation that expands the connection.

That core flow is the part of the project that is currently production-shaped. The rest is roadmap.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- AI: Google Gemini
- External catalog: TMDB
- Auth foundation: Passport + Google OAuth
- Docs: Swagger UI
- Deployment target: Render

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create or update your `.env`.

3. Fill in the required values there.

4. Start the app in development mode:

```bash
npm run dev
```

5. Open:

- App: `http://localhost:3000`
- API docs: `http://localhost:3000/api-docs`

## Environment Variables

Required to boot the server:

- `MONGODB_URI`
- `SESSION_SECRET`
- `TMDB_API_KEY`
- `GOOGLE_AI_API_KEY`
- `GOOGLE_AI_MODEL` (optional; defaults to `gemini-2.0-flash` — see `src/config/geminiModel.js`)

Optional for Google login:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional for deployment or frontend integration:

- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`
- `TMDB_WATCH_REGION` (defaults to `BR`)

## Quote Data Utilities

The project includes utilities for loading and maintaining the quote collection.

Seed the curated local quotes into MongoDB:

```bash
node public/scripts/seed-quotes.js
```

Import the larger Wikiquote dataset into MongoDB:

```bash
node public/scripts/import_quotes_wikiquote.js
```

## Useful Commands

Run the test suite:

```bash
npm test
```

Run tests with open-handle detection:

```bash
npm run test:detect
```

Regenerate `public/scripts/mediaRankCore.js` after editing scoring logic in `src/domain/mediaRanking/mediaRankCore.js`:

```bash
npm run extract:media-rank
```

Start the production server locally:

```bash
npm start
```

## API Surface

Main route groups:

- `GET /health` — process and Mongo connection state
- `GET /api/quotes` — paginated quotes: `?page=1&limit=50&lang=en` → `{ data, page, limit, total, totalPages }`
- `GET /api/quotes/catalog` — merged quote catalog for the frontend
- `POST /api/tmdb/rank-candidates` — ranks TMDB candidates for a serialized quote profile (same scoring as the home page module)
- `/api/matches`, `/api/tmdb`, `/api/ai/quotes`, `/api/me`, `/api/daily-pairing`, `/auth` (when OAuth env vars are set)

Curated static data lives under `public/data/` (`curatedMatches.json`, `curatedPhilosophicalProfiles.json`); daily pairings load from `src/data/dailyPairings.json`.

Swagger is available at `/api-docs`.

## Roadmap

Short-term priorities:

- Discovery filters and sorting on search
- Deeper work metadata and layout polish
- Refine quote relevance and editorial tooling

Long-term ideas:

- Social sharing
- Community feedback on quote relevance
- Browser extension or companion app

## Deployment

The repository includes a `render.yaml` file for Render. To deploy successfully, configure the same environment variables listed above in the Render dashboard.

## License

ISC
