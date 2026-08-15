import React, { useState, useEffect } from 'react';
import {
  ThumbsUp, Loader2, RefreshCw, Music, ChevronLeft,
  ChevronRight, ExternalLink, Heart,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import type { UserProfile } from '../supabase';
import { TutorialBanner, InfoButton } from '../components/Tutorial';

interface Props {
  userId: string;
  profile: UserProfile;
}

interface Vision {
  id: string;
  vision_name: string;
  target_date: string;
  vision_image_url?: string;
}

interface Habit {
  id: string;
  challenge_category: string;
  habit_text: string;
  habit_type: string;
  thumbs_up: boolean;
  vision_id: string;
  likely_hidden_belief?: string;
  emotional_block?: string;
}

interface NewsItem {
  headline: string;
  summary: string;
  timeframe: string;
  news_type?: string;
  citation_url?: string;
  citation_source?: string;
}

const THEME_IMAGES: Record<string, string> = {
  financial: 'https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=1200',
  health: 'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=1200',
  career: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200',
  business: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=1200',
  family: 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200',
  travel: 'https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg?auto=compress&cs=tinysrgb&w=1200',
  education: 'https://images.pexels.com/photos/159775/library-la-trobe-study-students-159775.jpeg?auto=compress&cs=tinysrgb&w=1200',
  default: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const CATEGORY_QUOTES: Record<string, Array<{ quote: string; author: string; explanation: string }>> = {
  financial: [
    { quote: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin', explanation: 'Every small financial habit you build today compounds into lasting wealth tomorrow.' },
    { quote: 'Do not save what is left after spending; instead spend what is left after saving.', author: 'Warren Buffett', explanation: 'Intentional saving — even tiny amounts — rewires how you relate to money.' },
    { quote: 'Wealth is not about having a lot of money; it is about having a lot of options.', author: 'Chris Rock', explanation: 'Each nudge you act on expands the choices available to future you.' },
  ],
  health: [
    { quote: 'Take care of your body. It\'s the only place you have to live.', author: 'Jim Rohn', explanation: 'Small consistent actions protect your most irreplaceable asset — your physical wellbeing.' },
    { quote: 'The greatest wealth is health.', author: 'Virgil', explanation: 'This nudge builds the foundation everything else in your life rests upon.' },
    { quote: 'A healthy outside starts from the inside.', author: 'Robert Urich', explanation: 'Mindset and daily habits shape your body far more than any single workout.' },
  ],
  career: [
    { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', explanation: 'This nudge helps you align daily actions with the career that truly excites you.' },
    { quote: 'Success is not the key to happiness. Happiness is the key to success.', author: 'Albert Schweitzer', explanation: 'Enjoying the small steps is what sustains progress on the long road ahead.' },
    { quote: 'Opportunities don\'t happen. You create them.', author: 'Chris Grosser', explanation: 'Each small action you take makes you visible to the right people at the right time.' },
  ],
  business: [
    { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain', explanation: 'Momentum is built one decision at a time — this nudge is your next step forward.' },
    { quote: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein', explanation: 'What feels like a block is actually the raw material your breakthrough is made of.' },
    { quote: 'Your most unhappy customers are your greatest source of learning.', author: 'Bill Gates', explanation: 'Staying curious — even about setbacks — is the edge that separates great builders.' },
  ],
  family: [
    { quote: 'In family life, love is the oil that eases friction.', author: 'Friedrich Nietzsche', explanation: 'This nudge nurtures the relationships that give everything else meaning.' },
    { quote: 'Family is not an important thing. It\'s everything.', author: 'Michael J. Fox', explanation: 'Small gestures of presence today create the memories and bonds that last a lifetime.' },
    { quote: 'The bond that links your true family is not one of blood, but of respect and joy.', author: 'Richard Bach', explanation: 'Investing in connection — even briefly each day — pays dividends in trust and love.' },
  ],
  beliefs: [
    { quote: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford', explanation: 'This nudge gently challenges the stories that have been quietly limiting you.' },
    { quote: 'The mind is everything. What you think you become.', author: 'Buddha', explanation: 'Shifting one belief, even slightly, changes the entire trajectory of your actions.' },
    { quote: 'Change your thoughts and you change your world.', author: 'Norman Vincent Peale', explanation: 'Your inner narrative is the script your outer life follows — rewrite it one line at a time.' },
  ],
  default: [
    { quote: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu', explanation: 'This nudge is that step — small, doable, and enough to shift the day in your favour.' },
    { quote: 'Progress, not perfection, is the goal.', author: 'Kathy Freston', explanation: 'Any movement toward your vision — however small — matters more than waiting to be ready.' },
    { quote: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar', explanation: 'Acting on this nudge builds the identity of someone who shows up — day after day.' },
    { quote: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier', explanation: 'Consistency with small nudges is the invisible work behind every big result.' },
    { quote: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', explanation: 'Each nudge you honour strengthens the bridge between where you are and where you want to be.' },
  ],
};

function getQuoteForHabit(category: string, idx: number): { quote: string; author: string; explanation: string } {
  const key = Object.keys(CATEGORY_QUOTES).find((k) => k !== 'default' && category.toLowerCase().includes(k));
  const pool = CATEGORY_QUOTES[key ?? 'default'];
  return pool[idx % pool.length];
}

const NUDGE_BG_COLORS = [
  'from-orange-400 to-orange-300',
  'from-yellow-400 to-yellow-300',
  'from-green-400 to-green-300',
  'from-teal-400 to-teal-300',
  'from-amber-400 to-amber-300',
  'from-lime-400 to-lime-300',
  'from-emerald-400 to-emerald-300',
  'from-orange-500 to-orange-400',
  'from-yellow-500 to-yellow-400',
  'from-green-500 to-green-400',
];

const NUDGE_CARD_IMAGES = [
  'https://images.pexels.com/photos/775201/pexels-photo-775201.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/210243/pexels-photo-210243.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1557652/pexels-photo-1557652.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg?auto=compress&cs=tinysrgb&w=400',
];

const CATEGORY_STORY_IMAGES: Record<string, string> = {
  Money: 'https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=600',
  Financial: 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=600',
  Health: 'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=600',
  Business: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=600',
  Career: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  Fear: 'https://images.pexels.com/photos/1547813/pexels-photo-1547813.jpeg?auto=compress&cs=tinysrgb&w=600',
  Beliefs: 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=600',
  Family: 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=600',
  Time: 'https://images.pexels.com/photos/1600661/pexels-photo-1600661.jpeg?auto=compress&cs=tinysrgb&w=600',
  default: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=600',
};

function getThemeImage(name: string, url?: string) {
  if (url) return url;
  const l = name.toLowerCase();
  if (l.includes('financ') || l.includes('money') || l.includes('wealth')) return THEME_IMAGES.financial;
  if (l.includes('health') || l.includes('fit') || l.includes('weight')) return THEME_IMAGES.health;
  if (l.includes('career') || l.includes('job') || l.includes('promot')) return THEME_IMAGES.career;
  if (l.includes('business') || l.includes('startup') || l.includes('entrepreneur')) return THEME_IMAGES.business;
  if (l.includes('family') || l.includes('child') || l.includes('parent')) return THEME_IMAGES.family;
  if (l.includes('travel') || l.includes('explore')) return THEME_IMAGES.travel;
  if (l.includes('educ') || l.includes('learn') || l.includes('study')) return THEME_IMAGES.education;
  return THEME_IMAGES.default;
}

function getStoryImage(cat: string) {
  const key = Object.keys(CATEGORY_STORY_IMAGES).find((k) => cat.toLowerCase().includes(k.toLowerCase()));
  return CATEGORY_STORY_IMAGES[key ?? 'default'];
}

export default function NudgesPage({ userId, profile }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedVisionId = new URLSearchParams(location.search).get('visionId');

  const [visions, setVisions] = useState<Vision[]>([]);
  const [activeVisionId, setActiveVisionId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [concern, setConcern] = useState('');
  const [concernKey, setConcernKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);
  const [story, setStory] = useState<{ title: string; person: string; story: string; lesson: string; source?: string; category?: string } | null>(null);
  const [edInsight, setEdInsight] = useState('');

  useEffect(() => {
    loadVisions();
  }, [userId]);

  useEffect(() => {
    if (!activeVisionId) return;
    loadHabitsForVision(activeVisionId);
    // Fire ED agent + story in background without blocking nudge display
    callEDAgent(profile, activeVisionId).then((r) => {
      const insight = r ? r.stuck_point + ' ' + (r.root_pattern_summary ?? '') : '';
      setEdInsight(insight);
      loadStoryWithContext(activeVisionId, insight);
    }).catch(() => {
      loadStoryWithContext(activeVisionId, '');
    });
  }, [activeVisionId]);

  const loadVisions = async () => {
    const { data } = await supabase
      .from('visions')
      .select('id, vision_name, target_date, vision_image_url')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('vision_order');
    const v = (data as Vision[]) ?? [];
    setVisions(v);
    if (v.length > 0) {
      const match = preselectedVisionId ? v.find((x) => x.id === preselectedVisionId) : null;
      setActiveVisionId(match ? match.id : v[0].id);
    }
  };

  const loadHabitsForVision = async (vid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('vision_habits')
      .select('*')
      .eq('vision_id', vid)
      .order('sort_order');
    setHabits((data as Habit[]) ?? []);
    setLoading(false);
  };

  const loadStoryWithContext = async (vid: string, insight: string) => {
    setLoadingStory(true);
    try {
      const { data: ch } = await supabase
        .from('vision_challenges')
        .select('challenge_category')
        .eq('vision_id', vid)
        .limit(1);
      const cat = ch?.[0]?.challenge_category ?? 'Beliefs';
      const vision = visions.find((v) => v.id === vid);
      const age = profile.date_of_birth
        ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear())
        : '';
      const raw = await callLLM('story_of_challenge', {
        vision_name: vision?.vision_name ?? '',
        challenge_category: cat,
        concern_text: insight || concern,
        age, gender: profile.gender,
        profession: profile.profession,
        marital_status: profile.marital_status,
        children: String(profile.children),
      });
      type StoryResp = { title: string; person: string; story: string; lesson: string; source?: string };
      const parsed = parseJSON<StoryResp>(raw);
      if (parsed) setStory({ ...parsed, category: cat });
    } catch { /* silent */ }
    finally { setLoadingStory(false); }
  };

  const handleConcernSubmit = async () => {
    if (!activeVisionId || !concern.trim()) return;
    setLoading(true);
    try {
      const { data: ch } = await supabase
        .from('vision_challenges')
        .select('challenge_category, challenge_text, is_starred')
        .eq('vision_id', activeVisionId);
      const vision = visions.find((v) => v.id === activeVisionId);
      const age = profile.date_of_birth
        ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear())
        : '';
      const cats = [...new Set((ch ?? []).map((c) => c.challenge_category))].join(', ');
      const specs = (ch ?? []).filter((c) => c.is_starred).slice(0, 5).map((c) => c.challenge_text).join('; ');
      const raw = await callLLM('habits', {
        name: profile.full_name, age, gender: profile.gender,
        profession_type: profile.profession, job_business_details: profile.job_business_details,
        marital_status: profile.marital_status, children_details: String(profile.children),
        family_dependencies: `${profile.marital_status}, ${profile.children} children`,
        vision_name: vision?.vision_name ?? '', vision_description: '',
        target_date: vision?.target_date ?? '', why_best_suited: '',
        what_if_not_achieved: '',
        challenge_categories: cats,
        specific_challenges: `${specs} - User concern: ${concern}`,
        custom_challenges: '', biggest_fears: concern, avoided_actions: '',
      });
      type HabitResponse = {
        challenge_nudges: Array<{
          nudges: Array<{ nudge: string; nudge_type: string; when_to_flash: string }>;
          challenge_category: string;
          likely_hidden_belief: string;
          emotional_block: string;
        }>;
      };
      const parsed = parseJSON<HabitResponse>(raw);
      if (parsed?.challenge_nudges) {
        await supabase.from('vision_habits').delete().eq('vision_id', activeVisionId);
        const habitRows = parsed.challenge_nudges.flatMap((cat, ci) =>
          cat.nudges.map((n, ni) => ({
            vision_id: activeVisionId, user_id: userId,
            challenge_category: cat.challenge_category, habit_text: n.nudge,
            habit_type: n.nudge_type, when_to_flash: n.when_to_flash,
            likely_hidden_belief: cat.likely_hidden_belief,
            emotional_block: cat.emotional_block, is_custom: false, sort_order: ci * 10 + ni,
          }))
        );
        if (habitRows.length) {
          await supabase.from('vision_habits').insert(habitRows);
          await loadHabitsForVision(activeVisionId);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
    // Refresh story with new concern
    loadStoryWithContext(activeVisionId, edInsight);
    sessionStorage.removeItem(`gratitude_${userId}_${activeVisionId}`);
    setConcernKey((k) => k + 1);
  };

  const thumbUp = async (habit: Habit) => {
    const newVal = !habit.thumbs_up;
    await supabase.from('vision_habits').update({ thumbs_up: newVal }).eq('id', habit.id);
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, thumbs_up: newVal } : h));
  };

  const activeVision = visions.find((v) => v.id === activeVisionId);
  const bgImage = activeVision ? getThemeImage(activeVision.vision_name, activeVision.vision_image_url) : THEME_IMAGES.default;
  const activeIdx = visions.findIndex((v) => v.id === activeVisionId);
  const topHabits = habits.slice(0, 4);

  return (
    <div className="w-full pb-16 relative">
      {/* Watermark background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <img src={bgImage} alt="" className="w-full h-full object-cover" style={{ opacity: 0.06 }} />
      </div>

      {/* Hero header with vision image */}
      <div className="relative w-full overflow-hidden" style={{ height: 130 }}>
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/75" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end justify-between">
          <div>
            <button
              onClick={() => navigate('/vision-board')}
              className="flex items-center gap-1 text-white/80 text-xs font-medium mb-1.5 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Vision Board
            </button>
            <h1 className="text-xl font-black text-white drop-shadow flex items-center gap-2">Get Nudged <InfoButton text="Daily nudges crafted from your vision's challenges and goals — thumb up the ones you love to personalise future nudges." /></h1>
            {activeVision && (
              <p className="text-white/70 text-xs mt-0.5 font-medium">{activeVision.vision_name}</p>
            )}
          </div>
          {/* Vision prev/next */}
          {visions.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setActiveVisionId(visions[(activeIdx - 1 + visions.length) % visions.length].id)}
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveVisionId(visions[(activeIdx + 1) % visions.length].id)}
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* What's on your mind */}
      <div className="mx-4 mt-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-bold text-gray-800 mb-3 text-sm">What is on your mind today?</h2>
        <textarea
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          placeholder="Share what is bothering you or what you want to focus on today..."
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleConcernSubmit}
            disabled={!concern.trim() || loading}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Refreshing…</> : <><RefreshCw className="w-3 h-3" /> Refresh Nudges</>}
          </button>
        </div>
      </div>

      {/* Nudge cards */}
      <div className="mt-5 px-4">
        <div className="flex items-center gap-2 mb-4">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-teal-500" />}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : topHabits.length === 0 ? (
          <div className="bg-white/80 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">Complete your vision board first to see personalised nudges here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topHabits.map((habit, idx) => {
              const q = getQuoteForHabit(habit.challenge_category, idx);
              return (
                <div
                  key={habit.id}
                  className="bg-white rounded-2xl shadow-sm border-2 border-teal-500 overflow-hidden"
                >
                  <div className="p-4 flex flex-col gap-3">
                    {/* Embedded quote */}
                    <div className="bg-teal-50 border border-teal-100 rounded-xl px-3.5 py-3 space-y-1.5">
                      <p className="text-teal-800 text-xs font-semibold italic leading-snug">"{q.quote}"</p>
                      <p className="text-teal-600 text-xs font-bold">— {q.author}</p>
                      <p className="text-gray-600 text-xs leading-relaxed mt-1">{q.explanation}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-0.5 font-semibold">
                        {habit.challenge_category}
                      </span>
                      <button
                        onClick={() => thumbUp(habit)}
                        className={`p-1.5 rounded-xl border transition-all ${habit.thumbs_up ? 'bg-teal-100 text-teal-700 border-teal-300' : 'border-gray-200 text-gray-400 hover:text-teal-600 hover:border-teal-300'}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Gratitude Corner */}
      {activeVisionId && (
        <div className="mt-6 px-4">
          <TutorialBanner tutorialKey="vision_board_nudges" />
          <GratitudeCorner userId={userId} profile={profile} visionId={activeVisionId} edInsight={edInsight} concern={concern} concernKey={concernKey} />
        </div>
      )}

      {/* Story for Your Journey */}      <div className="mt-6 px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">2</div>
          <h2 className="font-bold text-gray-900">Story for Your Journey</h2>
          <button
            onClick={() => activeVisionId && loadStoryWithContext(activeVisionId, edInsight)}
            disabled={loadingStory}
            className="ml-auto text-xs text-teal-600 hover:underline flex items-center gap-1 font-medium"
          >
            {loadingStory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingStory ? (
            <div>
              <div className="h-28 bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
              </div>
            </div>
          ) : story ? (
            <div>
              <img
                src={getStoryImage(story.category ?? '')}
                alt=""
                className="w-full h-28 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="p-4">
                <p className="text-sm font-bold text-gray-800 leading-snug">
                  How {story.person} {story.title.toLowerCase()}
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{story.story}</p>
                <div className="mt-3 bg-teal-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-teal-700 font-semibold">{story.lesson}</p>
                </div>
                {story.source && (
                  <p className="text-xs text-gray-400 mt-2">Source: {story.source}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 text-center">
              <p className="text-sm text-gray-400">Generating your story…</p>
            </div>
          )}
        </div>
      </div>

      {/* Good News */}
      {activeVisionId && activeVision && (
        <div className="mt-6 px-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</div>
            <h2 className="font-bold text-gray-900">Good News</h2>
          </div>
          <GoodNewsSection
            visionId={activeVisionId}
            visionName={activeVision.vision_name}
            profile={profile}
          />
        </div>
      )}

      {/* Meditation placeholder */}
      <div className="mt-4 mx-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Music className="w-6 h-6 text-teal-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-xs font-bold">4</div>
              <p className="text-sm font-bold text-gray-800">Meditation</p>
            </div>
            <p className="text-xs text-gray-500">Guided audio sessions — coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const GRATITUDE_NATURE_IMAGES = [
  'https://images.pexels.com/photos/158471/ibis-bird-red-animals-158471.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/462118/pexels-photo-462118.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1366909/pexels-photo-1366909.jpeg?auto=compress&cs=tinysrgb&w=600',
];

function GratitudeCorner({
  userId, profile, visionId, edInsight, concern, concernKey,
}: {
  userId: string; profile: UserProfile; visionId: string; edInsight: string; concern: string; concernKey: number;
}) {
  const [gratitudes, setGratitudes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem(`gratitude_${userId}_${visionId}`);
    if (cached && concernKey === 0) { try { setGratitudes(JSON.parse(cached)); return; } catch { /* regenerate */ } }
    generate();
  }, [visionId, concernKey]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data: challenges } = await supabase
        .from('vision_challenges')
        .select('challenge_text, is_starred')
        .eq('vision_id', visionId)
        .limit(8);
      const { data: wiseHistory } = await supabase
        .from('wise_advice_messages')
        .select('content, role')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      const challengeTexts = (challenges ?? []).slice(0, 5).map((c) => c.challenge_text).join('; ');
      const wiseContext = (wiseHistory ?? []).filter((m) => m.role === 'user').slice(0, 3).map((m) => m.content).join('; ');
      const age = profile.date_of_birth
        ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const raw = await callLLM('gratitude_corner', {
        name: profile.full_name, age, gender: profile.gender,
        profession: profile.profession, marital_status: profile.marital_status,
        children: String(profile.children),
        challenges: challengeTexts,
        ed_insight: edInsight,
        concern: concern,
        wise_context: wiseContext,
      });
      const parsed = parseJSON<string[]>(raw);
      if (parsed && Array.isArray(parsed)) {
        const items = parsed.slice(0, 3);
        setGratitudes(items);
        sessionStorage.setItem(`gratitude_${userId}_${visionId}`, JSON.stringify(items));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-rose-400 text-white flex items-center justify-center">
          <Heart className="w-3.5 h-3.5" fill="white" />
        </div>
        <h2 className="font-bold text-gray-900">My Gratitude Corner</h2>
        <button
          onClick={() => { sessionStorage.removeItem(`gratitude_${userId}_${visionId}`); generate(); }}
          disabled={loading}
          className="ml-auto text-xs text-teal-600 hover:underline flex items-center gap-1 font-medium"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gratitudes.map((g, i) => (
            <div key={i} className="relative bg-white rounded-2xl shadow-sm overflow-hidden border border-rose-100">
              <img
                src={GRATITUDE_NATURE_IMAGES[i % GRATITUDE_NATURE_IMAGES.length]}
                alt=""
                className="w-full h-20 object-cover"
                style={{ opacity: 0.55 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
              <div className="relative px-4 pt-1 pb-4">
                <Heart className="w-4 h-4 text-rose-400 mb-1.5" fill="currentColor" />
                <p className="text-sm text-gray-800 leading-relaxed font-medium italic">"{g}"</p>
              </div>
            </div>
          ))}
          {gratitudes.length === 0 && !loading && (
            <p className="text-sm text-gray-400 col-span-3 py-4">Generating your gratitude moments…</p>
          )}
        </div>
      )}
    </div>
  );
}

function GoodNewsSection({
  visionId, visionName, profile,
}: {
  visionId: string; visionName: string; profile: UserProfile;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [visionId]);

  const load = async () => {
    setLoading(true);
    try {
      // Try cache (stored per user_id by edge function, look up by user_id via any vision)
      const { data: cached } = await supabase
        .from('good_news_cache')
        .select('news_data')
        .eq('vision_id', visionId)
        .maybeSingle();
      if (cached?.news_data && Array.isArray(cached.news_data)) {
        type VisionSection = { vision_name?: string; informational?: NewsItem[]; action?: NewsItem[] };
        const sections = cached.news_data as (VisionSection | NewsItem)[];
        if (sections.length > 0) {
          const first = sections[0];
          if ('informational' in first || 'action' in first) {
            // VisionSection[] format from edge function
            const flat: NewsItem[] = [];
            for (const s of sections as VisionSection[]) {
              flat.push(...(s.informational ?? []), ...(s.action ?? []));
            }
            if (flat.length) { setItems(flat.slice(0, 3)); setLoading(false); return; }
          } else if ('headline' in first) {
            // Flat NewsItem[] format
            setItems((sections as NewsItem[]).slice(0, 3));
            setLoading(false);
            return;
          }
        }
      }
      // Fallback: generate inline (only 3 items, quick)
      const { data: ch } = await supabase
        .from('vision_challenges')
        .select('challenge_category')
        .eq('vision_id', visionId)
        .limit(1);
      const cat = ch?.[0]?.challenge_category ?? 'Beliefs';
      const age = profile.date_of_birth
        ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear())
        : '';
      const raw = await callLLM('good_news', {
        vision_name: visionName, challenge_category: cat, concern_text: '',
        name: profile.full_name,
        user_context: `${profile.profession}, ${age} years old, ${profile.marital_status}`,
      });
      const parsed = parseJSON<NewsItem[]>(raw);
      if (parsed) setItems(parsed.slice(0, 3));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const newsImages = [
    'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/7413916/pexels-photo-7413916.jpeg?auto=compress&cs=tinysrgb&w=400',
  ];

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((item, i) => (
        <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <img
            src={newsImages[i % newsImages.length]}
            alt=""
            className="w-full h-20 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="p-3">
            {item.news_type && (
              <span className={`inline-block mb-1.5 text-xs rounded-full px-2 py-0.5 font-medium ${item.news_type === 'informational' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {item.news_type === 'informational' ? 'Info' : 'Action'}
              </span>
            )}
            <p className="text-xs font-bold text-gray-800 leading-snug">{item.headline}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.summary}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5 font-medium">{item.timeframe}</span>
              {item.citation_url && (
                <a
                  href={item.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline flex items-center gap-0.5"
                >
                  {item.citation_source ?? 'Source'} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-gray-400 col-span-3">No news available right now.</p>
      )}
    </div>
  );
}
