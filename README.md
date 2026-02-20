# SkinSense AI

AI-powered skincare recommendation platform built with NestJS.

## What It Does

- Collects user skin profile input (skin type, concerns, sensitivities, goal, budget).
- Supports user identity and personalization via:
  - Email/password registration + login
  - Google login (ID token or OAuth access token)
- Recommends ingredient stacks using:
  - AI generation (OpenRouter model), plus
  - Rule-based fallback logic when AI is unavailable.
- Supports skin-image assisted analysis (`/recommend/with-image`) with guest mode and saved progress for signed-in users.
- Matches ingredients to your product database and ranks products by fit score.
- Generates marketplace links when product matches are limited.
- Saves recommendation history for authenticated users.
- Includes photo-to-photo progress comparison charts for returning users.
- Serves a skincare-themed frontend from the same backend for seamless integration.

## Tech Stack

- Backend: NestJS + TypeORM + PostgreSQL
- AI Provider: OpenRouter Chat Completions API
- Frontend: Static HTML/CSS/JS served by Nest
- Deployment: Vercel serverless function (`api/index.ts`)

## Environment Variables

Create a `.env` file:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=skincare_ai

OPENROUTER_API_KEY=your_openrouter_key
AMAZON_ASSOCIATE_TAG=your_tag_optional

AUTH_SECRET=your_long_random_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
DB_SSL=false
TYPEORM_SYNCHRONIZE=true
TYPEORM_LOGGING=false
```

If `OPENROUTER_API_KEY` is missing, the app still works using rule-based recommendations.

## Run Locally

```bash
npm install
npm run start:dev
```

Open:

- Frontend: `http://localhost:3000/`
- Swagger docs: `http://localhost:3000/api`

Frontend Google button reads `GOOGLE_CLIENT_ID` via `GET /auth/client-config`.

## Deploy To Vercel

This repo is configured for Vercel with `vercel.json` and `api/index.ts`.

1. Push this repository to GitHub.
2. In Vercel, import the repo.
3. Set these Environment Variables in Vercel project settings:
   - `AUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `OPENROUTER_API_KEY`
   - Database:
     - Either `DATABASE_URL` (recommended),
     - Or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `DB_SSL=true` if your managed Postgres requires SSL (Neon/Supabase/most hosted PG).
   - `TYPEORM_SYNCHRONIZE=true` for first-time schema bootstrap.
4. Deploy.

Notes:
- Do not use `JWT_SECRET`; this app uses `AUTH_SECRET`.
- Progress photos are stored in Postgres, so they work on Vercel (no local disk dependency).

## Build & Test

```bash
npm run build
npm run test
```

## Main API Endpoints

- Auth
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/google`
  - `GET /auth/me`
  - `PATCH /auth/plan` (`free` | `pro`)
  - `GET /auth/pro-features`
- `POST /recommend`
- `POST /recommend/with-image` (multipart form-data with `image` file, auth optional)
- `GET /recommend/history` (requires auth)
- `GET /recommend/progress` (requires auth, chart + before/after deltas)
  - Body:
    ```json
    {
      "skinType": "combination",
      "skinConcerns": ["acne", "hyperpigmentation"],
      "sensitivities": ["fragrance"],
      "routineGoal": "fade marks and control breakouts",
      "budgetLevel": "medium",
      "photoNotes": "taken in daylight with clean skin"
    }
    ```
- `GET /products`
- `GET /products/search?ingredients=niacinamide,salicylic acid`
- `POST /products`
- `GET /ingredients`
- `GET /ingredients/:name`
- `POST /ingredients`
- `GET /marketplace/products?ingredients=niacinamide,salicylic acid`
