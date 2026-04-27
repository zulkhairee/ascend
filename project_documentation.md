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

## Current File Structure

```
ascend-web/
├── src/
│   ├── app/
│   │   ├── page.js          # Main server component: data fetching, harmonization, JSX layout
│   │   ├── layout.js        # Root layout with Inter font
│   │   └── globals.css      # Full design system + component styles
│   └── components/
│       └── MuscleMap.js     # Client component for react-body-highlighter SVG models
├── public/
│   └── ascend_logo.png      # App logo (header)
└── .env.local               # API keys (not committed)
```

---

## Environment Variables Required

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_ACCESS_TOKEN=
STRAVA_REFRESH_TOKEN=
LYFTA_API_KEY=
```

---

## Known Limitations & Future Roadmap

| 🔴 High | Auto token refresh | Strava access tokens expire every 6 hours; need a server-side refresh cron or middleware |
| 🔴 High | Strava rate limiting | Fetching `DetailedActivity` per workout will hit limits as history grows; implement file-based or Redis cache |
| 🟡 Medium | Nutrition data | Currently mocked; integrate MyFitnessPal or FatSecret API |
| 🟡 Medium | Greeting time-awareness | "Good Morning" should dynamically change to "Good Afternoon/Evening" based on local time |
| 🟡 Medium | More workouts | Currently shows top 3 only; add pagination or a "Load More" button |
| 🟢 Low | Webhooks | Replace polling with Strava/Lyfta webhook push notifications for real-time updates |
| 🟢 Low | Historical analytics | Weekly/monthly volume charts using Recharts or Chart.js |

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
