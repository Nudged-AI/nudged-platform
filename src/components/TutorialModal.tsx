import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Target, Brain, Tag, Bell, Star, BarChart2, HelpCircle, Clock, Upload, Mic, Heart, Zap, Sparkles, FileText, MessageCircle, CheckSquare, BookOpen, Trophy } from 'lucide-react';

const PARKER_STEPS = [
  {
    icon: Zap,
    color: 'teal',
    title: 'Welcome to Nudged Parker',
    body: "Your thoughts are signals from the universe & pave the path to your future. Today, you spend time in capturing them in to-do lists and then waste extra time organising them.\n\nNudged Parker is the world's first AI-powered thought parking tool. We ensure you can simply dump your thoughts with your voice or text with us, and relax. We align your thoughts to your goals, summarize them daily, and watch your thoughts turn into actions.\n\nWe ensure you spend time in achieving what you want and don't waste any extra time in organising your thoughts in those old-fashioned to-do lists.\n\nScroll through to see everything Parker can do for you.",
  },
  {
    icon: Target,
    color: 'teal',
    title: 'Create Threads',
    body: 'Start by creating a Thread from the Threads tab. Give it a name, optional target date, and choose or customise the 5 milestone stages that mark your journey. A General Thread is created automatically for miscellaneous thoughts.',
  },
  {
    icon: Brain,
    color: 'blue',
    title: 'Park Thoughts',
    body: 'Use "Park Thoughts" to capture any idea, task, challenge, or reflection instantly. Assign it to a thread and milestone stage. The AI can predict the right tags and even suggest a complementary thought with "Help me think".',
  },
  {
    icon: Mic,
    color: 'rose',
    title: 'Voice Parking',
    body: 'Park thoughts using your voice — tap the microphone icon in Park Thoughts and speak your idea aloud. Parker will transcribe it instantly. Great for parking thoughts on the go without typing a single word.',
  },
  {
    icon: Upload,
    color: 'emerald',
    title: 'Bulk Upload using Voice',
    body: 'Use "Bulk Upload" to add multiple thoughts at once — paste text, import from a file, or use the Listen In voice feature to speak all your thoughts at once. Parker\'s AI extracts and parses the content into individual rows automatically. Each row lets you set the thread, milestone, and tags.',
  },
  {
    icon: Sparkles,
    color: 'blue',
    title: 'Summarise your thoughts',
    body: 'Select multiple thoughts, click Summarise, and get a structured AI breakdown: Objective, Summary, Next Steps, and Nudged Suggestions you may not have considered. You can also schedule recurring AI summaries for any thread.',
  },
  {
    icon: Clock,
    color: 'teal',
    title: 'Schedule Reminders',
    body: 'Set a recurring reminder on any thought via the bell icon. Choose daily, weekly, or monthly frequency, a time of day, and an optional end date. Due reminders appear in the notification bell at the top.',
  },
  {
    icon: BarChart2,
    color: 'teal',
    title: 'Thought Analytics',
    body: 'Switch to the Dashboard tab inside any thread to see open thought count, top tags, milestone progress bars, aged highlighted thoughts, and a gallery of all attached images — a bird\'s-eye view of your progress.',
  },
  {
    icon: HelpCircle,
    color: 'sky',
    title: 'Seek Help on Challenges',
    body: 'Any thought tagged "challenge" gets a blue help button. Press it and the AI reads your thread context to suggest a practical one-line solution. You can instantly "Park this" suggestion as a new thought.',
  },
  {
    icon: Star,
    color: 'amber',
    title: 'Highlight & Organise',
    body: 'Star a thought to highlight it in amber — great for keeping key ideas visible. Use the up/down arrows to reorder thoughts within a milestone. Archive completed thoughts with the green tick; restore them any time.',
  },
  {
    icon: Heart,
    color: 'pink',
    title: 'Confession & Vent Out',
    body: 'Sometimes you just need to say what\'s really on your mind. Use Confession to park honest, raw thoughts — fears, frustrations, or things you\'ve been avoiding. Use Vent to get something off your chest — Parker stores your words privately to inform future coaching.',
  },
  {
    icon: FileText,
    color: 'violet',
    title: 'De-Distract',
    body: 'Scroll through inspiring slides tied to your spirit animal, threads, and insights. New content loads automatically as you scroll — stay focused by staying inspired.',
  },
];

const BUDDY_STEPS = [
  {
    icon: Zap,
    color: 'teal',
    title: 'Welcome to Nudged Buddy',
    body: "Nudged Buddy is the coaching marketplace layer of the Nudged ecosystem. It connects coaches with coachees through structured capsules and sessions.\n\nCoaches create capsules (coaching programs), build sessions with configurable activities, nominate coachees, and track progress through AI-powered dashboards. Coachees engage with reflective conversations, complete tasks, park thoughts, and build momentum.\n\nScroll through to see how Nudged Buddy works.",
  },
  {
    icon: BookOpen,
    color: 'teal',
    title: 'Capsules & Sessions',
    body: 'Coaches create capsules — coaching programs with a defined goal and nominated coachees. Each capsule contains multiple sessions, each with its own topic, goals, and activities. Coaching capsules have one nominated coachee; training capsules can have multiple.',
  },
  {
    icon: Upload,
    color: 'emerald',
    title: 'Session Notes & Knowledge Upload',
    body: 'Coaches upload session notes from PPT, PDF, DOC, or even audio/video recordings. The system extracts text programmatically and uses it to generate goals, tasks, quiz questions, and session summaries. Capsule-level knowledge uploads provide context across all sessions.',
  },
  {
    icon: MessageCircle,
    color: 'blue',
    title: 'Talk — Reflective Conversations',
    body: 'Coachees engage in one-on-one reflective conversations with the coach\'s custom chatbot after each session. The chatbot uses capsule knowledge, previous session notes, and coach questions to guide the conversation naturally. Coaches can customize the chatbot name, avatar, and greeting.',
  },
  {
    icon: CheckSquare,
    color: 'teal',
    title: 'Tasks & Watch Activities',
    body: 'Coaches configure tasks and watch items with scheduled dates. Coachees complete them by recording what they did, what they learned, what went well, and what to focus on. Voice input is supported for all fields.',
  },
  {
    icon: Brain,
    color: 'violet',
    title: 'Parking Thoughts',
    body: 'Coachees park thoughts with AI-predicted tags. Tags are nominated by the coach per session. Thoughts can be searched, edited, and viewed across all sessions within a capsule.',
  },
  {
    icon: Zap,
    color: 'amber',
    title: 'Power to Goal',
    body: 'The system tracks confidence vs doubt words in coachee inputs — talk messages, task notes, watch notes, and parked thoughts. The Power to Goal percentage shows how much the coachee\'s language leans toward confidence vs doubt, with a trend across sessions.',
  },
  {
    icon: Sparkles,
    color: 'indigo',
    title: 'Coach Insights',
    body: 'Coaches get AI-powered insights for each activity, answering their configured coach questions using full context — capsule knowledge, all session notes, talk conversations, and activity data. Insights are cached and can be regenerated. Follow-up questions are supported via chat.',
  },
  {
    icon: Trophy,
    color: 'amber',
    title: 'Stars & Dashboard',
    body: 'Coachees earn stars for completing activities. The dashboard shows Power to Goal, Stars, Completion Status, and (for coaches) Coach Insights and Thought Pattern Analysis. Coaches can view individual coachee or all-coachees consolidated views.',
  },
];

const COLOR_MAP: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-600',
  blue: 'bg-blue-100 text-blue-600',
  violet: 'bg-violet-100 text-violet-600',
  amber: 'bg-amber-100 text-amber-600',
  sky: 'bg-sky-100 text-sky-600',
  red: 'bg-red-100 text-red-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  rose: 'bg-rose-100 text-rose-600',
  pink: 'bg-pink-100 text-pink-600',
};

interface Props { onClose: () => void; appMode?: 'parker' | 'buddy'; }

export default function TutorialModal({ onClose, appMode }: Props) {
  const [step, setStep] = useState(0);
  const mode = appMode ?? (typeof localStorage !== 'undefined' ? (localStorage.getItem('nudged_app_mode') as 'parker' | 'buddy') ?? 'parker' : 'parker');
  const STEPS = mode === 'buddy' ? BUDDY_STEPS : PARKER_STEPS;
  const current = STEPS[step];
  const Icon = current.icon;
  const iconClass = COLOR_MAP[current.color] ?? 'bg-teal-100 text-teal-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">How {mode === 'buddy' ? 'Nudged Buddy' : 'Parker'} works</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-teal-500 w-6' : 'bg-gray-200 w-3'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className={`w-14 h-14 rounded-2xl ${iconClass} flex items-center justify-center mb-4`}>
            <Icon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">{current.title}</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-2">
            {current.body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 transition px-3 py-1.5 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-xs text-gray-400">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition px-4 py-1.5 rounded-xl"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition px-4 py-1.5 rounded-xl"
            >
              Done <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
