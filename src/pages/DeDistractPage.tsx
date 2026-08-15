import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Volume2, VolumeX, ChevronDown, Quote, Newspaper, Lightbulb } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';

interface Goal { id: string; title: string; icon: string; is_general: boolean; is_all_thread?: boolean; }
interface Props { user: User; profile: UserProfile; }

const ANIMAL_IMAGES: Record<string, string[]> = {
  Lion:      ['https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/33045/lion-wild-africa-african.jpg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1462011/pexels-photo-1462011.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Tiger:     ['https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/39571/tiger-paws-teeth-hunting-39571.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/792381/pexels-photo-792381.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Elephant:  ['https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1437386/pexels-photo-1437386.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/247431/pexels-photo-247431.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Eagle:     ['https://images.pexels.com/photos/1094570/pexels-photo-1094570.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/164185/pexels-photo-164185.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Horse:     ['https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/52500/horse-herd-horses-brown-52500.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1996333/pexels-photo-1996333.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Dolphin:   ['https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/2607544/pexels-photo-2607544.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/189349/pexels-photo-189349.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Butterfly: ['https://images.pexels.com/photos/672142/pexels-photo-672142.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/53957/butterfly-blue-wing-insect-53957.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1638606/pexels-photo-1638606.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Wolf:      ['https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1123771/pexels-photo-1123771.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/975370/pexels-photo-975370.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Owl:       ['https://images.pexels.com/photos/1202581/pexels-photo-1202581.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/2361952/pexels-photo-2361952.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/4001296/pexels-photo-4001296.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  Dog:       ['https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/160846/french-bulldog-summer-smile-joy-160846.jpeg?auto=compress&cs=tinysrgb&w=1200','https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=1200'],
};

const ANIMAL_TRAITS: Record<string, string[]> = {
  Lion: ['Natural leader who commands respect', 'Courageous in the face of every challenge', 'Protective and deeply loyal to your pride', 'Decisive — you act when others hesitate', 'Your roar inspires those around you'],
  Tiger: ['Intensely focused on your goals', 'Powerful — you move with precision and purpose', 'Patient until the perfect moment to strike', 'Solitary in strength, unstoppable in action', 'You make the impossible look effortless'],
  Elephant: ['Memory is your greatest superpower', 'Patient, methodical, and truly unstoppable', 'Loyal to those who earn your trust', 'Your presence creates safety for others', 'You carry wisdom others are still searching for'],
  Eagle: ['You see what others completely miss', 'Big-picture thinker with sharp execution', 'Freedom and independence define you', 'You rise effortlessly above the noise', 'Your vision is your compass'],
  Horse: ['Driven by freedom and pure momentum', 'Powerful when you hit your full stride', 'Loyal partner and an unstoppable force', 'You carry others further than they imagined', 'Your energy is contagious and inspiring'],
  Dolphin: ['Curious, playful, and endlessly creative', 'You navigate complexity with pure joy', 'Deep empathy makes you truly magnetic', 'Collaborative by nature, brilliant in flow', 'Your laughter is the sound of progress'],
  Wolf: ['Strategic and deeply pack-minded', 'Loyal to your team above all else', 'Intuitively perceptive about people', 'You lead without needing the spotlight', 'Your instincts never lead you astray'],
  Owl: ['Wisdom over speed — always', 'Night-sharp instincts guide your every step', 'You see through confusion to pure truth', 'Calm under pressure, precise in insight', 'Your silence speaks louder than words'],
  Butterfly: ['Transformation is your ultimate superpower', 'You evolve constantly and beautifully', 'Your presence uplifts everyone around you', 'Growth is not optional — it is your nature', 'Every chapter of your life is more beautiful'],
  Dog: ['Boundless energy and genuine enthusiasm', 'Loyalty that cannot be bought or broken', 'You find joy in even the simplest moments', 'Your positivity is genuinely contagious', 'The world is a better place with you in it'],
};

const NEWS_BACKDROPS = [
  'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/327540/pexels-photo-327540.jpeg?auto=compress&cs=tinysrgb&w=1200',
];

const ADVICE_BACKDROPS = [
  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/3836468/pexels-photo-3836468.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/3786748/pexels-photo-3786748.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/917510/pexels-photo-917510.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg?auto=compress&cs=tinysrgb&w=1200',
];

const AFFIRMATIONS = [
  "You were built for this.",
  "Progress, not perfection.",
  "Your effort today is tomorrow's result.",
  "Consistency is your secret weapon.",
  "You are closer than you think.",
  "Every step forward is a victory.",
  "Believe in the version of you that started this.",
  "Small wins compound into massive change.",
  "You have everything you need right now.",
  "Show up today and the rest follows.",
  "You are exactly where you need to be.",
  "Your mindset is your most powerful tool.",
  "Done is better than perfect.",
  "Keep going — the best is still ahead.",
  "One focused hour beats ten distracted ones.",
  "You are writing your own story — make it epic.",
  "Doubt is just fear wearing a suit.",
  "Action is the antidote to anxiety.",
  "Your future self is cheering you on.",
  "Be proud of how far you have come.",
  "You grow through what you go through.",
  "Hard work always finds its reward.",
  "You are more capable than you believe.",
  "Rest if you must, but never quit.",
  "The obstacle is the way.",
  "Focus on what you can control.",
  "Your story is not over — not even close.",
  "Every expert was once a beginner.",
  "Momentum starts with one brave step.",
  "You are a force of nature.",
  "Discipline is love for your future self.",
  "Trust the slow work of time.",
  "You are not behind — you are on your path.",
  "Make yourself proud today.",
  "Success loves the persistent.",
  "Your energy is contagious — use it wisely.",
  "One more rep. One more page. One more step.",
  "You have survived every hard day so far.",
  "Clarity comes from action, not thought.",
  "Be the energy you wish to receive.",
  "Your potential is limitless.",
  "Start before you feel ready.",
  "You are the author of your own life.",
  "Courage is a muscle — flex it daily.",
  "Great things take time. Stay patient.",
  "You are enough. You have always been enough.",
  "Challenge is how character is built.",
  "Every day is a fresh start.",
  "Your vision is bigger than your fear.",
  "The best investment is in yourself.",
  "You inspire more people than you know.",
  "What got you here will not hold you here.",
  "Lean into discomfort — that is where growth lives.",
  "You are building something that lasts.",
  "Celebrate the small wins. They add up.",
  "Your hard work is not invisible.",
  "Show the world what you are made of.",
  "Resilience is built one hard day at a time.",
  "You are not your setbacks.",
  "The grind is temporary. The legacy is permanent.",
  "Think big. Start small. Act now.",
  "You are in the right direction.",
  "Effort always outlasts luck.",
  "You were born to stand out.",
  "The comeback is always stronger than the setback.",
  "Keep your head down and your standards high.",
  "You are proof that hard work pays off.",
  "Protect your peace and your purpose.",
  "Win the morning, win the day.",
  "Your habits are shaping your destiny.",
  "You are a work in progress — and that is beautiful.",
  "Breathe. Refocus. Keep going.",
  "The best view comes after the hardest climb.",
  "You were not made for average.",
  "Turn your wounds into wisdom.",
  "Your breakthrough is just around the corner.",
  "Stay in your lane. It is a great one.",
  "You do not need luck — you need consistency.",
  "Today's discomfort is tomorrow's strength.",
  "Be stubborn about your goals and flexible about your methods.",
  "You are not waiting for opportunity — you are creating it.",
  "Your uniqueness is your power.",
  "Even on hard days, you showed up.",
];

const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/16/audio_12a8fa1b4a.mp3';

type SlideType = 'animal' | 'affirmation' | 'news' | 'advice' | 'quote';

interface Slide {
  id: string;
  type: SlideType;
  bgUrl?: string;
  text: string;
  subText?: string;
  label?: string;
  accentColor?: string;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function loadSavedSlides(userId: string): Promise<Slide[]> {
  const { data } = await supabase
    .from('de_distract_slides')
    .select('id,slide_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (data ?? [])
    .map((row: any) => ({ ...(row.slide_data as Slide), id: row.id }))
    // Filter out old-format slides (they have 'trait'/'idea' instead of 'text')
    .filter((s: Slide) => typeof s.text === 'string' && s.text.length > 0);
}

async function buildSlides(user: User, profile: UserProfile, batchNum: number): Promise<Slide[]> {
  const animal = profile.spirit_animal ?? 'Lion';
  const animalPool = ANIMAL_IMAGES[animal] ?? ANIMAL_IMAGES.Lion;
  const traits = ANIMAL_TRAITS[animal] ?? ANIMAL_TRAITS.Lion;
  const animalImg = animalPool[(batchNum * 3) % animalPool.length];

  const { data: gs } = await supabase
    .from('goals').select('id,title,icon,is_general,is_all_thread')
    .eq('user_id', user.id).order('created_at', { ascending: true });
  const goals = ((gs as Goal[]) ?? []).filter(g => !g.is_all_thread && !g.is_general).slice(0, 6);
  const topGoals = goals.slice(0, 3);

  const slides: Slide[] = [];

  // 1. Animal slide
  slides.push({
    id: `animal-${Date.now()}`,
    type: 'animal',
    bgUrl: animalImg,
    text: traits[batchNum % traits.length],
    subText: `I am a ${animal}`,
    label: animal,
    accentColor: 'teal',
  });

  // 2. Two affirmation slides
  const pickedAffirmations = pickRandomN(AFFIRMATIONS, 2);
  pickedAffirmations.forEach((aff, i) => {
    slides.push({
      id: `aff-${i}-${Date.now()}`,
      type: 'affirmation',
      text: aff,
      accentColor: i === 0 ? 'amber' : 'rose',
    });
  });

  // 3. Three news slides about threads
  let newsItems: { text: string; goalTitle: string }[] = [];
  if (topGoals.length > 0) {
    try {
      const threadTitles = topGoals.map(g => g.title).join(', ');
      const prompt = `These are someone's active goal threads: ${threadTitles}.\nGenerate 3 brief, fascinating news-style insights or trends that are relevant and motivating for each thread. Each 1-2 punchy sentences, written like an interesting headline with context. Return JSON: {"news":[{"text":"...","goalTitle":"..."},{"text":"...","goalTitle":"..."},{"text":"...","goalTitle":"..."}]}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ news: { text: string; goalTitle: string }[] }>(result);
      newsItems = parsed?.news?.slice(0, 3) ?? [];
    } catch { /* silent */ }
  }
  // Fill with fallbacks if needed
  while (newsItems.length < 3) {
    const g = goals[newsItems.length % Math.max(goals.length, 1)];
    newsItems.push({
      text: 'New research shows that people who write down their goals are 42% more likely to achieve them.',
      goalTitle: g?.title ?? 'Your Goals',
    });
  }
  newsItems.slice(0, 3).forEach((item, i) => {
    slides.push({
      id: `news-${i}-${Date.now()}`,
      type: 'news',
      bgUrl: NEWS_BACKDROPS[i % NEWS_BACKDROPS.length],
      text: item.text,
      subText: item.goalTitle,
      label: 'Trending Now',
    });
  });

  // 4. Three advice slides for threads
  let adviceItems: { text: string; goalTitle: string }[] = [];
  if (topGoals.length > 0) {
    try {
      const threadTitles = topGoals.map(g => g.title).join(', ');
      const prompt = `Someone is working on these goals: ${threadTitles}.\nGive 3 specific, actionable, and encouraging pieces of advice — one per goal. Written in second person, inspiring and practical. 1-2 sentences each. Return JSON: {"advice":[{"text":"...","goalTitle":"..."},{"text":"...","goalTitle":"..."},{"text":"...","goalTitle":"..."}]}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ advice: { text: string; goalTitle: string }[] }>(result);
      adviceItems = parsed?.advice?.slice(0, 3) ?? [];
    } catch { /* silent */ }
  }
  while (adviceItems.length < 3) {
    const g = goals[adviceItems.length % Math.max(goals.length, 1)];
    adviceItems.push({
      text: 'Break your goal into three small steps and tackle just the first one today.',
      goalTitle: g?.title ?? 'Your Goals',
    });
  }
  adviceItems.slice(0, 3).forEach((item, i) => {
    slides.push({
      id: `advice-${i}-${Date.now()}`,
      type: 'advice',
      bgUrl: ADVICE_BACKDROPS[i % ADVICE_BACKDROPS.length],
      text: item.text,
      subText: item.goalTitle,
      label: 'Advice for You',
    });
  });

  // 5. Two quote slides
  let quotes: { text: string; goalTitle: string }[] = [];
  if (topGoals.length > 0) {
    try {
      const threadTitles = topGoals.slice(0, 2).map(g => g.title).join(' and ');
      const prompt = `Someone is working on: ${threadTitles}.\nGive 2 powerful, authentic motivational quotes (with author) that are deeply aligned with these goals. Return JSON: {"quotes":[{"text":"quote — Author","goalTitle":"..."},{"text":"quote — Author","goalTitle":"..."}]}`;
      const result = await callLLM('custom_prompt', { prompt });
      const parsed = parseJSON<{ quotes: { text: string; goalTitle: string }[] }>(result);
      quotes = parsed?.quotes?.slice(0, 2) ?? [];
    } catch { /* silent */ }
  }
  while (quotes.length < 2) {
    quotes.push({
      text: '"The secret of getting ahead is getting started." — Mark Twain',
      goalTitle: goals[0]?.title ?? 'Your Journey',
    });
  }
  quotes.slice(0, 2).forEach((q, i) => {
    slides.push({
      id: `quote-${i}-${Date.now()}`,
      type: 'quote',
      text: q.text,
      subText: q.goalTitle,
      accentColor: i === 0 ? 'cyan' : 'violet',
    });
  });

  // Persist to DB and replace temp ids with DB ids
  const insertRows = slides.map(s => ({
    user_id: user.id,
    batch_num: batchNum,
    slide_type: s.type,
    slide_data: s,
  }));
  const { data: inserted } = await supabase
    .from('de_distract_slides').insert(insertRows).select('id,slide_data');
  if (inserted && inserted.length === slides.length) {
    return inserted.map((row: any) => ({ ...(row.slide_data as Slide), id: row.id }));
  }

  return slides;
}

const GRADIENT_PALETTES: Record<string, string> = {
  amber: 'from-amber-900/90 via-orange-900/70 to-amber-950/95',
  rose:  'from-rose-900/90 via-pink-900/70 to-rose-950/95',
  cyan:  'from-cyan-900/90 via-teal-900/70 to-cyan-950/95',
  violet:'from-violet-900/90 via-purple-900/70 to-violet-950/95',
  teal:  'from-teal-900/90 via-emerald-900/70 to-teal-950/95',
};

const SOLID_BG: Record<string, string> = {
  amber: 'bg-gradient-to-br from-amber-950 via-orange-900 to-yellow-950',
  rose:  'bg-gradient-to-br from-rose-950 via-pink-900 to-red-950',
  cyan:  'bg-gradient-to-br from-cyan-950 via-teal-900 to-emerald-950',
  violet:'bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950',
  teal:  'bg-gradient-to-br from-teal-950 via-emerald-900 to-cyan-950',
};

function SlideView({ slide, isActive }: { slide: Slide; isActive: boolean }) {
  const accentHex: Record<string, string> = {
    teal: '#2dd4bf', amber: '#fbbf24', rose: '#fb7185', cyan: '#22d3ee', violet: '#a78bfa',
  };
  const accent = accentHex[slide.accentColor ?? 'teal'] ?? '#2dd4bf';

  if (slide.type === 'animal') {
    return (
      <div className="relative w-full h-full overflow-hidden">
        {slide.bgUrl && (
          <img
            src={slide.bgUrl}
            alt={slide.label}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-105' : 'scale-100'}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />
        {/* Top badge */}
        <div className="absolute top-14 left-0 right-0 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5">
            <span className="text-white/80 text-xs font-semibold tracking-widest uppercase">De-Distract · Nudged</span>
          </div>
        </div>
        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-24">
          <p className="text-white/60 text-sm font-medium mb-1">{slide.subText}</p>
          <h2 className="text-white font-black text-4xl leading-tight mb-4" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
            {slide.label}
          </h2>
          <p className="text-white/90 text-lg font-medium leading-relaxed">{slide.text}</p>
        </div>
        {/* Animated glow dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
      </div>
    );
  }

  if (slide.type === 'affirmation') {
    const bg = SOLID_BG[slide.accentColor ?? 'teal'];
    return (
      <div className={`relative w-full h-full ${bg} flex flex-col items-center justify-center px-8`}>
        {/* Decorative circles */}
        <div className="absolute top-1/4 -right-20 w-72 h-72 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
        <div className="absolute bottom-1/4 -left-20 w-56 h-56 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
        {/* Top badge */}
        <div className="absolute top-14 left-0 right-0 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5">
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Your Reminder</span>
          </div>
        </div>
        <div className="text-center">
          <div className="w-14 h-0.5 mx-auto mb-8 opacity-40" style={{ background: accent }} />
          <p className="text-white font-black text-3xl leading-tight text-center" style={{ textShadow: '0 2px 30px rgba(0,0,0,0.3)' }}>
            {slide.text}
          </p>
          <div className="w-14 h-0.5 mx-auto mt-8 opacity-40" style={{ background: accent }} />
        </div>
      </div>
    );
  }

  if (slide.type === 'news') {
    const overlayClass = `bg-gradient-to-t ${GRADIENT_PALETTES.teal}`;
    return (
      <div className="relative w-full h-full overflow-hidden">
        {slide.bgUrl && (
          <img
            src={slide.bgUrl}
            alt="news"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-105' : 'scale-100'}`}
          />
        )}
        <div className={`absolute inset-0 ${overlayClass}`} />
        <div className="absolute top-14 left-0 right-0 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2">
            <Newspaper className="w-3 h-3 text-white/70" />
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">{slide.label}</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-24">
          {slide.subText && (
            <span className="inline-block text-teal-300 text-xs font-semibold uppercase tracking-wider mb-3 bg-teal-900/40 border border-teal-500/30 rounded-full px-3 py-1">
              {slide.subText}
            </span>
          )}
          <p className="text-white font-bold text-2xl leading-snug" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            {slide.text}
          </p>
        </div>
      </div>
    );
  }

  if (slide.type === 'advice') {
    return (
      <div className="relative w-full h-full overflow-hidden">
        {slide.bgUrl && (
          <img
            src={slide.bgUrl}
            alt="advice"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-105' : 'scale-100'}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
        <div className="absolute top-14 left-0 right-0 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2">
            <Lightbulb className="w-3 h-3 text-white/70" />
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">{slide.label}</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-24">
          {slide.subText && (
            <span className="inline-block text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3 bg-amber-900/40 border border-amber-500/30 rounded-full px-3 py-1">
              {slide.subText}
            </span>
          )}
          <p className="text-white font-bold text-2xl leading-snug" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            {slide.text}
          </p>
        </div>
      </div>
    );
  }

  if (slide.type === 'quote') {
    const bg = SOLID_BG[slide.accentColor ?? 'cyan'];
    return (
      <div className={`relative w-full h-full ${bg} flex flex-col items-center justify-center px-8`}>
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
        <div className="absolute top-14 left-0 right-0 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2">
            <Quote className="w-3 h-3 text-white/70" />
            <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">Wisdom</span>
          </div>
        </div>
        <div className="text-center max-w-sm">
          <Quote className="w-12 h-12 mx-auto mb-6 opacity-30" style={{ color: accent }} />
          <p className="text-white font-semibold text-xl leading-relaxed italic mb-6" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            {slide.text}
          </p>
          {slide.subText && (
            <p className="text-white/50 text-sm">For your goal: {slide.subText}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function DeDistractPage({ user, profile }: Props) {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Init audio — must be triggered by user gesture to comply with autoplay policy
  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    const startAudio = () => {
      if (audioRef.current && !audioStarted) {
        audioRef.current.play().then(() => setAudioStarted(true)).catch(() => {});
      }
    };

    document.addEventListener('click', startAudio, { once: true });
    document.addEventListener('touchstart', startAudio, { once: true });
    document.addEventListener('keydown', startAudio, { once: true });
    document.addEventListener('scroll', startAudio, { once: true, capture: true });

    return () => {
      audio.pause();
      audio.src = '';
      document.removeEventListener('click', startAudio);
      document.removeEventListener('touchstart', startAudio);
      document.removeEventListener('keydown', startAudio);
      document.removeEventListener('scroll', startAudio, true);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const handleMuteToggle = () => {
    if (!audioStarted && audioRef.current) {
      audioRef.current.play().then(() => setAudioStarted(true)).catch(() => {});
    }
    setMuted(m => !m);
  };

  // Load saved slides then append a fresh batch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const saved = await loadSavedSlides(user.id);
      if (!cancelled) {
        setSlides(saved);
        setLoading(false);
        setAppending(true);
      }
      // Always generate a new batch and append
      const batchNum = Math.floor(saved.length / 11);
      const fresh = await buildSlides(user, profile, batchNum);
      if (!cancelled) {
        setSlides(prev => [...prev, ...fresh]);
        setAppending(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  // Track current slide via IntersectionObserver
  useEffect(() => {
    if (!scrollRef.current || slides.length === 0) return;
    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt((entry.target as HTMLElement).dataset.idx ?? '0');
          setCurrentIdx(idx);
        }
      });
    }, { threshold: 0.6 });
    observerRef.current = obs;
    const children = scrollRef.current.querySelectorAll('[data-idx]');
    children.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, [slides]);

  const scrollToNext = () => {
    if (!scrollRef.current) return;
    const children = scrollRef.current.querySelectorAll('[data-idx]');
    const next = children[currentIdx + 1];
    next?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
      <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-16 h-16 rounded-2xl object-contain mb-2" />
      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      <p className="text-white/60 text-sm">Building your first feed...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Snap scroll container */}
      <div
        ref={scrollRef}
        className="w-full h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            data-idx={String(idx)}
            className="relative w-full flex-shrink-0"
            style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            <SlideView slide={slide} isActive={currentIdx === idx} />

            {/* Scroll indicator — only on non-last slides */}
            {(idx < slides.length - 1 || appending) && currentIdx === idx && (
              <button
                onClick={scrollToNext}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce"
              >
                <ChevronDown className="w-6 h-6 text-white/50" />
              </button>
            )}

            {/* Slide counter pills */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full transition-all duration-300"
                  style={{ height: i === idx ? '24px' : '6px', background: i === idx ? 'white' : 'rgba(255,255,255,0.25)' }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Appending indicator — shown as the last snap item while new slides load */}
        {appending && (
          <div
            className="relative w-full flex-shrink-0 bg-black flex flex-col items-center justify-center gap-3"
            style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            <Loader2 className="w-7 h-7 animate-spin text-teal-400" />
            <p className="text-white/50 text-sm">Loading fresh slides...</p>
          </div>
        )}
      </div>

      {/* Fixed top-left: back button */}
      <button
        onClick={() => navigate('/parked-thoughts')}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-full pl-2 pr-4 py-2 text-white text-sm font-medium hover:bg-black/60 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Parker
      </button>

      {/* Fixed top-right: mute button */}
      <button
        onClick={handleMuteToggle}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 text-white hover:bg-black/60 transition"
        title={audioStarted ? (muted ? 'Unmute' : 'Mute') : 'Play music'}
      >
        {!audioStarted
          ? <><Volume2 className="w-4 h-4 opacity-50" /><span className="text-xs text-white/50">tap</span></>
          : muted
            ? <VolumeX className="w-4 h-4" />
            : <Volume2 className="w-4 h-4" />
        }
      </button>
    </div>
  );
}
