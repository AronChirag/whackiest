# Expense Copilot

## Run locally

Install dependencies for the root tools and both apps:

```sh
npm run install:all
```

Configure the backend database connection in `backend/.env`, then start the
frontend and API together from the project root:

```sh
npm run dev
```

Vite prints the frontend URL (normally `http://localhost:5173`) and the API
runs at `http://localhost:5000`.

The backend `.env` must also contain a strong `JWT_SECRET` and a valid
`GEMINI_API_KEY`. `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`.
Keep these values server-side; never add them to frontend environment variables.
The frontend uses Vite's `/api` proxy in development. For a separate frontend
deployment, set `VITE_API_URL` to the backend origin or its `/api` URL.

## Demo account

To add repeatable, isolated sample transactions, budgets, subscriptions, and
receipts for testing, run from the project root:

```sh
npm run seed:demo --prefix backend
```

Sign in with `demo@expense-copilot.test` / `DemoPass123!`. The sample data only
belongs to that demo account. This does not enable bank connections or live
tracking; real-time tracking should only be configured when explicitly
requested.