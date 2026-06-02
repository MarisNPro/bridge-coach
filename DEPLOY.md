# Deployment runbook

Three homes, three jobs:

| Piece            | Hosted on | Notes |
|------------------|-----------|-------|
| Source code      | GitHub    | one monorepo: `/web`, `/engine`, `/supabase` |
| React web app    | Vercel    | imports from GitHub, auto-deploys on push |
| FastAPI engine   | Railway   | Docker container; **not** Vercel |
| Postgres / Auth  | Supabase  | already live (`djivgdwibxojoidarhzr`) |

Recommended: **one repo** (monorepo). Vercel builds only the `web/` subdirectory;
Railway builds only `engine/`. Simpler than juggling two repos for a solo build.

---

## 1. GitHub (your action — no connector available)

From the project root (`phase0/`):

```bash
git init
git add .
git commit -m "Phase 0: foundations (web + engine + supabase migrations)"
git branch -M main
# create an empty repo on github.com first (no README/gitignore), then:
git remote add origin https://github.com/MarisNPro/bridge-coach.git
git push -u origin main
```

`.gitignore` files are already in place (root, `web/`, `engine/`) so
`node_modules`, `dist`, `.env*`, `.venv`, and `.vercel` stay out of the repo.

---

## 2. Vercel — the web app

Do this once in the Vercel dashboard (Add New → Project → Import the GitHub repo):

- **Root Directory:** `web`  ← important, since the repo is a monorepo
- **Framework Preset:** Vite (auto-detected)
- **Build Command:** `npm run build` (auto)
- **Output Directory:** `dist` (auto)
- **Environment Variables** (Project Settings → Environment Variables):
  - `VITE_SUPABASE_URL = https://djivgdwibxojoidarhzr.supabase.co`
  - `VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqaXZnZHdpYnhvam9pZGFyaHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTE0NzAsImV4cCI6MjA5NTk4NzQ3MH0.gD90ZdT2X4TkvuPgtIx_T-atbcbzYO4SFXRho5m-5Wo` (the anon/publishable key; safe in the browser — RLS protects the data)

`web/vercel.json` already adds the SPA fallback (all routes → `index.html`) so
React Router deep links and page refreshes don't 404.

After this, every `git push` to `main` auto-builds and deploys. Preview
deployments are created for other branches.

### Auth gotcha (do not skip)
Magic-link sign-in redirects back to your site URL. In Supabase →
Authentication → URL Configuration, add the Vercel domain:
- **Site URL:** your production Vercel URL (e.g. `https://bridge-coach.vercel.app`)
- **Redirect URLs:** add both the Vercel URL and `http://localhost:5173` (local dev)

Without this, the magic link will refuse to redirect to the deployed app.

---

## 3. Railway — the engine (separate, later)

The engine is a Docker container, so it deploys to Railway, not Vercel.

- New Project → Deploy from GitHub repo → set the service **Root Directory** to `engine`.
- Railway detects the `Dockerfile` and builds it.
- No secrets needed yet. Two things to set before the pilot:
  - **CORS:** `engine/app/main.py` currently allows `allow_origins=["*"]`.
    Lock it to the Vercel web origin before real users.
  - Once `/bid` is wired and the web app calls the engine, add the engine's
    public Railway URL to the web app as a new Vercel env var
    (e.g. `VITE_ENGINE_URL`).

---

## Fastest path to unblock sign-ins right now
You don't need any of the above to test login. Locally:

```bash
cd web
cp .env.example .env.local   # fill in the two VITE_SUPABASE_* values
npm install
npm run dev                  # http://localhost:5173
```

Request a magic link for each pilot email, click it, and the account +
profile are created. Then I can seed roles through the Supabase connector.
Deploy to Vercel whenever you want a shareable URL — it isn't a prerequisite.
