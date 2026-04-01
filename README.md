# PhiloMedia

PhiloMedia is a media discovery project that connects films and TV series to philosophical quotes. The current MVP lets you browse featured works, search TMDB, open a details page with richer work metadata, and receive both a curated philosophical quote and an AI-generated interpretive reading for the selected title.

## Current Status

PhiloMedia is no longer just a project skeleton. It already has a working search-to-details flow, a quote database, TMDB integration, and an AI interpretation layer.

What works today:

- Featured movie and TV recommendations on the home page
- Search powered by TMDB
- Details page with synopsis, genres, studio or network, creator or director, and TMDB rating
- Static quote matching with fallback logic
- AI-generated interpretive reading based on the selected work
- Quote storage in MongoDB
- Swagger docs for the REST API
- Render deployment config

What is still incomplete:

- Finished login experience in the UI
- Favorites and saved user collections
- Search filters and sorting
- Richer work metadata beyond the current essentials
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

Start the production server locally:

```bash
npm start
```

## API Surface

Main route groups already available:

- `/api/quotes`
- `/api/matches`
- `/api/tmdb`
- `/api/ai/quotes`
- `/auth` when Google OAuth credentials are configured

Swagger is available at `/api-docs`.

## Roadmap

Short-term priorities:

- Finish the authentication experience in the frontend
- Add filters for media search and discovery
- Improve work metadata depth and presentation
- Add favorites and user collections
- Refine the quote relevance logic

Long-term ideas:

- Social sharing
- Community feedback on quote relevance
- Browser extension or companion app

## Deployment

The repository includes a `render.yaml` file for Render. To deploy successfully, configure the same environment variables listed above in the Render dashboard.

## License

ISC
