# SkinSense AI

AI-powered skincare recommendation platform built with NestJS.

## What It Does

- Collects user skin profile input (skin type, concerns, sensitivities, goal, budget).
- Recommends ingredient stacks using:
  - AI generation (OpenRouter model), plus
  - Rule-based fallback logic when AI is unavailable.
- Matches ingredients to your product database and ranks products by fit score.
- Generates marketplace links when product matches are limited.
- Serves a skincare-themed frontend from the same backend for seamless integration.

## Tech Stack

- Backend: NestJS + TypeORM + PostgreSQL
- AI Provider: OpenRouter Chat Completions API
- Frontend: Static HTML/CSS/JS served by Nest

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

## Build & Test

```bash
npm run build
npm run test
```

## Main API Endpoints

- `POST /recommend`
  - Body:
    ```json
    {
      "skinType": "combination",
      "skinConcerns": ["acne", "hyperpigmentation"],
      "sensitivities": ["fragrance"],
      "routineGoal": "fade marks and control breakouts",
      "budgetLevel": "medium"
    }
    ```
- `GET /products`
- `GET /products/search?ingredients=niacinamide,salicylic acid`
- `POST /products`
- `GET /ingredients`
- `GET /ingredients/:name`
- `POST /ingredients`
- `GET /marketplace/products?ingredients=niacinamide,salicylic acid`
