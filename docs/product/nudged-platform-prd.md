# Nudged — Platform PRD & Architecture

**Status:** Live product, actively evolving
**Owner:** Vishwas Jayarama
**Source:** Derived from codebase (graphify knowledge graph: 540 nodes, 42 communities) + Supabase migration history, 2026-08-15
**Scope:** v1 reverse-engineered baseline for the whole existing product

---

## 1. Overview

Coaching outcomes depend on what happens *between* sessions — whether a coachee actually works their goals, resists distraction, and processes what came up in conversation. Most coaching tooling stops at scheduling and notes. Nudged extends the coach–coachee relationship into daily life: goal tracking, AI-guided reflection, and a focus-enforcement tool (**Return On**) that runs in the browser and on the desktop between sessions.

The platform serves two paying-relevant audiences at once — coaches, who run their practice and content through it, and coachees, who live in it daily — with a shared Supabase backend and three client surfaces (web, browser extension, Electron desktop).

## 2. Goals & Non-Goals

### Goals
- Give coaches a workspace to onboard coachees, package their methodology as reusable **capsules**, and run sessions with continuity (prior-session context feeds every new one).
- Give coachees a daily surface for goals, vision, parked thoughts, nudges, and rituals — not just a calendar entry once a week.
- Use AI (Claude) as a structured reflection partner — not a chatbot bolted on, but purpose-built agents (ED Agent, Thought Agent) that reason over the coachee's own vision, challenges, and history.
- Reduce digital distraction during committed focus time via Return On, synced across browser and desktop.

### Non-goals (current scope)
- Not a general-purpose habit tracker or calendar replacement — booking exists to support coaching, not to compete with scheduling tools.
- Not a multi-tenant enterprise LMS — capsules and coach branding are single-coach-owned, not org-hierarchical.
- Return On is a focus aid, not an enterprise device-management or content-filtering product.

## 3. Users & Roles

| Role | Who | Primary surface | Core need |
|---|---|---|---|
| **Coach** | Independent coach or practitioner running paid programs | Coach dashboard, admin, capsule/session master | Manage roster, package methodology, prep sessions fast |
| **Coachee** | Client enrolled with one coach | Coachee app, Return On extension/desktop | Progress goals, reflect, stay focused between sessions |
| **Admin** | Platform operator (hardcoded admin email) | Admin page | Approve coaches, monitor feedback, manage credits/exemptions |

## 4. Product Surface — Modules

Twelve functional modules span the three client surfaces. Grouping is derived from the codebase's own community structure, not an idealized roadmap.

| Module | Surface | What it does |
|---|---|---|
| Onboarding & Auth | Web | Login, password reset, welcome/splash, first-run tutorial |
| Coach Workspace | Web | Coach dashboard, profile & capsule config, coachee roster |
| Coachee Workspace | Web | Session dashboard, Talk / Summary / Parking tabs, rich-text notes editor |
| Goals & Thoughts | Web | Goal dashboard & summary, parked thoughts, bulk goal upload via OCR |
| Vision & Wise Advice `AI` | Web | Vision board editor, ED Agent deep-dive, floating Wise Advice chat |
| Session Intelligence `AI` | Web | Thought Agent — session analysis, Johari window, activity insights, capsule knowledge chatbot |
| Nudges, Rituals & Good News `AI` | Web | Habit nudges, daily ritual page, AI-generated good-news feed |
| Return On (De-Distract) | Web + Extension + Desktop | Timed focus sessions, allowed-site enforcement, deviation detection, cross-device sync |
| Booking & Marketplace | Web | Coach explorer, public booking calendar, session/capsule explorer |
| Feedback & Notifications | Web | In-app feedback widget, reaction toasts, notification bell |
| Tags & Profile | Web | Personal tags, schedules, profile settings |
| Admin | Web | Coach approval, feedback & login-event monitoring, credit requests, exempt emails |

## 5. User Journeys

### Coachee journey
1. **Invited & onboarded** — coach invites coachee; first-run tutorial introduces the app shell.
2. **Vision set** — coachee defines a vision, names challenges and blockers.
3. **ED Agent deep-dive** — AI surfaces emotional blocks, hidden beliefs, and a first recommended action from that vision data.
4. **Goals created** — manually, or in bulk via OCR upload from a photographed goal sheet.
5. **Daily loop** — nudges, rituals, and Return On focus sessions run between coaching sessions.
6. **Session with coach** — Talk / Summary / Parking tabs capture the live conversation; notes persist for next time.
7. **Reflection** — Wise Advice chat and the Good News feed give the coachee somewhere to process and stay encouraged solo.

### Coach journey
1. **Approved** — admin activates the coach account.
2. **Capsule built** — coach packages their methodology into a capsule — public or passkey-gated — with goals attached.
3. **Coachee assessed** — "Know Your Coachee" intake captures profession, family context, emotion tags, comfort with practices.
4. **Session prepped** — capsule knowledge and prior-session context are pulled automatically ahead of each session.
5. **Session run & noted** — live notes taken against the coachee record.
6. **Bookings managed** — public calendar accepts new bookings; confirmation email sent via edge function.

## 6. AI Capabilities

Every AI call routes through a single server-side proxy (`claude-llm` edge function) keyed by a `prompt_key` — no model key ever reaches the client.

| Capability | What it does |
|---|---|
| **ED Agent** | Reads vision, challenges, blockers, recent wise-advice messages, and parked thoughts to produce emotional blocks, hidden beliefs, a stuck point, and a first action — a structured deep-dive, not a chat reply. |
| **Thought Agent** | Analyzes session inputs into a Johari window, undercurrents, missing pieces, and word-cloud/weakness signals; separately scores activity insights over time. |
| **Wise Advice** | Floating, always-available chat grounded in the coachee's own vision — the day-to-day counterpart to the deeper ED Agent analysis. |
| **Capsule Knowledge Chatbot** | Per-capsule chatbot config lets a coach's session content answer coachee questions in the coach's own voice. |
| **Good News Feed** | Separate edge function (`generate-good-news`) generates uplifting content server-side on a schedule/refresh, independent of the per-user proxy. |
| **Bulk Goal OCR** | Not Claude — `tesseract.js` runs client-side to extract goal text from uploaded images before goals are created in bulk. |

## 7. Edge Cases & Risks

| Risk | Where | Why it matters |
|---|---|---|
| RLS correctness | Supabase policies | Migration history shows repeated recursion and access fixes for coach/coachee row access — the highest-churn area of the schema and the one most likely to leak or block data. |
| Cross-device session state | Return On (extension + desktop) | Focus sessions sync via a 30s Supabase poll rather than realtime — a session started on desktop can lag or double-fire on the browser. |
| False-positive deviation | Extension background worker | Allowed "desktop app" domains are hardcoded (Teams, Slack, Zoom, Meet); switching to an unlisted legitimate tool triggers a distraction alert. |
| LLM proxy failure | All AI features | `callLLM()` throws on any non-OK response; every AI surface needs its own loading/error handling since a single shared proxy fronts them all. |
| OCR accuracy | Bulk goal upload | Client-side `tesseract.js` with no server-side fallback — poor photo quality silently produces bad goal text. |
| Passkey-gated capsules | Coach capsule config | Public capsules can be passkey-protected; passkey handling needs the same scrutiny as any shared-secret gate. |
| Hardcoded admin identity | `ADMIN_EMAIL` constant | Platform-admin access is a single hardcoded email rather than a role table — a single point of failure for admin access control. |

## 8. Success Metrics

| Dimension | Signal |
|---|---|
| Activation | % new coachees completing vision + first goal within 7 days |
| Engagement | Weekly Return On focus sessions per active coachee; nudge/ritual completion rate |
| AI adoption | % sessions with Wise Advice or ED Agent used; Thought Agent analyses per session |
| Coach efficiency | Avg. session prep time; capsule reuse across coachees |
| Retention | Coach and coachee 30/90-day retention; booking rebook rate |
| Quality signal | Feedback-widget sentiment; support/credit-request volume |

## 9. Architecture

System architecture, the AI request flow, key data entities, and the tech stack now live in a dedicated doc: **[Nudged — System Architecture](../architecture/nudged-architecture.md)**.

---

*Compiled from the Nudged codebase (graphify knowledge graph: 540 nodes, 42 communities) and the Supabase migration history. Treat as a living baseline — re-derive after major feature work rather than hand-editing.*
