# ThinkSpace | UWED — Complete Beginner's Deployment Guide
*Telegram Bot + Telegram Mini App + Multi-Admin Evaluation Platform*  
*School of International Economics and Management (SIEM) — University of World Economy and Diplomacy (UWED / JIDU)*

---

## Table of Contents
1. [Understanding the System Architecture](#1-understanding-the-system-architecture)
2. [Setting Up Your Telegram Bot (@BotFather)](#2-setting-up-your-telegram-bot-botfather)
3. [Running Everything Locally (Step-by-Step)](#3-running-everything-locally-step-by-step)
4. [Testing Roles without Telegram (Developer Mode)](#4-testing-roles-without-telegram-developer-mode)
5. [Deploying Database & Backend to Railway](#5-deploying-database--backend-to-railway)
6. [Deploying Frontend to Vercel](#6-deploying-frontend-to-vercel)
7. [Configuring Telegram Mini App URL](#7-configuring-telegram-mini-app-url)
8. [Troubleshooting & Common Questions](#8-troubleshooting--common-questions)

---

## 1. Understanding the System Architecture

ThinkSpace | UWED uses a **single, unified backend and database** powering three user interfaces:

```
                          ┌───────────────────────────┐
                          │   PostgreSQL / SQLite     │
                          │   (Single Source of Truth)│
                          └─────────────┬─────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │    FastAPI Python API     │
                          │    (app.main:app)         │
                          └──────┬─────────────┬──────┘
                                 │             │
                ┌────────────────┴────┐   ┌────┴────────────────┐
                │ Telegram Bot        │   │ React Vite Frontend │
                │ (aiogram 3.x)       │   │ (Tailwind + TS)     │
                └─────────────────────┘   └──────────┬──────────┘
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   ▼                                   ▼
                      [ Telegram Mini App ]                  [ Web Admin Panel ]
                      (Mobile-first for members)             (Desktop for Staff)
```

- **Telegram Bot:** Welcomes new members, sends task notifications, announcements, and provides a direct one-click button to launch the Mini App.
- **Telegram Mini App:** Runs smoothly inside Telegram on phones. Members browse tasks, upload submissions (text, links, documents), track their personal intellectual growth, and check the official rankings.
- **Web Admin Panel:** Full-featured desktop portal for club staff to create assignments with dynamic rubrics, score submissions with double-blind support, detect grading discrepancies (>15%), moderate final grades, and resolve appeals.

---

## 2. Setting Up Your Telegram Bot (@BotFather)

You do **not** need a paid server to create a Telegram bot. Follow these 4 easy steps:

### Step 2.1: Create the Bot
1. Open Telegram and search for **`@BotFather`** (ensure it has the official blue verification badge).
2. Click **Start** and send the command:
   ```text
   /newbot
   ```
3. Enter a friendly name for your bot, for example:
   ```text
   ThinkSpace UWED
   ```
4. Enter a username ending in `bot`, for example:
   ```text
   thinkspace_uwed_bot
   ```
5. `@BotFather` will reply with your **HTTP API Token**, which looks like:
   ```text
   7123456789:AAFlkB4m2rV...YourToken...
   ```
   > ⚠️ **Keep this token secret!** Copy it into your `.env` file as `TELEGRAM_BOT_TOKEN`.

### Step 2.2: Find Your Personal Telegram ID (Super Admin Bootstrap)
To automatically become the first Super Admin when contacting the bot:
1. In Telegram, search for **`@userinfobot`** and click **Start**.
2. It will reply with your numeric `Id` (e.g. `123456789`).
3. Place this number into your `.env` file:
   ```env
   SUPER_ADMIN_TELEGRAM_ID=123456789
   ```

---

## 3. Running Everything Locally (Step-by-Step)

You can run the entire platform on your personal computer in 3 minutes.

### Prerequisites:
- **Python 3.10+** installed
- **Node.js 18+** installed

### Step 3.1: Configure Your Environment File
In the project root folder (`thinkspace boti/`), create a file named `.env` (or copy `.env.example`):
```env
ENVIRONMENT=development
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
MINI_APP_URL=http://localhost:5173
SUPER_ADMIN_TELEGRAM_ID=your_telegram_id
SECRET_KEY=thinkspace-secret-key-32chars-minimum-length
DATABASE_URL=sqlite:///./thinkspace.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=25
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
DEFAULT_LANGUAGE=uz
```

### Step 3.2: Start the Backend API
Open a terminal in the project root:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- Open your browser to `http://localhost:8000/docs` to see the interactive Swagger API documentation.
- All database tables are automatically generated on first launch!

### Step 3.3: Start the Frontend Application
Open a second terminal window:
```bash
cd frontend
npm install   # or: pnpm install
npm run dev   # or: pnpm dev
```
- Open `http://localhost:5173` in your browser.
- The platform will load instantly!

### Step 3.4: Run the Telegram Bot (Optional for Local Testing)
Open a third terminal window:
```bash
cd backend
python -m app.bot.run_bot
```
The bot will connect to Telegram and start listening for updates.

---

## 4. Testing Roles without Telegram (Developer Mode)

You do **not** need a real phone or active Telegram session to test all member and admin workflows.

We built an integrated **Role Simulator**:
1. Open `http://localhost:5173` in your browser.
2. In the top bar or inside the **Profile** tab, you will see the **Role Simulator**:
   - **Member**: Submit essays, view rubrics, file grade appeals.
   - **Evaluator**: Score submissions using criterion sliders and add critique.
   - **Moderator**: Review multi-admin discrepancies (>15%), override scores with rationale, and publish official grades.
   - **Super Admin**: Approve new membership requests, assign roles, and configure system rules.
3. Click any role button to instantly switch identities without logging in and out!

---

## 5. Deploying Database & Backend to Railway

[Railway.app](https://railway.app) is the easiest platform for hosting persistent Python services and PostgreSQL.

### Step 5.1: Create a Railway Account & New Project
1. Go to [railway.app](https://railway.app) and sign up with your GitHub account.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `thinkspace-uwed` repository.

### Step 5.2: Add a Managed PostgreSQL Database
1. In your Railway project canvas, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway creates a managed PostgreSQL instance and gives you a `DATABASE_URL` variable.

### Step 5.3: Configure Backend Environment Variables
Click on your backend service in Railway, go to the **Variables** tab, and add:
- `ENVIRONMENT`: `production`
- `TELEGRAM_BOT_TOKEN`: Your token from @BotFather
- `MINI_APP_URL`: Your Vercel frontend URL (e.g. `https://thinkspace-uwed.vercel.app`)
- `SUPER_ADMIN_TELEGRAM_ID`: Your personal Telegram ID
- `SECRET_KEY`: A strong random 32+ character string
- `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (Railway references this automatically!)
- `UPLOAD_DIR`: `/tmp/uploads`
- `DEFAULT_LANGUAGE`: `uz`

### Step 5.4: Deploy Service
Railway automatically reads the `Procfile` and `Dockerfile`, runs database migrations, and exposes your API on HTTPS (e.g., `https://backend-production-xyz.up.railway.app`).

---

## 6. Deploying Frontend to Vercel

[Vercel](https://vercel.com) provides free, global, fast HTTPS hosting for Vite + React apps.

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** → **Project**.
3. Import your `thinkspace-uwed` repository.
4. Set **Root Directory** to: `frontend`.
5. Under **Environment Variables**, add:
   - `VITE_API_BASE`: `https://backend-production-xyz.up.railway.app/api`
6. Click **Deploy**!
7. Within 60 seconds, your frontend will be live with a secure HTTPS URL (e.g., `https://thinkspace-uwed.vercel.app`).

---

## 7. Configuring Telegram Mini App URL

Once your Vercel URL is active:

1. Open Telegram and go to **`@BotFather`**.
2. Send the command:
   ```text
   /mybots
   ```
3. Select your bot (e.g. `@thinkspace_uwed_bot`).
4. Click **Bot Settings** → **Menu Button** → **Configure menu button**.
5. Send your Vercel HTTPS URL:
   ```text
   https://thinkspace-uwed.vercel.app
   ```
6. Set the button title to:
   ```text
   🚀 ThinkSpace
   ```
7. Now, when anyone opens your bot on Telegram, the menu button in the bottom-left will open the ThinkSpace Mini App directly inside Telegram!

---

## 8. Troubleshooting & Common Questions

### Q: Why does the Mini App require HTTPS?
Telegram WebApps enforce strict HTTPS security. Vercel automatically gives you a free SSL certificate (`https://`). For local phone testing before deploying to Vercel, you can use [ngrok](https://ngrok.com) (`ngrok http 5173`).

### Q: How do I test double-blind evaluations with discrepancy warnings?
1. In the Web Admin panel, create an assignment requiring **2 evaluators** and a **15% discrepancy threshold**.
2. Submit work as a Member.
3. Switch role to **Evaluator** and give 90 points.
4. Log in as a second staff member and give 60 points.
5. In the **Moderation** tab, the system will flag the submission with a high-priority banner: `Discrepancy: 30% > 15% threshold — Senior Review Required`.

### Q: Where are uploaded files stored?
In development, uploaded PDF and image files are saved to `./uploads`. In production, files can either be stored in persistent storage volumes or directly referenced via Telegram's native file IDs (`file_id`).

### Q: Can I run backend and frontend on the same server?
Yes! When you run `pnpm build` in `frontend/`, the compiled application is placed in `frontend/dist`. The FastAPI backend automatically serves this at `http://localhost:8000/app/`!
