# Project Ascend: Development Journal & Roadmap

This document serves as a comprehensive record of the steps taken to design and build the "Ascend" fitness tracking application, as well as a living roadmap of technical progress and future work.

This guide is written specifically with a Data Analyst in mind—bridging the gap between data logic and software development concepts.

---

## Session 1: The Visual Mock-up (HTML/CSS Prototype)
*April 26, 2026 • 05:54*

**Goal:** Figure out exactly what the app should *look* and *feel* like before writing any complex logic.

### What We Built
- A single-page mobile app prototype using HTML & CSS, simulating a 414×896px iPhone screen.
- **Daily Nutrition Dashboard**: A macro ring chart (Protein, Carbs, Fat) with a net calorie balance display.
- **Workout Cards**: Unified cards that display both Lyfta strength data (volume, exercises) and Strava/Garmin cardio data (distance, time, HR, calories).
- **Muscle Heatmap**: Iterated through abstract shapes → detailed anatomical PNG → final SVG-based dynamic heatmap.
- **AI Coach Commentary**: A static insights block at the bottom.

### Design System (CSS Variables)
```css
--bg-primary: #FFFFFF
--text-primary: #1F2937  /* Charcoal */
--text-secondary: #64748B /* Slate Gray */
--accent-teal: #14B8A6
--accent-navy: #1E3A8A
```

---

## Session 2: The Migration to Next.js (Live Data App)
*April 26, 2026 • 18:00*

**Goal:** Convert the static HTML mock-up into a fully dynamic Next.js web application pulling real data from Strava and Lyfta.

### Architecture
- **Framework**: Next.js 15 (App Router), running locally on `http://localhost:3000`
- **Rendering Strategy**: Server-side async data fetching in `page.js` — no client-side loading spinners
- **Environment**: Secrets stored in `.env.local` (never committed to version control)

### API Integrations Built

#### Strava
- **Scope**: `activity:read_all` (required manual re-auth via OAuth flow)
- **Two-hop Fetch**: The summary list endpoint omits precise calories, so we fetch each `DetailedActivity` individually via `GET /activities/:id`
- **Token Management**: Access + refresh tokens stored in `.env.local`; manual refresh required when token expires

#### Lyfta
- **Endpoint**: `GET https://my.lyfta.app/api/v1/workouts`
- **Auth**: Bearer token in `Authorization` header
- **Data available**: workout title, date, total volume (kg), exercises array with sets/reps/weight

### Harmonization Engine
The key logic in `getWorkouts()`:
1. Fetch Lyfta workouts → map to unified format
2. Fetch Strava activities (summary + detailed)
3. **Match by date string**: If a Lyfta workout and a Strava strength workout share the same calendar day → enrich Lyfta record with Strava's `calories`, `duration`, `heartRate`
4. Deduplicate: Strava strength workouts already merged into Lyfta are excluded from the final list
5. Sort newest-first, return top 3

---

## Session 3: Dynamic Muscle Maps & Workout Log Expansion
*April 26, 2026 • 20:30*

**Goal:** Replace static PNG heatmaps with real, data-driven SVG muscle maps, and add an expandable workout log for Lyfta sessions.

### react-body-highlighter Integration
- **Library**: `react-body-highlighter` (npm)
- **Component**: `src/components/MuscleMap.js` — a client component (`'use client'`)
- **Rendering**: Both **anterior** (front) and **posterior** (back) models rendered side-by-side for every strength workout
- **Color Scale**: Teal gradient `#5eead4 → #14b8a6 → #0d9488 → #0f766e → #1e3a8a` based on set count (intensity)
- **Unworked body**: `#CBD5E1` (Slate-300) for visible contrast without being harsh

### Muscle Parsing Logic (`parseLyftaMuscles`)
Maps Lyfta's `exercise_image` URL substrings to muscle groups:
| URL contains | Muscles assigned |
|---|---|
| `_Chest` | `chest` |
| `_Upper-Arms` | `biceps`, `triceps` |
| `_Back` | `upper-back` |
| `_Shoulders` | `front-deltoids`, `back-deltoids` |
| `_Thighs` | `quadriceps`, `hamstring` |
| `_Hips` | `gluteal` |
| `_Waist` | `abs`, `obliques` |

**Intensity** = number of sets performed for that exercise (frequency per muscle group).

### Expandable Workout Log (Lyfta)
- Uses native HTML `<details>/<summary>` element — no JavaScript required
- Renders each exercise with a condensed flexbox table: Set # | Weight | Reps
- Inline expansion styling: transparent background, dashed border-top, small typography (11–12px) so it reads as an extension of the card, not a new panel
- Weight values formatted with `parseFloat()` to strip trailing zeros (e.g., `30.000 kg` → `30 kg`)

### Expandable Run Details (Strava)
- Same `<details>/<summary>` pattern for cardio workout cards
- Displays a 2-column grid of additional metrics:
  - **Pace** (calculated from `average_speed` in m/s → min:sec /km)
  - **Elevation Gain** (m)
  - **Max Heart Rate** (bpm)
  - **Cadence** (spm — Strava reports half-cadence so we multiply × 2)
  - **Power** (W, shown only if `average_watts > 0`)

---

## Session 4: Final Polish & Production Deployment
*April 26, 2026 • 22:23*

**Goal:** Refine the visual hierarchy, establish brand identity, and move the app from a local machine to a permanent public URL.

### UI & UX Refinements
- **Hierarchy Overhaul**: Reduced font sizes and weights in the expandable workout logs (13px → 11px) to ensure the main workout stats remain the visual focus.
- **Muscle Map Contrast**: Darkened the unworked silhouette color from white (`#F8FAFC`) to Slate-300 (`#CBD5E1`). This creates a visible "body" for the Teal/Navy heatmap to sit on, making the worked muscles pop without being jarring.
- **Brand Identity**: 
  - Replaced the generic Lucide triangle icon with the official **Ascend Logo PNG**.
  - Wrapped the logo in a strictly constrained 28x28px container to prevent high-res image blowouts.
  - Personalized the interface by updating the greeting to **"Good Morning, Zul."**

### Remote Access & Deployment
- **Local Tunnel (ngrok)**: Configured `ngrok` to allow temporary external access to the local development server for quick mobile testing.
- **Production Deployment (Vercel)**:
  - Migrated the codebase to a permanent cloud home at **[ascend-web-mocha.vercel.app](https://ascend-web-mocha.vercel.app)**.
  - Configured Vercel production environment variables for Strava and Lyfta authentication.
  - Executed a production build and deployment flow from the local CLI.

### How to Update the Live App
To push new changes to the live production URL, run this command from the `ascend-web` directory:
```bash
vercel --prod --yes
```

### Session 4 Deliverables
- [x] Corrected user greeting and brand logo.
- [x] Optimized "inline" expandable log layout.
- [x] Increased muscle map silhouette contrast.
- [x] Deployed live production URL on Vercel.
- [x] Documented full development journey in `ascend-web/project_documentation.md`.

---

## Session 5: Git Workflow, Cross-Device Credentials & AI Performance Insights
*April 27, 2026 • 21:00*

**Goal:** Establish a professional development workflow with version control, enable seamless work across personal and work laptops, and transform the static AI Insights section into a real, data-driven coaching experience.

### Git & GitHub Setup
- Initialized a remote GitHub repository at **[github.com/zulkhairee/ascend](https://github.com/zulkhairee/ascend)**.
- Set up SSH key authentication on the local machine (`~/.ssh/id_ed25519`) to avoid HTTPS token prompts.
- Established a clean commit history covering all prior sessions.

### Cross-Device Credential System
The `.env.local` file is intentionally excluded from GitHub (via `.gitignore`). To allow easy machine-to-machine transfer of API keys without risking public exposure, a two-part system was built:

**`CREDENTIALS_BACKUP.md`** (local-only, also in `.gitignore`):
A human-readable markdown file containing all API keys. To use the app on a new machine, simply drag-and-drop this file into the project root. It is never committed to git.

**`src/lib/env.js`** — Smart Credential Loader:
A utility function `getEnv(key)` that:
1. First checks `process.env` (standard `.env.local` via Next.js)
2. If missing, falls back to parsing `CREDENTIALS_BACKUP.md` using regex
3. This means the app works on any machine where either file is present

```js
// Usage in server components / API routes
import { getEnv } from '../lib/env';
const token = getEnv('STRAVA_ACCESS_TOKEN');
```

### Strava Token Fix
Strava access tokens expire every **6 hours**. The token in `.env.local` was stale, causing the Strava data to silently fail. Fixed by:
1. Using the `STRAVA_REFRESH_TOKEN` to call `POST /oauth/token` and obtain a fresh access token.
2. Updating `.env.local` and `CREDENTIALS_BACKUP.md` with the new token.

> **Future work**: Automate this refresh using a Next.js middleware or scheduled cron.

### AI Performance Insights — Architecture Evolution

The AI Insights section went through three design iterations:

#### Iteration 1: Blocking Server-Side Call (Removed)
- Gemini API was called directly inside the `Home` server component.
- **Problem**: The entire page blocked until Gemini responded (~5–10 seconds of blank screen).

#### Iteration 2: Async API Route + Client-Side Fetch
- Created `src/app/api/insights/route.js` — a dedicated Next.js Route Handler.
- Created `src/components/InsightsPanel.js` — a `'use client'` component that fetches from the API route on mount.
- **Result**: Page renders instantly; the Insights section shows an animated shimmer skeleton, then swaps in the AI text when ready.
- Added CSS `@keyframes shimmer` skeleton loader for a premium loading experience.

#### Iteration 3: Antigravity-Assisted Static Insights (Current)
- **Problem**: Gemini API free tier quota was exhausted; `gemini-1.5-flash` model name was also deprecated.
- **Solution**: Replace live API calls with a static `src/data/ai_insight.json` file.
- The workflow:
  1. On request, Antigravity fetches the latest Strava and Lyfta data live.
  2. Antigravity analyzes the data and generates a coaching insight.
  3. The insight is written to `ai_insight.json` and committed to GitHub.
  4. The API route simply reads and serves this static file — near-zero latency, no external dependency.

**Current insight (as of Apr 27, 2026):**
> *"Your strength is trending upward — your Arms session on Apr 23 hit 5,665 kg total volume, up 15.6% from your Apr 15 session at 4,892 kg. On the cardio side, both your 7 km run and 11.72 km trail run averaged over 175 bpm — consider adding a Zone 2 easy run this week. Consistency is your strongest asset right now; just make sure you're getting enough sleep to let it all compound."*

### Session 6: The Strategic Pivot — Garmin as Primary Source
*April 29, 2026 • 23:55*

**Goal:** Upgrade the cardio data layer by making Garmin Connect the primary "Source of Truth," while retaining Strava as a resilient fallback.

### Why Garmin?
While Strava is excellent for social sharing and basic GPS tracking, it lacks the deep physiological metrics provided by Garmin's ecosystem:
- **Recovery Time**: Knowing exactly how many hours to rest between sessions.
- **Training Effect**: Understanding if a run was Aerobic or Anaerobic.
- **Health Snapshots**: Incorporating Resting HR and Stress into AI coaching.

### The Multi-Provider Architecture
To avoid data duplication (since Garmin usually syncs *to* Strava), the app's harmonization engine will be updated to follow a **Priority Hierarchy**:
1. **Garmin (Primary)**: If Garmin data exists for a specific time, use it for all metrics.
2. **Strava (Fallback)**: If Garmin is unavailable (e.g., user forgot their watch but logged via phone), use Strava.
3. **Deduplication**: Match by activity start time (timestamp). If `Garmin.time == Strava.time`, discard the Strava entry.

### Technical Implementation Requirements
- **Authentication**: Switch from OAuth (Strava) to Credential-based login (Garmin) via `.env.local`.
- **Mapping**: Normalize Garmin's "Activity" JSON into our unified `Workout` schema.

---

### Session 7: Technical Audit & Multi-Device Governance
*April 30, 2026 • 00:05*

**Goal:** Secure the project's longevity through a rigorous technical audit and establish safe working protocols for multi-device development.

### The Omni-Audit
Performed a comprehensive review of the codebase, resulting in `TECHNICAL_AUDIT.md`:
- **Risk ID**: Identified the 6-hour Strava OAuth window as a "P0" failure point.
- **Architecture**: Flagged "Network Boundary" inefficiencies where AI insights were fetched client-side redundantly.
- **Scalability**: Noted the "N+1" fetch problem in Strava detailed activity retrieval.

### Multi-Device Sync Protocol
Established a governance system in `AGENTS.md` to manage work across personal and work laptops:
- **Hostname-based Identity**: Personal laptop (`Zulkhairees-MacBook-Air.local`) is the primary source of truth.
- **Push Restrictions**: AI is prohibited from auto-pushing on work machines without explicit consent.
- **Commit Receipts**: All work-machine commits must be tagged `[Work-Machine]` for traceability.

---

### Updated File Structure
```
ascend-web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── insights/
│   │   │       └── route.js      # Serves AI insight from static JSON
│   │   ├── page.js               # Main server component (data fetching + layout)
│   │   └── ...
├── public/
│   └── ascend_logo.png
├── AGENTS.md                     # AI instructions & Multi-device Git Policy
├── TECHNICAL_AUDIT.md            # Deep-dive risk & architecture analysis
├── CREDENTIALS_BACKUP.md         # Local-only API key backup (gitignored)
├── implementation_plan.md        # Living technical roadmap
└── .env.local                    # API keys (gitignored)
```

---

## Environment Variables Required

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_ACCESS_TOKEN=
STRAVA_REFRESH_TOKEN=
LYFTA_API_KEY=
GEMINI_API_KEY=          # Optional — only needed if switching back to live Gemini API
```

All keys can be supplied via `.env.local` or `CREDENTIALS_BACKUP.md` (drag-and-drop to project root on new machine).

---

## Known Limitations & Future Roadmap

| Priority | Item | Notes |
|---|---|---|
| 🔴 High | Auto token refresh | Strava tokens expire every 6 hours; implement middleware to call refresh endpoint automatically |
| 🔴 High | Strava rate limiting | DetailedActivity fetch per workout will hit limits as history grows; add file-based or Redis cache |
| 🟡 Medium | AI Insights automation | Currently manual; consider scheduling a daily GitHub Action to fetch data and regenerate `ai_insight.json` |
| 🟡 Medium | Nutrition data | Currently mocked; integrate MyFitnessPal, Cronometer, or FatSecret API |
| 🟡 Medium | Greeting time-awareness | "Good Morning" should dynamically change based on local time |
| 🟡 Medium | More workouts | Currently shows top 3 only; add pagination or "Load More" |
| 🟡 Medium | Nutrition × AI integration | Future: AI insights will also incorporate daily food intake and macro adherence |
| 🟢 Low | Webhooks | Replace polling with Strava/Lyfta webhook push notifications |
| 🟢 Low | Historical analytics | Weekly/monthly volume charts using Recharts or Chart.js |
| 🟢 Low | Zone 2 vs threshold tagging | Auto-classify runs by HR zone for more specific coaching |
