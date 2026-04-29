# Ascend — Implementation Plan & Technical Decisions Log

This is the living technical document for the Ascend fitness dashboard. It captures architectural decisions, completed work, and the forward roadmap.

---

## Status: Active Development

**Current Version**: 0.1.0  
**Repo**: [github.com/zulkhairee/ascend](https://github.com/zulkhairee/ascend)  
**Local Dev**: `http://localhost:3000`  
**Production**: [ascend-web-mocha.vercel.app](https://ascend-web-mocha.vercel.app)

---

## Completed Work

### ✅ Phase 1 — Visual Mock-up (HTML/CSS)
*April 26, 2026*
- Built a static, single-page mobile app prototype in vanilla HTML/CSS.
- Established the full design system (color palette, typography, component styles).
- Designed the core UI sections: Nutrition Ring, Workout Cards, Muscle Map, AI Insights.

### ✅ Phase 2 — Next.js Migration & Live API Integration
*April 26, 2026*
- Migrated prototype to Next.js (App Router) with server-side rendering.
- Integrated **Lyfta API** (`GET /api/v1/workouts`) for strength training data.
- Integrated **Strava API** with a two-hop fetch (summary + detailed activities for accurate calories).
- Built the **Harmonization Engine** in `getWorkouts()` to merge Lyfta strength sessions with matching Strava sessions by date, deduplicate, and sort.

### ✅ Phase 3 — Dynamic Muscle Maps & Expandable Logs
*April 26, 2026*
- Integrated `react-body-highlighter` for SVG anterior/posterior muscle heatmaps.
- Built `parseLyftaMuscles()` to extract targeted muscle groups from Lyfta image URLs.
- Added expandable `<details>` workout logs for both strength (sets/reps/weight table) and cardio (pace, elevation, max HR, cadence).

### ✅ Phase 4 — Brand Polish & Vercel Deployment
*April 26, 2026*
- Replaced generic icons with Ascend brand logo.
- Tuned muscle map contrast for visual clarity.
- Deployed to **Vercel** with production environment variables configured.

### ✅ Phase 5 — Git, Cross-Device Workflow & AI Insights
*April 27, 2026*

#### 5a: Git & GitHub Setup
- Initialized GitHub repo at `github.com/zulkhairee/ascend`.
- Configured SSH key authentication (`~/.ssh/id_ed25519`) for passwordless push/pull.
- Established clean commit history.

#### 5b: Cross-Device Credential System
- **`CREDENTIALS_BACKUP.md`**: Human-readable local-only key store (gitignored). Drag-and-drop to project root on any new machine.
- **`src/lib/env.js`** (`getEnv(key)`): Smart loader — checks `process.env` first, then falls back to parsing `CREDENTIALS_BACKUP.md` via regex. All API calls use this instead of `process.env` directly.

#### 5c: Strava Token Auto-Fix
- Diagnosed stale access token (6-hour expiry). Refreshed via `POST /oauth/token` using the stored refresh token. Documented the manual refresh process.

#### 5d: AI Performance Insights — Three-Iteration Architecture

| Iteration | Approach | Outcome |
|---|---|---|
| 1 | Gemini called inline in server component | ❌ Blocked entire page render for 5–10s |
| 2 | Dedicated `/api/insights` route + client-side fetch with skeleton loader | ✅ Page renders instantly; insight loads async |
| 3 | Static `src/data/ai_insight.json` served by API route | ✅ No external dependency; zero latency; Antigravity-assisted refresh |

**Current state**: Antigravity fetches live workout data on demand, generates a coaching insight, writes it to `ai_insight.json`, and commits to GitHub. The API route serves this file directly.

**InsightsPanel** (`src/components/InsightsPanel.js`): A `'use client'` component with animated shimmer skeleton loader while the API route responds.

### 🏗️ Phase 6 — Multi-Source Cardio (Garmin Connect + Strava)
*Planned / Strategic Shift*
- **Goal**: Transition Garmin Connect to the primary source for cardio data due to superior physiological metrics (Recovery, Training Load, Sleep).
- **Strategy**: Implement a "Provider-Agnostic" cardio layer.
- **De-duplication Logic**: Match Garmin and Strava activities by timestamp; prioritize Garmin data to avoid duplicates.
- **Auth Strategy**: Use unofficial Garmin Connect credentials (Username/Password) stored in `.env.local` as Garmin lacks a public hobbyist OAuth API.
- **Fallback**: If Garmin credentials are missing or data fails, the system automatically defaults to Strava.

---

## Active Roadmap

### 🔴 High Priority

#### Garmin Connect Integration (New)
- **Goal**: Swap Strava for Garmin as the primary cardio driver.
- **Plan**: Integrate a Node.js Garmin wrapper; map rich metrics like Recovery Time and Body Battery to the UI.

#### Auto Token Refresh (Strava)
- **Problem**: Strava access tokens expire every 6 hours, causing silent API failures.
- **Plan**: Add middleware or a server action that calls `POST https://www.strava.com/oauth/token` with the refresh token, then updates the token in-memory or writes back to `.env.local`.

#### Rate Limit Protection (Strava)
- **Problem**: Two-hop fetch (summary + detailed per activity) will hit Strava's rate limits as workout history grows.
- **Plan**: Cache responses to a local JSON file or KV store; invalidate after 1 hour.

### 🟡 Medium Priority

#### AI Insights — Automated Refresh
- **Plan**: GitHub Action that runs daily → calls the Strava and Lyfta APIs → posts data to a Gemini API endpoint (when quota allows) or triggers Antigravity → commits updated `ai_insight.json` to main.
- **Alternative**: A `/api/refresh-insight` endpoint (password-protected) that can be triggered manually from the UI.

#### Nutrition Data Integration
- **Plan**: Integrate a real nutrition API (MyFitnessPal, Cronometer, or FatSecret) to replace the current mocked macro data.
- **Future**: AI insights will incorporate macro adherence alongside workout performance.

#### Dynamic Greeting
- **Plan**: Read current time server-side and output "Good Morning / Afternoon / Evening" accordingly.

#### Workout Pagination
- **Plan**: Add a "Load More" button or infinite scroll to show more than the current 3 workouts.

### 🟢 Low Priority / Future Vision

- **Webhooks**: Replace polling with Strava/Lyfta webhooks for real-time data push.
- **Historical Analytics**: Weekly/monthly volume trend charts (Recharts or Chart.js).
- **HR Zone Classification**: Auto-tag runs as Zone 2, Threshold, or VO2 Max based on heart rate ranges.
- **Nutrition × AI Fusion**: Pass both workout data and daily food intake to the AI coach for holistic performance insights.

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| Next.js App Router (server components) | Keeps API keys server-side; no client-side secrets exposure |
| `getEnv()` fallback utility | Enables seamless cross-device workflow without committing secrets |
| Static `ai_insight.json` over live Gemini API | Eliminates rate limit dependency; Antigravity-assisted refresh is fast and controllable |
| `<details>/<summary>` for expandable logs | Zero JS overhead; native browser behavior; accessible by default |
| SSH over HTTPS for git | No token prompts; permanent setup on each machine |

---

## Branching & Deployment Strategy

- **Branch**: `main` (single-branch workflow for now)
- **Local dev**: `npm run dev` (Next.js Turbopack)
- **Production**: Vercel auto-deploys on push to `main` (if connected) or manually via `vercel --prod --yes`
- **Git commit convention**: Imperative mood, descriptive messages (e.g., `Fix: update Gemini model to gemini-2.0-flash`)
