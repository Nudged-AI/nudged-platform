# Graph Report - src  (2026-08-15)

## Corpus Check
- 70 files · ~117,587 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 1076 edges · 42 communities (38 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Session Dashboard & Notes
- App Shell & Routing
- Content Script & Extension
- Notes Editor & Rich Text
- Goal & Thought Management
- Coach Profile & Config
- Background Session Manager
- Session Completion Flow
- Feedback & Parked Thoughts
- Coach Dashboard & Onboarding
- De-Distract Wellbeing
- Goal Dashboard & Progress
- Auth & Landing Pages
- Nudges & Habit Content
- AI Wise Advice Agent
- Good News Feed
- Coach Onboarding & Admin
- Tags & Profile
- Vision Board Editor
- Session & Capsule Explorer
- Vision Board & Medals
- Wise Advice & Gratitude UI
- Booking & Scheduling
- Goal Summary
- Tutorial & Onboarding
- Bulk Goal Upload
- Coach Explorer UI
- Exploration Form
- Coachee Assessment Form
- Daily Ritual Page
- Settings & Preferences
- New Session Setup
- Active Session Timer
- User Onboarding
- Session Active View
- Spirit Animal Selection
- Session History
- Core Types
- Welcome Screen
- Entry Page
- Welcome Page

## God Nodes (most connected - your core abstractions)
1. `supabase` - 52 edges
2. `callLLM()` - 50 edges
3. `parseJSON()` - 44 edges
4. `UserProfile` - 23 edges
5. `SessionDashboard()` - 14 edges
6. `stripMarkdown()` - 13 edges
7. `getTagColor()` - 13 edges
8. `formatDate()` - 12 edges
9. `extractFileText()` - 12 edges
10. `InfoButton()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `UserProfile`  [EXTRACTED]
  pages/GoodNewsPage.tsx → supabase.ts
- `Props` --references--> `UserProfile`  [EXTRACTED]
  pages/ParkedThoughtsPage.tsx → supabase.ts
- `Props` --references--> `UserProfile`  [EXTRACTED]
  pages/RitualPage.tsx → supabase.ts
- `Props` --references--> `UserProfile`  [EXTRACTED]
  pages/VisionBoardViewPage.tsx → supabase.ts
- `Props` --references--> `UserProfile`  [EXTRACTED]
  components/AppShell.tsx → supabase.ts

## Import Cycles
- None detected.

## Communities (42 total, 4 thin omitted)

### Community 0 - "Session Dashboard & Notes"
Cohesion: 0.07
Nodes (46): NotesEditorModal(), ACTIVITY_LABELS, Props, SessionDashboard(), getCapsuleKnowledge(), getChatbotConfig(), getPreviousSessionsContext(), knowledgeBgForIndex() (+38 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.06
Nodes (33): App(), AppState, ensureDefaultThreads(), AppMode, AppSelection(), Props, ANIMAL_IMAGES, AppShell() (+25 more)

### Community 2 - "Content Script & Extension"
Cohesion: 0.12
Nodes (33): addWidgetMessage(), createStyles(), DESKTOP_APP_DOMAINS, ensureStyles(), ensureWidget(), formatTimer(), getTotalExtended(), handleAddSite() (+25 more)

### Community 3 - "Notes Editor & Rich Text"
Cohesion: 0.12
Nodes (24): Chapter, MANDATORY_CHAPTERS, OPTIONAL_CHAPTERS, Props, stripHtmlTags(), UploadedFile, HIGHLIGHT_STYLES, HighlightColor (+16 more)

### Community 4 - "Goal & Thought Management"
Cohesion: 0.12
Nodes (20): DAYS, GoalThoughtList(), ParkedItem, Props, Schedule, getTagColor(), AddThreadModal(), ChipEditor() (+12 more)

### Community 5 - "Coach Profile & Config"
Cohesion: 0.14
Nodes (15): CoachProfileSection(), Props, ADMIN_EMAIL, CATEGORY_OPTIONS, ChatbotConfig, Coachee, CoachProfile, EMOTION_TAGS (+7 more)

### Community 6 - "Background Session Manager"
Cohesion: 0.19
Nodes (17): broadcastToTabs(), checkSessionExpiry(), clearDeviationTimer(), DESKTOP_APP_DOMAINS, DeviationState, endSession(), findBestAllowedTab(), hasActiveDesktopAppTab() (+9 more)

### Community 7 - "Session Completion Flow"
Cohesion: 0.15
Nodes (12): CompletedSession(), Props, StoredSession, DeclarationForm(), DURATION_OPTIONS, Props, StoredSession, TOLERANCE_OPTIONS (+4 more)

### Community 8 - "Feedback & Parked Thoughts"
Cohesion: 0.15
Nodes (14): FEATURES, FeedbackWidget(), Props, ReactionProps, ReactionToast(), DAYS, extractReminderFromText(), Goal (+6 more)

### Community 9 - "Coach Dashboard & Onboarding"
Cohesion: 0.15
Nodes (8): buildSessionUid(), CapsuleMaster(), istLocalToISO(), Props, SessionEditor(), SessionMaster(), SubTab, toLocalDT()

### Community 10 - "De-Distract Wellbeing"
Cohesion: 0.14
Nodes (14): ADVICE_BACKDROPS, AFFIRMATIONS, ANIMAL_IMAGES, ANIMAL_TRAITS, buildSlides(), DeDistractPage(), Goal, GRADIENT_PALETTES (+6 more)

### Community 11 - "Goal Dashboard & Progress"
Cohesion: 0.18
Nodes (13): daysAgo(), daysUntil(), DEFAULT_MILESTONES, getProgressColor(), getProgressTextColor(), Goal, GoalDashboard(), JohariData (+5 more)

### Community 12 - "Auth & Landing Pages"
Cohesion: 0.18
Nodes (7): Props, SessionRow, Props, TILES, supabase, supabaseAnonKey, supabaseUrl

### Community 13 - "Nudges & Habit Content"
Cohesion: 0.18
Nodes (13): CATEGORY_QUOTES, CATEGORY_STORY_IMAGES, getQuoteForHabit(), getStoryImage(), getThemeImage(), GRATITUDE_NATURE_IMAGES, Habit, NewsItem (+5 more)

### Community 14 - "AI Wise Advice Agent"
Cohesion: 0.18
Nodes (11): FRIEND_OPENERS, Mode, Props, Vision, WiseMessage, EDAgentResult, Props, Props (+3 more)

### Community 15 - "Good News Feed"
Cohesion: 0.17
Nodes (10): getStoryThumb(), GoodNewsPage(), NEWS_SECTION_IMAGES, NewsItem, PEXELS_STORY_IMAGES, Props, SECTION_COLORS, Story (+2 more)

### Community 16 - "Coach Onboarding & Admin"
Cohesion: 0.18
Nodes (10): CoachOnboardingSection(), Props, AdminPage(), AppFeedback, CreditRequest, ExemptEmail, LoginEvent, Props (+2 more)

### Community 17 - "Tags & Profile"
Cohesion: 0.18
Nodes (9): CUSTOM_PALETTE, DEFAULT_TAGS, FIXED_COLORS, ANIMALS, empty, Profile, ProfilePage(), Props (+1 more)

### Community 18 - "Vision Board Editor"
Cohesion: 0.17
Nodes (8): BlockerRow, CAT_COLORS, ChallengeRow, FITBBlank, FITBResponse, FOR_WHOM_OPTIONS, RoadmapStep, VisionRow

### Community 19 - "Session & Capsule Explorer"
Cohesion: 0.20
Nodes (10): CoachExplorer(), formatDate(), STOCK_IMAGES, CapsuleDetail(), SessionDetail(), SessionList(), SessionViewer(), MarketplacePage() (+2 more)

### Community 20 - "Vision Board & Medals"
Cohesion: 0.22
Nodes (9): EarnMedal(), getThemeImage(), MILESTONE_IMAGES, Props, RoadmapStep, THEME_IMAGES, Vision, VisionBoardViewPage() (+1 more)

### Community 21 - "Wise Advice & Gratitude UI"
Cohesion: 0.28
Nodes (9): WiseAdviceFloat(), callEDAgent(), parseJSON(), GoodNewsSection(), GratitudeCorner(), FITBSection(), Step2(), Step3() (+1 more)

### Community 22 - "Booking & Scheduling"
Cohesion: 0.29
Nodes (7): AvailabilitySlot, Booking, Bookings(), Capsule, Coach, DAYS, fmtDate()

### Community 23 - "Goal Summary"
Cohesion: 0.25
Nodes (7): DAYS, Goal, GoalSummary(), PRESETS, Props, SavedSummary, SummarySchedule

### Community 24 - "Tutorial & Onboarding"
Cohesion: 0.39
Nodes (7): isDone(), markDone(), TUTORIAL_CONTENT, TutorialBanner(), TutorialKey, TutorialTooltip(), TutorialTooltipProps

### Community 25 - "Bulk Goal Upload"
Cohesion: 0.29
Nodes (6): InfoButton(), BulkUploadPage(), Goal, newRow(), Props, Row

### Community 26 - "Coach Explorer UI"
Cohesion: 0.43
Nodes (6): CapsuleWithCoach, Props, SessionWithCoach, Capsule, Coach, CoachingSession

### Community 27 - "Exploration Form"
Cohesion: 0.29
Nodes (5): ANIMAL_IMAGES, EMOTION_IMAGES, ExplorationFormTab(), Props, YEARNS_IMAGES

### Community 28 - "Coachee Assessment Form"
Cohesion: 0.29
Nodes (6): Coach, DEFAULT_FIELDS, FIELD_TYPES, FormVersion, KnowYourCoachee(), Response

### Community 29 - "Daily Ritual Page"
Cohesion: 0.29
Nodes (6): AFFIRMATION_COLORS, AFFIRMATION_ICONS, GRATITUDE_COLORS, GRATITUDE_ICONS, Props, RitualPage()

### Community 30 - "Settings & Preferences"
Cohesion: 0.40
Nodes (5): resetAllTutorials(), DEFAULT_SETTINGS, Props, SettingsPage(), UserSettings

### Community 31 - "New Session Setup"
Cohesion: 0.33
Nodes (4): DESKTOP_APPS, DURATION_OPTIONS, Props, TOLERANCE_OPTIONS

### Community 32 - "Active Session Timer"
Cohesion: 0.50
Nodes (4): ActiveSession(), Props, StoredSession, useCountdown()

### Community 33 - "User Onboarding"
Cohesion: 0.40
Nodes (3): ProfileData, Props, stepIllustrations

### Community 34 - "Session Active View"
Cohesion: 0.50
Nodes (4): ActiveSessionData, Props, SessionActivePage(), useCountdown()

### Community 35 - "Spirit Animal Selection"
Cohesion: 0.40
Nodes (3): ANIMALS, Props, PURPOSES

### Community 37 - "Core Types"
Cohesion: 0.67
Nodes (3): MessageType, Session, StoredSession

## Knowledge Gaps
- **208 isolated node(s):** `AppState`, `StoredSession`, `StoredSession`, `DeviationState`, `DESKTOP_APP_DOMAINS` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `Auth & Landing Pages` to `Session Dashboard & Notes`, `App Shell & Routing`, `Notes Editor & Rich Text`, `Goal & Thought Management`, `Coach Profile & Config`, `Session Completion Flow`, `Feedback & Parked Thoughts`, `Coach Dashboard & Onboarding`, `De-Distract Wellbeing`, `Goal Dashboard & Progress`, `Nudges & Habit Content`, `AI Wise Advice Agent`, `Good News Feed`, `Coach Onboarding & Admin`, `Tags & Profile`, `Vision Board Editor`, `Session & Capsule Explorer`, `Vision Board & Medals`, `Booking & Scheduling`, `Goal Summary`, `Bulk Goal Upload`, `Coach Explorer UI`, `Exploration Form`, `Coachee Assessment Form`, `Daily Ritual Page`, `Settings & Preferences`, `New Session Setup`, `User Onboarding`, `Session Active View`, `Spirit Animal Selection`, `Session History`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **Why does `callLLM()` connect `Session Dashboard & Notes` to `Notes Editor & Rich Text`, `Goal & Thought Management`, `Coach Profile & Config`, `Feedback & Parked Thoughts`, `Coach Dashboard & Onboarding`, `De-Distract Wellbeing`, `Goal Dashboard & Progress`, `Nudges & Habit Content`, `AI Wise Advice Agent`, `Vision Board Editor`, `Vision Board & Medals`, `Wise Advice & Gratitude UI`, `Goal Summary`, `Bulk Goal Upload`, `Coachee Assessment Form`, `Daily Ritual Page`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `parseJSON()` connect `Wise Advice & Gratitude UI` to `Session Dashboard & Notes`, `Notes Editor & Rich Text`, `Goal & Thought Management`, `Feedback & Parked Thoughts`, `Coach Dashboard & Onboarding`, `De-Distract Wellbeing`, `Goal Dashboard & Progress`, `Nudges & Habit Content`, `AI Wise Advice Agent`, `Vision Board Editor`, `Vision Board & Medals`, `Goal Summary`, `Bulk Goal Upload`, `Daily Ritual Page`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `AppState`, `StoredSession`, `StoredSession` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session Dashboard & Notes` be split into smaller, more focused modules?**
  _Cohesion score 0.06892230576441102 - nodes in this community are weakly interconnected._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.05893719806763285 - nodes in this community are weakly interconnected._
- **Should `Content Script & Extension` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._