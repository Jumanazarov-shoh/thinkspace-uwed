# ThinkSpace | UWED — Production Deployment & Pilot Readiness Guide

This document outlines the complete production deployment architecture, step-by-step setup, configuration reference, and operational procedures for running the ThinkSpace pilot (10–20 members).

---

## 1. Production Architecture Overview

The system runs on modern, secure, serverless/cloud platforms optimized for the free/hobby tier without unnecessary enterprise complexity:

```
+-----------------------------------------------------------+
|                     Telegram Client                       |
|               (Members, Reviewers, Admins)                |
+-----------------------------------------------------------+
       |                                             |
       | 1. Mini App / Web App Launch               | 2. Telegram Bot
       v                                             v    (/start, /help, notifications)
+-------------------------------+             +-------------------------------+
|        Vercel Frontend        |             |      Railway Bot Worker       |
|  - React 18 + Vite SPA        |             |  - aiogram / HTTP Bot Runner  |
|  - HTTPS Edge Network         |             |  - Background Long Polling    |
|  - Submissions & Review UI    |             +-------------------------------+
+-------------------------------+                            |
       |                                                     |
       | REST API requests (Bearer Token / initData)         |
       v                                                     |
+------------------------------------------------------------v+
|                     Railway Web Service                     |
|  - FastAPI (Python 3.12, Uvicorn ASGI)                      |
|  - Strict RBAC & Telegram initData HMAC-SHA256 Auth         |
|  - Assignment Lifecycle, Rubrics, Moderation & Points       |
|  - Private Signed URL File Streaming                        |
+-------------------------------------------------------------+
       |                                             |
       | SQL Queries / Alembic Migrations            | S3/REST API (Private Bucket)
       v                                             v
+-------------------------------+             +-------------------------------+
|     Supabase PostgreSQL       |             |       Supabase Storage        |
|  - Managed PostgreSQL 15+     |             |  - Private 'submissions'      |
|  - Automated Constraints      |             |  - 1-hour Signed URLs         |
|  - Audit Log & Points Ledger  |             |  - Mime-Type & Size Enforced  |
+-------------------------------+             +-------------------------------+

               +-------------------------------+
               |     Railway Scheduled Task    |
               |  - Runs every 30 or 60 min    |
               |  - Deadline Reminders (24h/6h)|
               |  - Deduplicated Notifications |
               +-------------------------------+
```

---

## 2. Infrastructure Services Summary

| Component | Platform | Plan Tier | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Hobby (Free) | Host React Vite SPA, edge routing, HTTPS, Mini App Webview |
| **Backend API** | Railway | Starter / Trial (Free) | FastAPI application, REST endpoints, RBAC validation, points engine |
| **Bot Worker** | Railway | Starter / Trial (Free) | Telegram bot background process, command handlers, Mini App launcher |
| **Reminder Cron**| Railway | Starter / Trial (Free) | Scheduled worker triggering deadline reminder processing |
| **Database** | Supabase | Free Tier | Managed PostgreSQL with connection pooling & Alembic migrations |
| **File Storage** | Supabase Storage| Free Tier | Encrypted private cloud storage for member submission documents |

---

## 3. Environment Variables Reference

> [!IMPORTANT]
> Never commit actual secrets into Git. Store production values directly in Vercel and Railway dashboard settings.

### Backend (`Railway` Web & Worker Services)

| Variable Name | Required | Example / Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` (disables all development auth bypasses) |
| `SECRET_KEY` | Yes | Secure random string (e.g. 64 hex characters) for JWT signing |
| `DATABASE_URL` | Yes | Supabase PostgreSQL URI: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres` |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token issued by `@BotFather` |
| `SUPER_ADMIN_TELEGRAM_ID` | Yes | Numeric Telegram ID of the primary owner |
| `MINI_APP_URL` | Yes | Public Vercel HTTPS URL (e.g. `https://thinkspace.vercel.app`) |
| `CORS_ORIGINS` | Yes | Allowed web origins: `https://thinkspace.vercel.app,http://localhost:5173` |
| `STORAGE_BACKEND` | Yes | `supabase` |
| `SUPABASE_URL` | Yes | `https://[PROJECT-REF].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase `service_role` secret key (for private bucket management) |
| `SUPABASE_STORAGE_BUCKET` | No | Default: `submissions` |
| `MAX_FILE_SIZE_MB` | No | Default: `10` |
| `DEFAULT_LANGUAGE` | No | `uz` |

### Frontend (`Vercel` Environment Variables)

| Variable Name | Required | Safe for Browser? | Example / Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | **YES** | Production Railway URL (e.g. `https://api-production.up.railway.app/api`) |

---

## 4. Step-by-Step Deployment Instructions

### Step 1: Connect Git Repository
1. Push your clean repository to GitHub:
   ```bash
   git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Set Up Supabase Database & Storage
1. Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a new project:
   - Project Name: `thinkspace-uwed`
   - Region: Select nearest region (e.g. Frankfurt / EU Central)
   - Save the generated database password securely.
2. In Project Settings > Database:
   - Copy the Connection String (URI). Note: use the direct port 5432 or transaction pooler port 6543.
3. In Storage:
   - Create a new bucket named `submissions`.
   - **Important**: Toggle "Public bucket" to **OFF** (Private).
   - In Project Settings > API, copy the Project URL and `service_role` secret.
4. Run Alembic migrations against Supabase:
   ```bash
   cd backend
   # Set temporary DATABASE_URL in your terminal session
   $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
   alembic upgrade head
   ```

### Step 3: Deploy Backend API & Bot on Railway
1. Navigate to [https://railway.app](https://railway.app) and create a New Project from your GitHub repository.
2. **Service 1: FastAPI Web Service**
   - Root Directory: `backend`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Variables: Add all backend variables from Section 3 above (`ENVIRONMENT=production`, `DATABASE_URL`, `SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BACKEND=supabase`).
   - Settings > Networking: Click "Generate Domain" to obtain a public HTTPS URL (e.g. `https://thinkspace-api-production.up.railway.app`).
3. **Service 2: Telegram Bot Worker**
   - In the same Railway project, click "+ New" > "GitHub Repo" (select same repo).
   - Root Directory: `backend`
   - Start Command: `python -m app.bot.runner`
   - Variables: Link/copy the same variables from Service 1.
4. **Service 3: Deadline Reminder Cron Job**
   - Click "+ New" > "Empty Service" or configure a Cron trigger:
   - Schedule: `*/30 * * * *` (every 30 minutes)
   - Command:
     ```bash
     python -c "from app.services.notification_service import NotificationService; from app.database import SessionLocal; db = SessionLocal(); NotificationService.process_deadline_reminders(db); db.close()"
     ```

### Step 4: Deploy Frontend on Vercel
1. Navigate to [https://vercel.com](https://vercel.com) and click "Add New... Project".
2. Import your GitHub repository:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `pnpm build` (or `npm run build`)
   - Output Directory: `dist`
3. Environment Variables:
   - Add `VITE_API_BASE_URL` = `https://thinkspace-api-production.up.railway.app/api`
4. Click **Deploy**. Vercel will build and assign an HTTPS URL (e.g. `https://thinkspace-uwed.vercel.app`).
5. Update Backend `CORS_ORIGINS` in Railway:
   - Add your Vercel URL: `https://thinkspace-uwed.vercel.app`

### Step 5: Configure Telegram Mini App via BotFather
1. Open Telegram and message `@BotFather`.
2. Send `/mybots` and select your ThinkSpace bot.
3. Select **Bot Settings** > **Menu Button** > **Configure menu button**.
4. Enter the URL: `https://thinkspace-uwed.vercel.app`
5. Enter button text: `Open ThinkSpace`
6. (Optional) In BotFather, use `/newapp` or `/setapp` to configure a short name Web App.

---

## 5. Security Model & Production Safeguards

1. **Authentication:**
   - In production (`ENVIRONMENT=production`), development headers (`X-Dev-User-Id`) and dev bypass query parameters (`?dev_user=...`) are completely ignored.
   - All requests require a valid JWT Bearer token or signed Telegram `initData` with HMAC-SHA256 signature verified against `TELEGRAM_BOT_TOKEN`.
2. **Role-Based Access Control (RBAC):**
   - Role boundaries (`member`, `evaluator`, `senior_reviewer`, `moderator`, `admin`, `super_admin`) are strictly enforced at the database and service layers.
   - Self-promotion is impossible; only a Super Admin or designated Admin can assign elevated roles.
   - Evaluators cannot grade their own submissions or submissions outside their assigned direction/task.
3. **Storage Security:**
   - The Supabase `submissions` bucket is **private**.
   - Direct file URLs cannot be guessed or accessed without authorization.
   - File downloads are proxied through `/api/submissions/files/{id}/download`, which verifies membership/role before redirecting to an ephemeral (1-hour) signed URL.
4. **CORS:**
   - Only the production Vercel frontend URL and designated admin origins are allowed in `CORS_ORIGINS`. Wildcard `*` with credentials is explicitly forbidden.

---

## 6. Maintenance & Operational Procedures

### Applying Future Database Migrations
When adding new models or schema changes:
```bash
# In backend/
alembic revision --autogenerate -m "description_of_change"
alembic upgrade head
```

### Restarting Services
- **Backend API:** In Railway dashboard, click `Restart Service`.
- **Telegram Bot:** In Railway dashboard, click `Restart Service`.
- **Frontend:** Vercel automatically deploys every push to the `main` branch.

### Health Check Endpoints
- **Liveness:** `GET https://[RAILWAY-BACKEND-URL]/health` (returns `{ "status": "ok", "app": "ThinkSpace UWED" }`)
- **Readiness:** `GET https://[RAILWAY-BACKEND-URL]/ready` (validates database connection pool health)

---

## 7. Pilot Readiness Status

| Criterion | Target | Verified Status |
| :--- | :--- | :--- |
| **All Test Suites** | 100% Pass | **53/53 Passed** |
| **Frontend Production Build** | Zero Errors | **Passed (`dist/index.html`, 10.3s)** |
| **Alembic Migrations** | Head synced | **Verified (`3f6f75b0ced1`)** |
| **Secret Hygiene** | No leaks | **Verified (Zero secrets tracked)** |
| **Storage Architecture** | Private Cloud Ready | **Verified (`SupabaseStorageProvider`)** |
| **Capacity** | 10–20 members | **Fully Ready for Pilot Launch** |
