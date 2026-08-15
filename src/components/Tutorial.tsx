import React, { useState, useEffect, createContext, useContext } from 'react';
import { X, ArrowRight, Info } from 'lucide-react';

// Keys for each tutorial step — one per feature/screen
export type TutorialKey =
  | 'profile'
  | 'vision_name'
  | 'vision_details'
  | 'vision_challenges'
  | 'vision_roadmap'
  | 'vision_board_view'
  | 'vision_board_nudges'
  | 'parked_thoughts_park'
  | 'parked_thoughts_list'
  | 'parked_thoughts_diary'
  | 'good_news'
  | 'wise_harry'
  | 'summarise_thoughts'
  | 'vent_confess'
  | 'save_image'
  | 'bulk_upload'
  | 'de_distract'
  | 'summary_schedule'
  | 'listen_in'
  | 'tag_catalogue'
  | 'rich_text';

const STORAGE_PREFIX = 'calm_tutorial_done_';

function isDone(key: TutorialKey): boolean {
  return localStorage.getItem(STORAGE_PREFIX + key) === '1';
}

function markDone(key: TutorialKey) {
  localStorage.setItem(STORAGE_PREFIX + key, '1');
}

export function resetAllTutorials() {
  const keys: TutorialKey[] = [
    'profile', 'vision_name', 'vision_details', 'vision_challenges', 'vision_roadmap',
    'vision_board_view', 'vision_board_nudges', 'parked_thoughts_park', 'parked_thoughts_list',
    'parked_thoughts_diary', 'good_news', 'wise_harry',
    'summarise_thoughts', 'vent_confess', 'save_image', 'bulk_upload', 'de_distract',
  ];
  keys.forEach((k) => localStorage.removeItem(STORAGE_PREFIX + k));
}

const TUTORIAL_CONTENT: Record<TutorialKey, { title: string; body: string }> = {
  profile: {
    title: 'Your profile is safe',
    body: 'Your personal information is completely private and secure. It helps us understand you better so every nudge, story, and advice is personalised just for you.',
  },
  vision_name: {
    title: 'Name your vision',
    body: 'Invest these 3 minutes diligently — a clear, powerful vision name helps us nudge you toward it every single day.',
  },
  vision_details: {
    title: 'Make it real',
    body: 'The more honestly you answer these questions, the more powerful your nudges, challenges, and roadmap will be. Think of this as writing a letter to your future self.',
  },
  vision_challenges: {
    title: 'Identify your blockers',
    body: 'Select the challenges you actually face. Star your top 3. Being honest here is the first step to breaking through. Mark challenges resolved when you overcome them!',
  },
  vision_roadmap: {
    title: 'Your personalised roadmap',
    body: 'This roadmap is auto-generated just for you. Tap the edit icon on any step to customise it. The sub-steps are your daily action guide.',
  },
  vision_board_view: {
    title: 'Your Vision Board',
    body: 'This is your command centre. Track each vision, see your challenges, and navigate to nudges, stories, and your roadmap — all from here.',
  },
  vision_board_nudges: {
    title: 'Daily Nudges',
    body: 'These nudges are crafted from your challenges and vision. Share what\'s on your mind today to refresh them. Thumb up nudges you love!',
  },
  parked_thoughts_park: {
    title: 'Park a thought',
    body: 'Had a sudden idea or insight? Park it here before it slips away. Link it to a vision and milestone — your thoughts will feed into your roadmap.',
  },
  parked_thoughts_list: {
    title: 'Your parked thoughts',
    body: 'Review all your saved thoughts here. Accept the ones that should become actions, reject ones that no longer resonate, and group them by theme.',
  },
  parked_thoughts_diary: {
    title: 'Your private diary',
    body: 'Write daily reflections on what went well, what didn\'t, your plans, and gratitude. Once submitted, entries are locked — honest, permanent records of your journey.',
  },
  good_news: {
    title: 'Good News for your goals',
    body: 'Every day brings stories, insights, and actions aligned with your visions. This section keeps you informed and inspired — real news tailored to your goals.',
  },
  wise_harry: {
    title: 'Meet Wise Harry',
    body: 'Harry is your personal coach. He knows your challenges, your goals, and your conversations. Ask him anything in Quick Advice mode, or go deep with a coaching session — he leads the conversation.',
  },
  summarise_thoughts: {
    title: 'Summarise selected thoughts',
    body: 'Select multiple thoughts, click Summarise, and get a structured breakdown: Objective, Summary, Next Steps, and Nudged Suggestions you may not have considered.',
  },
  vent_confess: {
    title: 'Confess or Vent',
    body: 'Need to get something off your chest? Confess stores nothing visible. Vent stores your words privately to inform future coaching — your courage matters.',
  },
  save_image: {
    title: 'Save image to gallery',
    body: 'When you upload an image while parking a thought, tick "Save to image gallery" to keep it visible in your thread dashboard.',
  },
  bulk_upload: {
    title: 'Bulk upload thoughts',
    body: 'Have lots of ideas at once? Use Bulk Upload to paste or type multiple thoughts, and park them all in one go to any thread.',
  },
  de_distract: {
    title: 'De-distract — your Instagram for goals',
    body: 'Scroll through inspiring slides tied to your spirit animal, threads, and insights. New content loads automatically as you scroll — stay focused by staying inspired.',
  },
  summary_schedule: {
    title: 'Schedule a Summary',
    body: 'Set a recurring AI summary for this thread — choose tags to filter by, write a custom AI prompt, and pick a time. Summaries appear in the Summary tab grouped by date.',
  },
  listen_in: {
    title: 'Listen In — voice capture',
    body: 'Tap "Listen In" to start recording your spoken thoughts. Parker AI transcribes and splits them into rows with threads and tags. Auto-stops after 5 min of silence. Drafts persist even if you close the tab.',
  },
  tag_catalogue: {
    title: 'Tag Catalogue',
    body: 'View, add, and delete all custom tags you\'ve created across threads. Deleted tags won\'t appear in search or new thoughts, but existing thoughts keep their tags.',
  },
  rich_text: {
    title: 'Rich Text Formatting',
    body: 'Use the bold, italic, and underline buttons above the thought input to format key topics. AI also auto-bolds main topics and underlines key terms when predicting.',
  },
};

interface TutorialTooltipProps {
  tutorialKey: TutorialKey;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function TutorialTooltip({ tutorialKey, className = '', position = 'bottom' }: TutorialTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDone(tutorialKey)) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [tutorialKey]);

  const dismiss = () => {
    markDone(tutorialKey);
    setVisible(false);
  };

  if (!visible) return null;

  const content = TUTORIAL_CONTENT[tutorialKey];
  if (!content) return null;

  const posClasses = {
    bottom: 'top-full mt-2 left-0',
    top: 'bottom-full mb-2 left-0',
    right: 'left-full ml-2 top-0',
    left: 'right-full mr-2 top-0',
  };

  const arrowClasses = {
    bottom: 'top-0 left-4 -translate-y-1/2 rotate-45',
    top: 'bottom-0 left-4 translate-y-1/2 rotate-45',
    right: 'left-0 top-4 -translate-x-1/2 rotate-45',
    left: 'right-0 top-4 translate-x-1/2 rotate-45',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`absolute z-50 w-72 bg-teal-700 text-white rounded-2xl shadow-2xl p-4 ${posClasses[position]}`}>
        <div className={`absolute w-3 h-3 bg-teal-700 ${arrowClasses[position]}`} />
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-bold text-sm">{content.title}</p>
          <button onClick={dismiss} className="text-white/70 hover:text-white flex-shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-teal-100 leading-relaxed">{content.body}</p>
        <button
          onClick={dismiss}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 transition-all"
        >
          Got it <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Inline banner variant for larger tutorial cues
export function TutorialBanner({ tutorialKey }: { tutorialKey: TutorialKey }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDone(tutorialKey)) {
      setVisible(true);
    }
  }, [tutorialKey]);

  const dismiss = () => {
    markDone(tutorialKey);
    setVisible(false);
  };

  if (!visible) return null;

  const content = TUTORIAL_CONTENT[tutorialKey];
  if (!content) return null;

  return (
    <div className="mx-4 mt-3 mb-1 bg-teal-600 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-md">
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm">{content.title}</p>
        <p className="text-teal-100 text-xs mt-0.5 leading-relaxed">{content.body}</p>
      </div>
      <button onClick={dismiss} className="text-white/70 hover:text-white flex-shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export { isDone, markDone };

// Small inline info button with popover
export function InfoButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button onClick={() => setOpen(p => !p)} className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 hover:bg-teal-100 hover:text-teal-600 flex items-center justify-center transition flex-shrink-0" title="What does this do?">
        <Info className="w-2.5 h-2.5" />
      </button>
      {open && (
        <span className="absolute left-6 top-0 z-50 w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl leading-relaxed">
          {text}
          <button onClick={() => setOpen(false)} className="ml-1 text-gray-400 hover:text-white"><X className="w-2.5 h-2.5 inline" /></button>
        </span>
      )}
    </span>
  );
}
