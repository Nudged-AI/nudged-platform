import React, { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, ExternalLink, BookOpen, ChevronLeft, ChevronRight, X, Target } from 'lucide-react';
import { supabase } from '../supabase';
import type { UserProfile } from '../supabase';
import { TutorialBanner, InfoButton } from '../components/Tutorial';

interface Props {
  userId: string;
  profile?: UserProfile;
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

export default function GoodNewsPage({ userId }: Props) {
  const [visionSections, setVisionSections] = useState<VisionSection[]>([]);
  const [generalNews, setGeneralNews] = useState<NewsItem[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadFromCache();
  }, [userId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const loadFromCache = async () => {
    setLoading(true);
    try {
      // Get active visions first
      const { data: visions } = await supabase
        .from('visions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (!visions?.length) {
        setLoading(false);
        return;
      }

      // Load cache rows for all active visions
      const visionIds = visions.map((v) => v.id);
      const { data: cacheRows } = await supabase
        .from('good_news_cache')
        .select('*')
        .in('vision_id', visionIds)
        .order('generated_at', { ascending: false });

      if (cacheRows && cacheRows.length > 0) {
        // Each row's news_data may be a VisionSection[] or a flat array
        const sections: VisionSection[] = [];
        const allStories: Story[] = [];
        let latestDate = '';
        for (const row of cacheRows) {
          if (row.news_data) {
            if (Array.isArray(row.news_data)) {
              // Could be VisionSection[] or flat NewsItem[]
              const first = row.news_data[0];
              if (first && 'vision_name' in first) {
                sections.push(...(row.news_data as VisionSection[]));
              }
            }
          }
          if (row.stories_data?.length) allStories.push(...(row.stories_data as Story[]));
          if (!latestDate) latestDate = new Date(row.generated_at).toLocaleDateString();
        }
        if (sections.length > 0) {
          setVisionSections(sections);
          setGeneralNews([]);
          if (allStories.length > 0) setStories(allStories);
          setLastGenerated(latestDate);
          setLoading(false);
          return;
        }
      }

      // No valid cache — show empty state, user must click Generate
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const triggerJob = async () => {
    try {
      const { data: visions } = await supabase
        .from('visions').select('id').eq('user_id', userId).eq('status', 'active').limit(1);
      if (!visions?.length) { setJobProgress(null); return; }

      // Create job row
      const { data: job } = await supabase
        .from('good_news_jobs')
        .insert({ user_id: userId, status: 'pending', progress: 0, triggered_by: 'manual' })
        .select('id')
        .single();
      if (!job) return;

      setJobProgress(0);

      // Call edge function (fire and forget — polling tracks progress)
      const { data: { session } } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-good-news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      }).catch(() => {});

      // Poll progress every 3s
      pollRef.current = setInterval(() => pollJob(job.id), 3000);
    } catch (err) { console.error(err); }
  };

  const pollJob = async (jobId: string) => {
    try {
      const { data: job } = await supabase
        .from('good_news_jobs')
        .select('status, progress')
        .eq('id', jobId)
        .maybeSingle();

      if (!job) return;
      setJobProgress(job.progress);

      if (job.status === 'done') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setJobProgress(null);
        await loadFromCache();
      } else if (job.status === 'failed') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setJobProgress(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleReload = async () => {
    if (jobProgress !== null) return; // already running
    setJobProgress(0);
    await triggerJob();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
          <p className="text-sm text-gray-500">Loading your good news…</p>
        </div>
      </div>
    );
  }

  const isGenerating = jobProgress !== null;

  if (visionSections.length === 0 && !isGenerating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Target className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-600 font-semibold">No good news generated yet</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">Add at least one vision to get personalised good news tailored to your journey.</p>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Generate Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TutorialBanner tutorialKey="good_news" />
      {/* Hero image header */}
      <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
        <img
          src="https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              Good News
              <InfoButton text="Curated news, stories, and insights aligned to your visions — refreshed daily to keep you informed and inspired." />
            </h1>
            <p className="text-white/70 text-xs mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
          </div>
          <button
            onClick={handleReload}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-all border border-white/20 backdrop-blur-sm disabled:opacity-60"
          >
            {isGenerating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            {isGenerating ? `${jobProgress}%` : 'Reload'}
          </button>
        </div>
        {lastGenerated && !isGenerating && (
          <p className="absolute top-3 right-4 text-white/40 text-xs">Last: {lastGenerated}</p>
        )}
      </div>

      {/* Progress bar — shown during generation */}
      {isGenerating && (
        <div className="w-full h-1.5 bg-gray-200">
          <div
            className="h-full bg-teal-500 transition-all duration-700 ease-out"
            style={{ width: `${jobProgress}%` }}
          />
        </div>
      )}

      {/* Generating placeholder */}
      {isGenerating && visionSections.length === 0 && (
        <div className="max-w-5xl mx-auto px-4 py-12 text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
          <p className="text-gray-600 font-medium">Curating your personalised good news…</p>
          <p className="text-gray-400 text-sm">This runs in the background — you can navigate away and come back.</p>
          <div className="max-w-sm mx-auto mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span><span>{jobProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-400 rounded-full transition-all duration-700" style={{ width: `${jobProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Vision-specific news sections — shown first */}
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

        {/* Stories — separate section at bottom */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">Stories for Your Journey</h2>
            </div>
            {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
          </div>

          {isGenerating && stories.length === 0 ? (
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
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{item.summary}</p>
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
