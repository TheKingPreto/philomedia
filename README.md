# PhiloMedia

**[English](#english)** | **[Português](#portugues)**

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat&logo=google&logoColor=white)
![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=flat&logo=render&logoColor=white)

---

<h2 id="english">English</h2>

PhiloMedia reads films and series as philosophy: a lens, a quote, and the thinker naming what the story was already arguing.

Interface in **English** and **Brazilian Portuguese**.

**[Live site](https://philomedia.onrender.com/)**

### What it is

Search a title or start from a philosophical lens. Open the work, read a curated quote (`selectQuoteForMedia`), and follow the thinker. Sign in if you want a library, ratings, or a Gemini reading.

It is not a generic “what to watch” catalog. Pairings come from the quote catalog, editorial calendar, and TMDB — not from median popularity alone.

### Features

- **Home:** hero, today’s pairing, and a weekly philosophical shelf (trending titles that overlap the lenses).
- **Search:** twelve lenses (five featured, the rest behind “see all”), shareable `?lens=`, and a Brazil streaming-provider filter (`TMDB_WATCH_REGION=BR`).
- **Details:** catalog quote, related works, star rating on the title, thumbs on the quote. Ratings require a session and bias later quote ranking.
- **Thinkers:** localized pages, sitemap entries, portraits through `/api/assets/portrait`. A thinker with no quotes stays up and shows an empty state.
- **Auth and library:** Google OAuth, watchlist / favorites / watched, authenticated ratings.
- **Gemini:** theme, philosopher, and media-context generation only with a session. Anonymous visitors read the catalog.
- **Contributions:** user quotes start as `pending` and stay out of the public catalog until an admin approves them.
- **SEO:** Open Graph and JSON-LD are written into the HTML the server sends. `/sitemap.xml` includes daily-pairing works and thinker pages.
- **i18n:** EN/PT via `localStorage` and `Accept-Language`. TMDB metadata and biographies follow the locale.
- **Fonts:** Cormorant Garamond and DM Sans self-hosted (`npm run fonts:download`).

### Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, ESM JavaScript (no bundler) |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| AI | Google Gemini (`@google/generative-ai`) |
| Auth | Passport.js + Google OAuth |
| Catalog / metadata | TMDB |
| API docs | Swagger UI, **non-production only** |
| Hosting | Render |

### Setup

Needs **Node.js** and a running **MongoDB**.

```bash
git clone https://github.com/Lucassilva027/philomedia.git
cd philomedia
npm install
cp .env.example .env
```

Fill the required keys in `.env` (see [Environment](#environment)). Do not commit secrets.

```bash
npm start
```

Then open:

- http://localhost:3000/html/index.html
- http://localhost:3000/html/search.html
- http://localhost:3000/html/philosophers.html

`npm run dev` is the same server with `--watch`.

Swagger UI is mounted at **http://localhost:3000/api-docs** when `NODE_ENV` is not `production`. It is not available on the live Render deploy.

Google login stays disabled until both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

### Scripts

| Script | What it does |
|---|---|
| `npm start` | Start the Express server |
| `npm run dev` | Start with `--watch` |
| `npm test` | Jest unit + integration tests |
| `npm run test:e2e` | Playwright end-to-end (starts `npm start` unless a server is already up) |
| `npm run test:detect` | Jest with `--detectOpenHandles` |
| `npm run lint` | ESLint |
| `npm run seed:quotes` | Upsert curated quotes from `public/scripts/custom-quotes.js` into MongoDB |
| `npm run import:wikiquote` | Import `scripts/data/quotes_wikiquote.json` into MongoDB |
| `npm run translate:quotes` | Translate the Wikiquote dump (needs Gemini) |
| `npm run translate:quotes:pt` | Regenerate PT strings for custom quotes (needs Gemini) |
| `npm run generate:real-quotes` | Build daily pairings from real-quote sources |
| `npm run generate:real-candidates` | Ask Gemini for authentic quote candidates |
| `npm run fonts:download` | Download woff2 subsets and write `public/css/styles/fonts.css` |
| `npm run benchmark:lenses` | One-shot TMDB check of lens pool quality (needs `TMDB_API_KEY`) |
| `npm run pairings:dedupe` | Remove duplicate slugs in `src/data/dailyPairings.json` |
| `npm run theme:buckets` | Theme-bucket map used by the pairing scripts |

### Tests

- **Jest** (`npm test`): unit and integration under `tests/`.
- **Playwright** (`npm run test:e2e`): Chromium flows for home, lenses, thinkers, library, and ratings. Uses `http://localhost:3000` and reuses a running server when one exists.

### Environment

Copy `.env.example`. Required:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Express session secret (long random string) |
| `TMDB_API_KEY` | TMDB API key |
| `GOOGLE_AI_API_KEY` | Gemini API key |

Server:

| Variable | Purpose |
|---|---|
| `PORT` | Defaults to `3000` |
| `NODE_ENV` | `development`, `test`, or `production` |
| `TRUST_PROXY` | Set `1` behind Render/nginx. On automatically in production unless `0`/`false`. Leave unset in local dev so `X-Forwarded-For` cannot spoof rate limits. |

Public URL, CORS, OAuth:

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Canonical / OG / sitemap base (`http://localhost:3000` locally) |
| `PUBLIC_BASE_URL` | Alias of `PUBLIC_SITE_URL` |
| `GOOGLE_CALLBACK_URL` | OAuth callback (`http://localhost:3000/auth/google/callback` locally) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Both required to enable login. |
| `CORS_ORIGIN` | Comma-separated allowlist. Never `*` with cookies. Production without this variable is same-origin only. |

Optional catalog / pairing:

| Variable | Purpose |
|---|---|
| `TMDB_WATCH_REGION` | Watch-provider region (default `BR`) |
| `DAILY_PAIRING_TIME_ZONE` | Calendar timezone (default `America/Sao_Paulo`) |
| `GOOGLE_AI_MODEL` | Override the default Gemini model |

Test-only — never enable on a public host:

| Variable | Purpose |
|---|---|
| `ALLOW_TEST_AUTH` | Bypass Google for E2E |
| `TEST_AUTH_USER_JSON` | Fixture user for that bypass |

### Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

### License

ISC. Author: [Lucas Silva](https://github.com/Lucassilva027).

---

<h2 id="portugues">Português</h2>

O PhiloMedia lê filmes e séries como filosofia: uma lente, uma citação e o pensador nomeando o que a história já argumentava.

Interface em **inglês** e **português brasileiro**.

**[Site publicado](https://philomedia.onrender.com/)**

### O que é

Busque um título ou comece por uma lente filosófica. Abra a obra, leia uma citação curada (`selectQuoteForMedia`) e siga o pensador. Entre na conta se quiser biblioteca, avaliações ou uma leitura do Gemini.

Não é um catálogo genérico de “o que assistir”. Os emparelhamentos vêm do catálogo de citações, do calendário editorial e do TMDB — não só da popularidade mediana.

### Funcionalidades

- **Início:** hero, o emparelhamento do dia e uma prateleira filosófica da semana (títulos em alta que cruzam as lentes).
- **Busca:** doze lentes (cinco em destaque, as demais atrás de “ver todas”), `?lens=` compartilhável e filtro de provedores de streaming no Brasil (`TMDB_WATCH_REGION=BR`).
- **Detalhe:** citação do catálogo, obras relacionadas, avaliação por estrelas no título, positivo/negativo na citação. Avaliações exigem sessão e influenciam o ranking posterior de citações.
- **Pensadores:** páginas localizadas, entradas no sitemap, retratos via `/api/assets/portrait`. Um pensador sem citações permanece no ar e mostra estado vazio.
- **Conta e biblioteca:** Google OAuth, watchlist / favoritos / já vistos, avaliações autenticadas.
- **Gemini:** geração de tema, filósofo e contexto da obra só com sessão. Visitantes anônimos leem o catálogo.
- **Contribuições:** citações de usuários entram como `pending` e ficam fora do catálogo público até um admin aprovar.
- **SEO:** Open Graph e JSON-LD vão no HTML que o servidor envia. `/sitemap.xml` inclui obras do emparelhamento diário e páginas de pensadores.
- **i18n:** EN/PT via `localStorage` e `Accept-Language`. Metadados do TMDB e biografias seguem o locale.
- **Fontes:** Cormorant Garamond e DM Sans self-hosted (`npm run fonts:download`).

### Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS, JavaScript ESM (sem bundler) |
| Backend | Node.js, Express |
| Banco de dados | MongoDB + Mongoose |
| IA | Google Gemini (`@google/generative-ai`) |
| Autenticação | Passport.js + Google OAuth |
| Catálogo / metadados | TMDB |
| Docs da API | Swagger UI, **somente fora de produção** |
| Hospedagem | Render |

### Instalação

Precisa de **Node.js** e um **MongoDB** em execução.

```bash
git clone https://github.com/Lucassilva027/philomedia.git
cd philomedia
npm install
cp .env.example .env
```

Preencha as chaves obrigatórias no `.env` (veja [Ambiente](#ambiente)). Não commite segredos.

```bash
npm start
```

Depois abra:

- http://localhost:3000/html/index.html
- http://localhost:3000/html/search.html
- http://localhost:3000/html/philosophers.html

`npm run dev` é o mesmo servidor com `--watch`.

O Swagger UI fica em **http://localhost:3000/api-docs** quando `NODE_ENV` não é `production`. Não está disponível no deploy publicado no Render.

O login com Google permanece desligado até `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estarem definidos.

### Comandos

| Script | O que faz |
|---|---|
| `npm start` | Sobe o servidor Express |
| `npm run dev` | Sobe com `--watch` |
| `npm test` | Testes de unidade e integração no Jest |
| `npm run test:e2e` | E2E no Playwright (sobe `npm start` se ainda não houver servidor) |
| `npm run test:detect` | Jest com `--detectOpenHandles` |
| `npm run lint` | ESLint |
| `npm run seed:quotes` | Faz upsert das citações curadas de `public/scripts/custom-quotes.js` no MongoDB |
| `npm run import:wikiquote` | Importa `scripts/data/quotes_wikiquote.json` no MongoDB |
| `npm run translate:quotes` | Traduz o dump do Wikiquote (precisa do Gemini) |
| `npm run translate:quotes:pt` | Regenera as strings em PT das citações customizadas (precisa do Gemini) |
| `npm run generate:real-quotes` | Monta os emparelhamentos diários a partir de fontes de citações reais |
| `npm run generate:real-candidates` | Pede ao Gemini candidatos de citações autênticas |
| `npm run fonts:download` | Baixa os subsets woff2 e grava `public/css/styles/fonts.css` |
| `npm run benchmark:lenses` | Checagem pontual no TMDB da qualidade do pool de lentes (precisa de `TMDB_API_KEY`) |
| `npm run pairings:dedupe` | Remove slugs duplicados em `src/data/dailyPairings.json` |
| `npm run theme:buckets` | Mapa de buckets temáticos usado pelos scripts de emparelhamento |

### Testes

- **Jest** (`npm test`): unidade e integração em `tests/`.
- **Playwright** (`npm run test:e2e`): fluxos no Chromium para início, lentes, pensadores, biblioteca e avaliações. Usa `http://localhost:3000` e reaproveita um servidor já em execução.

### Ambiente

Copie o `.env.example`. Obrigatórias:

| Variável | Função |
|---|---|
| `MONGODB_URI` | String de conexão do MongoDB |
| `SESSION_SECRET` | Segredo da sessão Express (string longa e aleatória) |
| `TMDB_API_KEY` | Chave da API do TMDB |
| `GOOGLE_AI_API_KEY` | Chave da API do Gemini |

Servidor:

| Variável | Função |
|---|---|
| `PORT` | Padrão `3000` |
| `NODE_ENV` | `development`, `test` ou `production` |
| `TRUST_PROXY` | Use `1` atrás de Render/nginx. Liga sozinho em produção, salvo `0`/`false`. Deixe sem valor no dev local para o `X-Forwarded-For` não forjar rate limit. |

URL pública, CORS, OAuth:

| Variável | Função |
|---|---|
| `PUBLIC_SITE_URL` | Base canônica / OG / sitemap (`http://localhost:3000` no local) |
| `PUBLIC_BASE_URL` | Alias de `PUBLIC_SITE_URL` |
| `GOOGLE_CALLBACK_URL` | Callback do OAuth (`http://localhost:3000/auth/google/callback` no local) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Opcionais. As duas são necessárias para ligar o login. |
| `CORS_ORIGIN` | Allowlist separada por vírgula. Nunca `*` com cookies. Em produção, sem essa variável, vale só same-origin. |

Catálogo / emparelhamento (opcional):

| Variável | Função |
|---|---|
| `TMDB_WATCH_REGION` | Região dos provedores de streaming (padrão `BR`) |
| `DAILY_PAIRING_TIME_ZONE` | Fuso do calendário (padrão `America/Sao_Paulo`) |
| `GOOGLE_AI_MODEL` | Sobrescreve o modelo padrão do Gemini |

Só para testes — nunca ative num host público:

| Variável | Função |
|---|---|
| `ALLOW_TEST_AUTH` | Contorna o Google no E2E |
| `TEST_AUTH_USER_JSON` | Usuário fixture desse bypass |

### Atribuição

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.

### Licença

ISC. Autor: [Lucas Silva](https://github.com/Lucassilva027).
