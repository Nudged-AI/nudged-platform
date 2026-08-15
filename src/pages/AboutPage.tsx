import { useState } from 'react';
import { Info, Clock } from 'lucide-react';

type Tab = 'about' | 'releases';

const RELEASES = [
  {
    version: '2.0.0',
    date: '2026-07-10',
    label: 'Summary Scheduling, Listen In, Rich Text & Tag Catalogue',
    changes: [
      'Summary scheduling — schedule recurring AI summaries for any thread; choose tags to filter by, write a custom AI prompt, and pick a time; summaries appear in the Summary tab grouped by date',
      'Listen In — bulk upload now captures spoken thoughts via voice; AI transcribes and splits them into rows with threads and tags; auto-stops after 5 min of silence; drafts persist across sessions',
      'Rich text formatting — bold, italic, and underline buttons above the thought input; AI also auto-bolds main topics and underlines key terms when predicting',
      'Tag Catalogue in Profile — view, add, and delete all custom tags across threads; deleted tags disappear from search and new thoughts but existing thoughts keep their tags',
      'Default tags redesign — threads now have min 1 max 3 default tags instead of 20 active tags; default tags auto-apply to new thoughts when a thread is selected',
      'Only park image — removed "Save image" checkbox; new "Only park image" button predicts the thread and parks the image without requiring text or tags',
      'Improved reminder detection — AI now detects implicit deadlines (e.g. "I need to complete this by next week") and suggests a reminder even if not explicitly requested',
      'Edit thread popup fixed — the edit thread popup is now a centered modal, no longer hidden behind the form',
      'Tag auto-prediction fixed — tags now correctly predict automatically when a thought is parked',
      'Improved tag display — tags shown in alphabetical order with selected tags in a separate highlighted section for cleaner UX',
      'Bulk upload milestone column removed — no more milestone tab in bulk upload; prompt updated accordingly',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-07-09',
    label: 'Thread Chips, 2-Screen Parking, One-Time Reminders & More',
    changes: [
      'New thread UI — threads now appear as a horizontal scrollable chip row at the top instead of a sidebar; tap any chip to filter thoughts to that thread',
      'All-thoughts view — selecting no specific thread shows thoughts across all threads; Dashboard and Summary are only accessible when a specific thread is selected',
      'Max threads increased from 5 to 10 (excluding General)',
      '2-screen parking flow — Screen 1 captures your thought with a prominent voice button; Screen 2 (shown after AI prediction) handles thread linking and tags',
      'One-time reminder — alongside daily/weekly/monthly, you can now set a reminder for a specific date and time',
      'Reminder detection — saying "remind me at 6am tomorrow" in your thought is detected by AI; the reminder hint is extracted and pre-fills the one-time reminder form',
      'Thought card redesign — content now spans the full card width with actions in a compact bottom bar, eliminating wasted space on mobile',
      'Thread-specific tags — each thread has its own active tag set (up to 20); custom tags added for one thread stay scoped to that thread',
      'Tag filtering — search only shows tags that have at least one thought in the current view',
      'De-distract refresh — reduced to 2 animal slides per batch; thread slides now display with Pexels stock image backgrounds instead of gradients',
    ],
  },
  {
    date: '2026-07-08',
    label: 'Feed Persistence, Bug Fixes & Info Buttons Everywhere',
    changes: [
      'De-distract feed now persists — generated slides are stored in the database; opening De-distract shows all your accumulated slides and only generates new ones as you scroll further',
      'Multi-thread save fixed — thoughts parked to multiple threads now correctly appear in every selected thread, not just the first one',
      'Double prediction bug fixed — typing a thought with embedded instructions no longer triggers two AI predictions; only one clean prediction fires',
      'Info (i) buttons added to every major feature across the app — tap any i icon next to a feature for a 2-line explanation of what it does',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-07-08',
    label: 'Vent Out, Image Gallery, De-distract Reels & More',
    changes: [
      'Image save checkbox — uploaded images are only added to the gallery if you explicitly tick "Save to image gallery" when parking a thought',
      'Image gallery delete — hover over any image in the thread dashboard to reveal a delete button',
      'Park button added to All Threads view — opens Park page without pre-selecting a thread',
      'De-distract now generates 15 slides: 4 spirit-animal, up to 6 thread ideas, 1 quote, and 4 AI news insights on a stock image backdrop',
      'De-distract infinite scroll — new batches of 15 slides append automatically as you scroll, creating an Instagram-reel feel',
      'Vent Out option when parking — vent freely via text or voice; stored privately, never shown, informs future coaching',
      'Info (i) buttons on key features — tap the i icon next to Summarise, Confess, and Vent to read a 2-line explanation',
      'Tutorial updated — new banners for Summarise, Vent/Confess, Save Image, Bulk Upload, and De-distract features',
    ],
  },
  {
    version: '1.7.3',
    date: '2026-07-08',
    label: 'Enhanced Summary Format',
    changes: [
      'Summarise output redesigned into 4 structured sections: Objective, Summary (up to 5 bullets), Next Steps (explicit from thoughts or Nudged perspective), and Nudged Suggestion (up to 3 growth-coaching ideas the user may not have considered)',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-07-08',
    label: 'Collapsible Threads Panel',
    changes: [
      'My Threads sidebar can now be collapsed to icon-only view — click the panel toggle button in the header to collapse or expand; thread icons remain clickable while collapsed',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-07-08',
    label: 'UX Polish Update',
    changes: [
      'Summarise moved to All thoughts tab — appears as a bulk action when one or more thoughts are selected via checkbox',
      'Highlight scroll fix — screen now stays anchored on the thought that was highlighted, not the top of the list',
      'Edit default tags for existing threads — pencil icon in thread detail to toggle or update default tags any time',
      'De-distract redesigned to vertical scroll — just scroll down through all slides with no Next button required',
      'De-distract animal images fixed — all 4 animal slides now show only the user\'s selected spirit animal; 10-image pool rotates on each refresh',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-07-08',
    label: 'Threads & Smart Parking Update',
    changes: [
      'Goals renamed to Threads throughout the UI with new icon',
      'All thread auto-created — see all thoughts across threads in one view; All Dashboard shows last 3 thoughts per thread + metrics',
      'Milestone removed from UI — AI auto-assigns on submit; no milestone filter shown',
      'Multi-thread tagging — link a thought to more than one thread on creation',
      'Per-thread filter isolation — filters selected in one thread stay local to that thread',
      'Highlight scroll focus — screen stays on the highlighted thought, not the top',
      'Reminder filter — filter thoughts that have active reminder schedules',
      'Alphabetical tag order — tags sorted A→Z in all views',
      'AI natural language search — find thoughts by meaning, not just keywords',
      'Bulk select thoughts — checkbox on each thought; bulk resolve, highlight, copy, or set reminder',
      'Summarise redesign — "Summarise" button on threads opens popup with summary + what\'s missing + Save; Summary tab shows saved summaries with keyword/date search',
      'Default tags per thread — set 1+ default tags when creating a thread; auto-applied to all new thoughts',
      'Smart parking — AI detects instructions embedded in thought text and extracts the actual thought',
      'Spirit card update — "My Purpose" headline and "I am a [Animal]" with highlighted name',
      'Splash screen replaced with static image for instant launch',
      'De-distract section — 11 scrollable slides: 4 spirit animal image slides with AI-generated trait text, 6 colorful thread idea slides, 1 quote slide',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-07-05',
    label: 'Parker & Insights Update',
    changes: [
      'Brand renamed to Parker — your personal thought companion',
      'Progress bubble chart for milestone journey visualisation',
      'Johari Window, word cloud, and YouTube sections persisted in DB',
      'Bulk upload overhauled with LLM extraction and multi-file support',
      'Confession and Voice parking tutorial steps added',
      'Spirit animal and life purpose now editable after creation',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-07-05',
    label: 'Spirit & Purpose Update',
    changes: [
      'Spirit animal & life purpose onboarding screen',
      'Milestone tags system replaces numbered milestone tabs',
      '"Why this goal" and "Price of missing goal" category tags added',
      'Admin ban controls and maintenance mode',
      'Two-stage splash video intro',
      'Branding updated to Nudged throughout',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-20',
    label: 'Credits & Admin Panel',
    changes: [
      'AI credit balance visible on Profile page',
      'Request $5 top-up from Profile',
      'Admin panel with usage stats and credit management',
      'Exempt email list for unlimited access',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-01',
    label: 'Harry AI Coach',
    changes: [
      'Harry — your personal AI coach for goal guidance',
      'AI-powered thought suggestions in Park Thoughts',
      'Ritual generator for daily habits',
      'Good News detector for positive reframing',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-10',
    label: 'Vision Board & Goals Redesign',
    changes: [
      'Vision board with drag-and-drop media',
      'Dashboard with progress metrics',
      'Notifications and nudge reminders',
      'Chrome extension for quick thought capture',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-15',
    label: 'Parked Thoughts',
    changes: [
      'Park Thoughts page for capturing ideas and reflections',
      'Category tags for organising thoughts',
      'Highlight and archive thoughts',
      'Search and filter across thoughts',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-01',
    label: 'Initial Launch',
    changes: [
      'Goals with milestones and tasks',
      'User onboarding and profiles',
      'Mobile-responsive PWA',
    ],
  },
];

export default function AboutPage() {
  const [tab, setTab] = useState<Tab>('about');
  const [appMode, setAppMode] = useState<'parker' | 'buddy'>(() => {
    return (localStorage.getItem('nudged_app_mode') as 'parker' | 'buddy') || 'parker';
  });

  const BUDDY_RELEASES = [
    { version: '2.1.0', date: '2026-07-26', label: 'Coach & Coachee Redesign', changes: [
      'Capsule-level knowledge upload for previous session context',
      'Talk agent with cross-session memory and capsule knowledge awareness',
      'Coach Insights with full context (capsule knowledge + all session notes)',
      'Power to Goal metric — confidence vs doubt word tracking',
      'Coach chatbot customization (name, avatar, greeting)',
      'Session summary auto-generated on submit',
      'Dashboard role separation — coach sees insights, coachee sees metrics',
      'Parking tags with AI prediction + Others + edit + search + cross-session',
      'Voice STT for Tasks and Watch inputs',
      'Coach image shown in coachee capsule view',
    ] },
    { version: '2.0.0', date: '2026-07-10', label: 'Summary Scheduling & Tag Catalogue', changes: [
      'Summary Scheduling for coaching sessions',
      'Listen In — voice bulk upload for session notes',
      'Rich text formatting for session notes',
      'Tag Catalogue for consistent tagging',
    ] },
    { version: '1.9.0', date: '2026-07-09', label: 'Thread Chips & Reminders', changes: [
      'Thread Chips for quick navigation',
      'One-Time Reminders',
      '2-Screen Parking layout',
    ] },
    { version: '1.6.0', date: '2026-07-05', label: 'Parker & Insights', changes: [
      'Parker integration with coaching',
      'Brand rename to Nudged',
    ] },
    { version: '1.3.0', date: '2026-06-01', label: 'Harry AI Coach', changes: [
      'Wise Harry chatbot for reflective conversations',
      'Coach questions configuration',
    ] },
    { version: '1.0.0', date: '2026-04-01', label: 'Initial Launch', changes: [
      'Coaching marketplace launch',
      'Capsule and session creation',
      'Coachee enrollment and session access',
    ] },
  ];

  const activeReleases = appMode === 'buddy' ? BUDDY_RELEASES : RELEASES;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-16 h-16 object-contain rounded-2xl shadow-md" />
        <div>
          <h1 className="text-2xl font-black text-gray-900">{appMode === 'buddy' ? 'Nudged Buddy' : 'Parker'}</h1>
          <p className="text-sm text-gray-500">by Nudged</p>
        </div>
      </div>

      {/* App mode switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => { setAppMode('parker'); localStorage.setItem('nudged_app_mode', 'parker'); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${appMode === 'parker' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Parker</button>
        <button onClick={() => { setAppMode('buddy'); localStorage.setItem('nudged_app_mode', 'buddy'); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${appMode === 'buddy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Buddy</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { id: 'about' as Tab, label: 'About', icon: Info },
          { id: 'releases' as Tab, label: 'Release History', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="space-y-5">
          {/* About Nudged Parker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">About {appMode === 'buddy' ? 'Nudged Buddy' : 'Nudged Parker'}</h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                {appMode === 'buddy'
                  ? 'Nudged Buddy is the coaching marketplace layer of the Nudged ecosystem. It connects coaches with coachees through structured capsules and sessions — each with configurable activities like Talk, Tasks, Watch, Parking, Quiz, and Knowledge. Coaches configure the journey; coachees engage with reflective conversations, track progress, and build momentum.'
                  : 'Parker is an AI-powered personal growth companion built to help you think clearly, act consistently, and grow meaningfully. It is the thought management layer of the Nudged ecosystem — a space where your ideas, challenges, goals, and reflections are captured, organised, and turned into momentum.'
                }
              </p>
              <p>
                {appMode === 'buddy'
                  ? 'Coaches create capsules (coaching programs), build sessions with activities, nominate coachees, and track progress through dashboards with AI-powered insights. Coachees engage with Wise Harry (or the coach\'s custom chatbot), complete tasks, park thoughts, and reflect on their journey.'
                  : 'Most people carry their best thinking in their heads — unsorted, unresolved, and forgotten. Parker changes that. Whether you are building a business, navigating a career transition, working on your health, or simply trying to think better, Parker helps you park every thought before it disappears, map it to a goal, and surface insights that keep you moving forward.'
                }
              </p>
            </div>
          </div>

          {/* About Nudged */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">About Nudged</h2>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                Nudged is a personal growth platform designed to close the gap between intention and action. We build tools that help people think more clearly, stay aligned with what matters most, and make consistent progress — without the noise, pressure, or overwhelm that derails so many good intentions.
              </p>
              <p>
                Our belief is simple: most people already know what they need to do. What they lack is the right system to hold their thinking, organise their energy, and create gentle, persistent accountability. Nudged provides that system.
              </p>
              <p>
                From goal setting to habit formation, from thought capture to AI-powered reflection — every product we build is designed to make growth feel achievable, not exhausting.
              </p>
            </div>
          </div>

          <div className="bg-teal-50 rounded-2xl border border-teal-100 p-5 text-center">
            <p className="text-xs text-teal-600 font-medium">Built with care for your growth journey.</p>
            <p className="text-xs text-teal-500 mt-1">Version {activeReleases[0].version} · {activeReleases[0].date}</p>
          </div>
        </div>
      )}

      {tab === 'releases' && (
        <div className="space-y-4">
          {activeReleases.map((r, i) => (
            <div key={r.version} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`px-5 py-3.5 flex items-center justify-between ${i === 0 ? 'bg-teal-50 border-b border-teal-100' : 'border-b border-gray-100'}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    v{r.version}
                  </span>
                  <span className={`text-sm font-semibold ${i === 0 ? 'text-teal-800' : 'text-gray-800'}`}>{r.label}</span>
                </div>
                <span className="text-xs text-gray-400">{r.date}</span>
              </div>
              <ul className="px-5 py-3.5 space-y-1.5">
                {r.changes.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
