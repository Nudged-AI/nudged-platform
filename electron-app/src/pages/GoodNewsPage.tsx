import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, ExternalLink, BookOpen, ChevronLeft, ChevronRight, X, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import type { UserProfile } from '../lib/supabase';

interface Props {
  userId: string;
  profile: UserProfile;
}

interface NewsItem {
  headline: string;
  summary: string;
  timeframe?: string;
  news_type?: string;
  citation_url?: string;
  citation_source?: string;
  action_label?: string;
}

interface VisionSection {
  vision_name: string;
  section_color: string;
  informational: NewsItem[];
  action: NewsItem[];
  quote: { text: string; author: string };
}

interface StoryPage {
  page_number: number;
  content: string;
  image_keyword: string;
}

interface Story {
  id: number;
  title: string;
  person: string;
  tagline: string;
  challenge_category: string;
  source: string;
  thumbnail_keyword: string;
  pages: StoryPage[];
  lesson: string;
}

const PEXELS_STORY_IMAGES: Record<string, string> = {
  money: 'https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=600',
  financial: 'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=600',
  health: 'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=600',
  business: 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=600',
  career: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
  belief: 'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=600',
  family: 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=600',
  time: 'https://images.pexels.com/photos/1600661/pexels-photo-1600661.jpeg?auto=compress&cs=tinysrgb&w=600',
  travel: 'https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg?auto=compress&cs=tinysrgb&w=600',
  education: 'https://images.pexels.com/photos/159775/library-la-trobe-study-students-159775.jpeg?auto=compress&cs=tinysrgb&w=600',
  default: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=600',
};

const NEWS_SECTION_IMAGES = [
  'https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/7413916/pexels-photo-7413916.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=600',
];

function getStoryThumb(keyword: string) {
  const k = keyword.toLowerCase();
  const match = Object.keys(PEXELS_STORY_IMAGES).find((key) => k.includes(key));
  return PEXELS_STORY_IMAGES[match ?? 'default'];
}

const SECTION_COLORS = [
  { bg: 'bg-blue-600', light: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100' },
  { bg: 'bg-teal-600', light: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-700', badge: 'bg-teal-100' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100' },
];

// Story reader modal
function StoryModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const [page, setPage] = useState(0);

  const storyPageImages = [
    'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=800',
  ];

  const totalPages = story.pages?.length ?? 0;
  const currentPage = story.pages?.[page];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Book header */}
        <div className="relative">
          <img
            src={storyPageImages[page % storyPageImages.length]}
            alt=""
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white font-bold text-base leading-tight">{story.title}</p>
            <p className="text-white/70 text-xs mt-0.5">{story.person} · {story.source}</p>
          </div>
        </div>

        {/* Page content */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i === page ? 'bg-teal-600' : i < page ? 'bg-teal-300' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Page {page + 1} of {totalPages}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed min-h-24">
            {currentPage?.content ?? ''}
          </p>
        </div>

        {/* Navigation */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {page === totalPages - 1 ? (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2 text-center flex-1 mx-3">
              <p className="text-xs font-semibold text-teal-700">{story.lesson}</p>
            </div>
          ) : (
            <div className="flex-1 mx-3" />
          )}

          <button
            onClick={() => page < totalPages - 1 ? setPage((p) => p + 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-all"
          >
            {page < totalPages - 1 ? 'Next' : 'Done'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoodNewsPage({ userId, profile }: Props) {
  const [visionSections, setVisionSections] = useState<VisionSection[]>([]);
  const [generalNews, setGeneralNews] = useState<NewsItem[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  useEffect(() => {
    loadGoodNews();
  }, [userId]);

  const loadGoodNews = async (forceRegenerate = false) => {
    setLoading(true);
    try {
      const { data: visions } = await supabase.from('visions').select('id, vision_name, target_date').eq('user_id', userId).eq('status', 'active').order('vision_order');
      if (!visions || visions.length === 0) { setLoading(false); return; }

      // Check cache (unless force regenerate)
      if (!forceRegenerate) {
        const visionId = visions[0].id;
        const { data: cache } = await supabase.from('good_news_cache').select('*').eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).maybeSingle();
        if (cache && cache.news_data?.length > 0) {
          setVisionSections(cache.news_data as VisionSection[]);
          if (cache.stories_data?.length > 0) setStories(cache.stories_data as Story[]);
          setLastGenerated(new Date(cache.generated_at).toLocaleDateString());
          setLoading(false);
          return;
        }
      }

      // Generate fresh
      const allChallenges: string[] = [];
      for (const v of visions) {
        const { data: ch } = await supabase.from('vision_challenges').select('challenge_category, challenge_text, is_starred').eq('vision_id', v.id).limit(10);
        (ch ?? []).forEach((c) => allChallenges.push(c.challenge_text));
      }

      const age = profile.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';
      const allVisionsStr = visions.map((v) => v.vision_name).join(', ');
      const allChallengesStr = allChallenges.slice(0, 15).join('; ');

      // Get ED insight for first vision
      const edResult = await callEDAgent(profile, visions[0].id).catch(() => null);
      const edInsight = edResult ? edResult.stuck_point : '';

      const raw = await callLLM('good_news_full_page', {
        name: profile.full_name, profession: profile.profession, location: '',
        all_visions: allVisionsStr, all_challenges: allChallengesStr,
        ed_agent_insight: edInsight,
      });

      type FullPageResp = { vision_sections: VisionSection[]; general_news: NewsItem[] };
      const parsed = parseJSON<FullPageResp>(raw);
      if (parsed) {
        setVisionSections(parsed.vision_sections ?? []);
        setGeneralNews(parsed.general_news ?? []);

        // Cache it
        await supabase.from('good_news_cache').upsert({
          user_id: userId,
          vision_id: visions[0].id,
          news_data: parsed.vision_sections ?? [],
          stories_data: [],
          generated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }).catch(() => {});

        setLastGenerated(new Date().toLocaleDateString());
      }

      // Load stories separately
      loadStories(allVisionsStr, allChallengesStr, age, visions[0].id, forceRegenerate);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadStories = async (allVisions: string, allChallenges: string, age: string, primaryVisionId: string, force = false) => {
    // Check cache
    if (!force) {
      const { data: cache } = await supabase.from('good_news_cache').select('stories_data').eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).maybeSingle();
      if (cache?.stories_data?.length > 0) {
        setStories(cache.stories_data as Story[]);
        return;
      }
    }

    setLoadingStories(true);
    try {
      const raw = await callLLM('story_5_thumbnails', {
        all_visions: allVisions, all_challenges: allChallenges,
        age, gender: profile.gender, profession: profile.profession,
      });
      type StoriesResp = { stories: Story[] };
      const parsed = parseJSON<StoriesResp>(raw);
      if (parsed?.stories) {
        setStories(parsed.stories.slice(0, 5));
        // Update cache
        await supabase.from('good_news_cache').update({ stories_data: parsed.stories.slice(0, 5) }).eq('user_id', userId).catch(() => {});
      }
    } catch (err) { console.error(err); }
    finally { setLoadingStories(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
          <p className="text-sm text-gray-500">Curating your personal good news…</p>
        </div>
      </div>
    );
  }

  if (visionSections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Target className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">Complete your vision board to see personalised good news here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Masthead */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-900 to-slate-800 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-1">Calm On</p>
              <h1 className="text-3xl font-black text-white tracking-tight">Your Good News</h1>
              <p className="text-slate-400 text-sm mt-1">Curated for your vision journey · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <button
              onClick={() => loadGoodNews(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all border border-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
          {lastGenerated && (
            <p className="text-slate-500 text-xs mt-2">Last generated: {lastGenerated}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Stories Section */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">Stories for Your Journey</h2>
            </div>
            {loadingStories && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
          </div>

          {loadingStories ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="rounded-2xl bg-gray-100 animate-pulse" style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          ) : stories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stories.map((story) => (
                <button
                  key={story.id}
                  onClick={() => setActiveStory(story)}
                  className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left"
                  style={{ aspectRatio: '3/4' }}
                >
                  <img
                    src={getStoryThumb(story.thumbnail_keyword ?? '')}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = PEXELS_STORY_IMAGES.default; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-bold leading-tight line-clamp-2">{story.tagline}</p>
                    <p className="text-white/60 text-xs mt-1">{story.person}</p>
                  </div>
                  <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {story.pages?.length ?? 0}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
              <p className="text-sm text-amber-600">Stories are being curated for your vision journey…</p>
            </div>
          )}
        </section>

        {/* Vision-specific news sections */}
        {visionSections.map((section, si) => {
          const colors = SECTION_COLORS[si % SECTION_COLORS.length];
          return (
            <section key={si}>
              {/* Section header */}
              <div className={`${colors.bg} rounded-2xl px-5 py-4 mb-5`}>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-bold text-white">{section.vision_name}</h2>
                </div>
              </div>

              <div className="space-y-6">
                {/* Informational news */}
                {(section.informational ?? []).length > 0 && (
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${colors.text}`}>Informational</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.informational.map((item, i) => (
                        <NewsCard key={i} item={item} imageIdx={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action news */}
                {(section.action ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3 text-green-700">Action Items</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.action.map((item, i) => (
                        <NewsCard key={i} item={item} imageIdx={i + 2} isAction />
                      ))}
                    </div>
                  </div>
                )}

                {/* Quote */}
                {section.quote && (
                  <div className={`${colors.light} ${colors.border} border rounded-2xl px-5 py-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${colors.text}`}>Wisdom</p>
                    <p className={`text-base font-semibold italic ${colors.text} leading-relaxed`}>"{section.quote.text}"</p>
                    <p className="text-sm text-gray-500 mt-2">— {section.quote.author}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {/* General News */}
        {generalNews.length > 0 && (
          <section>
            <div className="bg-slate-700 rounded-2xl px-5 py-4 mb-5">
              <h2 className="text-lg font-bold text-white">General Good News</h2>
              <p className="text-slate-400 text-xs mt-0.5">Relevant to you and your region</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {generalNews.map((item, i) => (
                <NewsCard key={i} item={item} imageIdx={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      {activeStory && (
        <StoryModal story={activeStory} onClose={() => setActiveStory(null)} />
      )}
    </div>
  );
}

function NewsCard({ item, imageIdx, isAction }: { item: NewsItem; imageIdx: number; isAction?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${isAction ? 'border-green-100' : 'border-gray-100'}`}>
      <img
        src={NEWS_SECTION_IMAGES[imageIdx % NEWS_SECTION_IMAGES.length]}
        alt=""
        className="w-full h-24 object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="p-4">
        {isAction && item.action_label && (
          <div className="mb-2 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg inline-block">
            {item.action_label}
          </div>
        )}
        <p className="text-sm font-bold text-gray-800 leading-snug">{item.headline}</p>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.summary}</p>
        <div className="flex items-center justify-between mt-3">
          {item.timeframe && (
            <span className="text-xs text-gray-400">{item.timeframe}</span>
          )}
          {item.citation_url && (
            <a
              href={item.citation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-600 hover:underline flex items-center gap-0.5 ml-auto"
            >
              {item.citation_source ?? 'Read more'} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
