import React, { useState, useEffect } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Star, Target,
  CreditCard as Edit2, Trash2, Loader2, CheckCircle2, Bell, Brain, Award, Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import type { UserProfile } from '../supabase';

interface Props {
  userId: string;
  profile: UserProfile;
  onAddVision: () => void;
  onEditVision: (visionId: string) => void;
}

interface Vision {
  id: string;
  vision_name: string;
  vision_description: string;
  vision_image_url: string;
  target_date: string;
  why_best_suited: string;
  for_whom: string[];
  what_if_not_achieved: string;
  calm_points: number;
  created_at: string;
}

interface RoadmapStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  target_period: string;
  status: 'completed' | 'in_progress' | 'upcoming';
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

const MILESTONE_IMAGES = [
  'https://images.pexels.com/photos/1051838/pexels-photo-1051838.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/1600661/pexels-photo-1600661.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=200',
];

function getThemeImage(visionName: string, imageUrl?: string) {
  if (imageUrl) return imageUrl;
  const l = visionName.toLowerCase();
  if (l.includes('financ') || l.includes('money') || l.includes('wealth')) return THEME_IMAGES.financial;
  if (l.includes('health') || l.includes('fit') || l.includes('weight')) return THEME_IMAGES.health;
  if (l.includes('career') || l.includes('job') || l.includes('promot')) return THEME_IMAGES.career;
  if (l.includes('business') || l.includes('startup') || l.includes('entrepreneur')) return THEME_IMAGES.business;
  if (l.includes('family') || l.includes('child') || l.includes('parent')) return THEME_IMAGES.family;
  if (l.includes('travel') || l.includes('explore')) return THEME_IMAGES.travel;
  if (l.includes('educ') || l.includes('learn') || l.includes('study')) return THEME_IMAGES.education;
  return THEME_IMAGES.default;
}

function MedalBoard({ visionId, userId }: { visionId: string; userId: string }) {
  const [raised, setRaised] = useState(0);
  const [closed, setClosed] = useState(0);
  const [thoughts, setThoughts] = useState(0);
  const [successTasks, setSuccessTasks] = useState(0);

  useEffect(() => {
    supabase.from('vision_challenges').select('id, is_closed').eq('vision_id', visionId).then(({ data }) => {
      setRaised(data?.length ?? 0);
      setClosed(data?.filter((d) => d.is_closed).length ?? 0);
    });
    supabase.from('parked_thoughts').select('id', { count: 'exact', head: true }).eq('vision_id', visionId).then(({ count }) => {
      setThoughts(count ?? 0);
    });
    supabase.from('vision_success_tasks').select('id', { count: 'exact', head: true }).eq('vision_id', visionId).eq('verified', true).then(({ count }) => {
      setSuccessTasks(count ?? 0);
    });
  }, [visionId]);

  const rate = raised > 0 ? Math.round((closed / raised) * 100) : 0;
  const items = [
    { label: 'Challenges', value: raised, color: 'bg-blue-50 text-blue-700', icon: Target },
    { label: 'Closed', value: closed, color: 'bg-teal-50 text-teal-700', icon: CheckCircle2 },
    { label: 'Success Tasks', value: successTasks, color: 'bg-green-50 text-green-700', icon: Award },
    { label: 'Calm Points', value: (closed * 20) + (successTasks * 10), color: 'bg-amber-50 text-amber-700', icon: Star },
    { label: 'Thoughts', value: thoughts, color: 'bg-purple-50 text-purple-700', icon: Brain },
    { label: 'Success %', value: `${rate}%`, color: 'bg-rose-50 text-rose-700', icon: Target },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className={`rounded-2xl px-2 py-3 ${color} flex flex-col items-center text-center`}>
          <Icon className="w-4 h-4 mb-1 opacity-60" />
          <p className="text-base font-bold">{value}</p>
          <p className="text-xs font-medium opacity-70 mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

// Gallery frame for the corkboard view
function VisionFrame({ vision, onClick }: { vision: Vision; onClick: () => void }) {
  const img = getThemeImage(vision.vision_name, vision.vision_image_url);
  return (
    <button
      onClick={onClick}
      className="relative group w-full aspect-[4/3] sm:aspect-[3/4] rounded-2xl overflow-hidden border-4 border-white shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 focus:outline-none"
      style={{ background: '#1a1a1a' }}
    >
      <img src={img} alt={vision.vision_name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {/* Pin decoration */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-amber-400 shadow-md border-2 border-amber-300" />
      <div className="absolute inset-2 border border-white/15 rounded-xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-black text-base leading-tight drop-shadow-lg">{vision.vision_name}</p>
        {vision.target_date && (
          <p className="text-white/60 text-xs mt-1">
            Target: {new Date(vision.target_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      {/* Hover arrow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
          <ChevronRight className="w-5 h-5 text-white" />
        </div>
      </div>
    </button>
  );
}

export default function VisionBoardViewPage({ userId, profile: _profile, onAddVision, onEditVision }: Props) {
  const navigate = useNavigate();
  const [visions, setVisions] = useState<Vision[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [roadmaps, setRoadmaps] = useState<Record<string, RoadmapStep[]>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { loadVisions(); }, [userId]);

  useEffect(() => {
    if (selectedIdx !== null) {
      const v = visions[selectedIdx];
      if (v && !roadmaps[v.id]) loadRoadmap(v.id);
    }
  }, [selectedIdx, visions]);

  const loadVisions = async () => {
    setLoading(true);
    const { data } = await supabase.from('visions').select('*').eq('user_id', userId).eq('status', 'active').order('vision_order');
    setVisions((data as Vision[]) ?? []);
    setLoading(false);
  };

  const loadRoadmap = async (vid: string) => {
    const { data } = await supabase.from('vision_roadmap').select('*').eq('vision_id', vid).order('step_number');
    if (data) setRoadmaps((prev) => ({ ...prev, [vid]: data as RoadmapStep[] }));
  };

  const deleteVision = async (id: string) => {
    await supabase.from('visions').update({ status: 'archived' }).eq('id', id);
    setConfirmDeleteId(null);
    setSelectedIdx(null);
    await loadVisions();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>;
  }

  // ── GALLERY VIEW ──────────────────────────────────────────────────────────
  if (selectedIdx === null) {
    return (
      <div className="w-full max-w-full min-h-screen" style={{ background: '#f5f0e8' }}>
        {/* Corkboard header */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>My Vision Board</h1>
            <p className="text-sm text-amber-700 font-medium mt-0.5">Stay focused. Take action. Live your dreams.</p>
          </div>
          <button
            onClick={onAddVision}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Vision
          </button>
        </div>

        {visions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Target className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-gray-800">No visions yet</p>
            <p className="text-sm text-gray-500 text-center">Create your first vision to get started.</p>
            <button onClick={onAddVision} className="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all">
              <Plus className="w-4 h-4" /> Add Vision
            </button>
          </div>
        ) : (
          <div className="px-5 pb-10">
            {/* Corkboard frame */}
            <div
              className="relative rounded-3xl p-5 border-8 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #c8a96e 0%, #b8945a 50%, #a07840 100%)',
                borderColor: '#8b6914',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              {/* Cork texture overlay */}
              <div className="absolute inset-0 rounded-2xl opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' }}
              />
              <div className={`relative grid gap-4 ${visions.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-1 sm:grid-cols-3'}`}>
                {visions.map((v, i) => (
                  <VisionFrame key={v.id} vision={v} onClick={() => setSelectedIdx(i)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  const vision = visions[selectedIdx];
  const heroImage = getThemeImage(vision.vision_name, vision.vision_image_url);
  const steps = roadmaps[vision.id] ?? [];
  const completedSteps = steps.filter((s) => s.status === 'completed').length;

  const statusBg: Record<string, string> = {
    completed: 'ring-2 ring-teal-500',
    in_progress: 'ring-2 ring-blue-500',
    upcoming: 'ring-1 ring-gray-200',
  };
  const statusLabel: Record<string, string> = {
    completed: 'text-teal-700 bg-teal-100',
    in_progress: 'text-blue-700 bg-blue-100',
    upcoming: 'text-gray-500 bg-gray-100',
  };

  return (
    <div className="w-full max-w-full relative">
      {/* Watermark background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <img src={heroImage} alt="" className="w-full h-full object-cover" style={{ opacity: 0.06 }} />
      </div>

      {/* Hero banner with vision image */}
      <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
        <img src={heroImage} alt={vision.vision_name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/75" />

        {/* Back button */}
        <button
          onClick={() => setSelectedIdx(null)}
          className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-black/50 transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> All Visions
        </button>

        {/* Vision toggle */}
        {visions.length > 1 && (
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setSelectedIdx((i) => (i! - 1 + visions.length) % visions.length)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedIdx((i) => (i! + 1) % visions.length)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Vision title */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-black text-white drop-shadow-lg">{vision.vision_name}</h1>
              {vision.target_date && (
                <p className="text-white/70 text-xs mt-0.5">
                  Target: {new Date(vision.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEditVision(vision.id)}
                className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white/30 transition-all border border-white/20"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => setConfirmDeleteId(vision.id)}
                className="flex items-center gap-1.5 bg-red-500/70 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-red-600/80 transition-all"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-6 pb-16">
        {/* Medal board */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">My Medal Board</h2>
            <span className="text-xs text-gray-400">Last 1 Month</span>
          </div>
          <MedalBoard visionId={vision.id} userId={userId} />
        </div>

        {/* Roadmap */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">My Roadmap</h2>
            {steps.length > 0 && <span className="text-xs text-gray-400">{completedSteps}/{steps.length} done</span>}
          </div>

          {steps.length === 0 ? (
            <div className="bg-white/80 rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-sm text-gray-400">Roadmap not generated yet.</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="relative h-1.5 bg-gray-200 rounded-full mb-4">
                <div
                  className="absolute left-0 top-0 h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${steps.length > 0 ? (completedSteps / steps.length) * 100 : 0}%` }}
                />
              </div>
              {/* Milestone scroll */}
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {steps.map((step, i) => (
                  <div key={step.id} className="flex-shrink-0 flex flex-col items-center gap-2 w-20">
                    <div className={`relative w-16 h-16 rounded-2xl overflow-hidden ${statusBg[step.status]}`}>
                      <img
                        src={MILESTONE_IMAGES[i % MILESTONE_IMAGES.length]}
                        alt={step.title}
                        className={`w-full h-full object-cover ${step.status === 'upcoming' ? 'opacity-40 grayscale' : ''}`}
                      />
                      {step.status === 'completed' && (
                        <div className="absolute inset-0 bg-teal-500/30 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                      )}
                      {step.status === 'in_progress' && (
                        <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                      )}
                    </div>
                    <p className="text-center text-xs font-semibold text-gray-700 leading-tight line-clamp-2">{step.title}</p>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusLabel[step.status]}`}>
                      {step.status === 'in_progress' ? 'Active' : step.status === 'completed' ? 'Done' : 'Soon'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Get Nudged CTA */}
        <button
          onClick={() => navigate(`/nudges?visionId=${vision.id}`)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-2xl text-base font-bold hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-200"
        >
          <Bell className="w-5 h-5" /> Get Nudged
        </button>

        {/* Earn Medal */}
        <EarnMedal visionId={vision.id} userId={userId} profile={_profile} roadmapSteps={steps} />
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Vision?</h3>
            <p className="text-sm text-gray-500 mb-6">This will archive "{vision.vision_name}". This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={() => deleteVision(confirmDeleteId)} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EarnMedal({ visionId, userId, profile, roadmapSteps }: {
  visionId: string; userId: string; profile: UserProfile; roadmapSteps: RoadmapStep[];
}) {
  const [taskText, setTaskText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ approved: boolean; message: string } | null>(null);

  const submit = async () => {
    if (!taskText.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const { data: visionData } = await supabase.from('visions').select('vision_name, vision_description').eq('id', visionId).single();
      const { data: challenges } = await supabase.from('vision_challenges').select('challenge_text').eq('vision_id', visionId).limit(8);
      const roadmapStr = roadmapSteps.map((s) => `${s.step_number}. ${s.title}`).join('; ');
      const challengeStr = (challenges ?? []).map((c) => c.challenge_text).join('; ');

      const raw = await callLLM('earn_medal_verify', {
        vision_name: visionData?.vision_name ?? '',
        vision_description: visionData?.vision_description ?? '',
        roadmap_steps: roadmapStr,
        challenges: challengeStr,
        task_text: taskText.trim(),
      });

      type VerifyResp = { approved: boolean; message: string };
      const parsed = parseJSON<VerifyResp>(raw);
      const approved = parsed?.approved === true;
      const message = parsed?.message ?? (approved ? 'Great work!' : 'This does not quite align with your vision yet.');

      if (approved) {
        await supabase.from('vision_success_tasks').insert({
          user_id: userId, vision_id: visionId, task_text: taskText.trim(), verified: true, verification_note: message,
        });
        setTaskText('');
      }
      setResult({ approved, message });
    } catch {
      setResult({ approved: false, message: 'Could not verify right now. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800">Earn a Medal</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">Describe a step forward you took toward this vision. Our AI will verify it and award you a Success Task medal.</p>
      <textarea
        value={taskText}
        onChange={(e) => setTaskText(e.target.value)}
        placeholder="e.g. I saved Rs 2,000 today and opened a SIP account…"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
      />
      {result && (
        <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${result.approved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {result.approved && <Award className="w-4 h-4 inline mr-1.5 mb-0.5" />}
          {result.message}
        </div>
      )}
      <div className="flex justify-end mt-3">
        <button
          onClick={submit}
          disabled={!taskText.trim() || submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-xl text-sm font-bold hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 transition-all shadow-sm"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
          Earn Medal
        </button>
      </div>
    </div>
  );
}
