import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Image as ImageIcon, Calendar, Loader2, Plus, X,
  Star, Upload, ChevronLeft, CreditCard as Edit2, Target, CheckCircle2, Circle,
  AlertCircle,
} from 'lucide-react';
import { supabase, type UserProfile } from '../supabase';
import { callLLM, parseJSON } from '../lib/llm';
import { callEDAgent } from '../lib/ed-agent';
import { TutorialBanner } from '../components/Tutorial';

interface Props {
  userId: string;
  profile: UserProfile;
  visionId?: string;
  onComplete: () => void;
  onBack: () => void;
}

interface VisionRow {
  id: string;
  vision_name: string;
  vision_description: string;
  vision_image_url: string;
  target_date: string;
  why_best_suited: string;
  for_whom: string[];
  for_whom_custom: string;
  what_if_not_achieved: string;
  ideal_person: string;
  content_interests: string;
  current_behaviour_pattern: string;
  distraction_pattern: string;
  fitb_responses: FITBResponse[];
}

interface FITBBlank {
  sentence_stem: string;
  placeholder: string;
  suggestions: string[];
  field_key: string;
  optional?: boolean;
}

interface FITBResponse {
  field_key: string;
  value: string;
}

interface ChallengeRow {
  id?: string;
  challenge_category: string;
  challenge_text: string;
  is_llm_suggested: boolean;
  is_starred: boolean;
  is_closed: boolean;
  is_selected: boolean;
}

interface BlockerRow {
  id?: string;
  blocker_type: 'stuck' | 'postpone';
  blocker_text: string;
  is_llm_suggested: boolean;
  is_checked: boolean;
  is_starred: boolean;
  is_resolved: boolean;
}

interface RoadmapStep {
  step_number: number;
  title: string;
  description: string;
  target_period: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  is_user_edited?: boolean;
  sub_milestones: string[];
}

const FOR_WHOM_OPTIONS = ['Self', 'Children', 'Spouse', 'Parents', 'My Family', 'Others'];

const CAT_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
  { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100' },
];

function StepIndicator({ current }: { current: number }) {
  const steps = ['Build Your Vision', 'Challenges', 'Roadmap'];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done ? 'bg-teal-600 border-teal-600 text-white' : active ? 'border-teal-600 text-teal-600 bg-white' : 'border-gray-200 text-gray-400 bg-white'}`}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${active ? 'text-teal-700' : done ? 'text-teal-500' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-0.5 rounded-full min-w-4 transition-all ${done ? 'bg-teal-600' : 'bg-gray-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── FITB Component ────────────────────────────────────────────────────────────

function FITBSection({
  visionName, profile, onComplete, existingResponses,
}: {
  visionName: string;
  profile: UserProfile;
  onComplete: (responses: FITBResponse[]) => void;
  existingResponses: FITBResponse[];
}) {
  const [blanks, setBlanks] = useState<FITBBlank[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [intro, setIntro] = useState('');

  useEffect(() => {
    if (existingResponses.length > 0) {
      const map: Record<string, string> = {};
      existingResponses.forEach((r) => { map[r.field_key] = r.value; });
      setResponses(map);
    }
    generateFITB();
  }, [visionName]);

  const age = profile.date_of_birth
    ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';

  const generateFITB = async () => {
    if (!visionName.trim()) return;
    setLoading(true);
    try {
      const raw = await callLLM('vision_fitb', {
        name: profile.full_name, age, gender: profile.gender,
        profession: profile.profession, job_business_details: profile.job_business_details,
        marital_status: profile.marital_status, children: String(profile.children),
        location: '',
        vision_name: visionName,
      });
      type FITBResp = { intro: string; blanks: FITBBlank[] };
      const parsed = parseJSON<FITBResp>(raw);
      if (parsed) {
        setIntro(parsed.intro);
        setBlanks(parsed.blanks ?? []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = () => {
    const result: FITBResponse[] = blanks.map((b) => ({
      field_key: b.field_key,
      value: responses[b.field_key] ?? '',
    }));
    onComplete(result);
  };

  const allFilled = blanks.filter((b) => !b.optional).every((b) => (responses[b.field_key] ?? '').trim());

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl p-6 border border-teal-100 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
        <p className="text-sm text-teal-700 font-medium">Personalising your vision questions…</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 rounded-2xl border border-teal-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-5 py-4">
        <h3 className="text-white font-bold text-base">Tell me more about your vision</h3>
        {intro && <p className="text-teal-100 text-xs mt-1">{intro}</p>}
      </div>
      <div className="p-5 space-y-5">
        {blanks.map((blank) => (
          <div key={blank.field_key} className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">
              {blank.sentence_stem}{' '}
              <span className="text-teal-600 italic">{blank.optional ? '(optional)' : '*'}</span>
            </p>
            <div className="relative">
              <input
                type="text"
                value={responses[blank.field_key] ?? ''}
                onChange={(e) => setResponses((prev) => ({ ...prev, [blank.field_key]: e.target.value }))}
                placeholder={blank.placeholder}
                className="w-full border-2 border-teal-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 bg-white shadow-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {blank.suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setResponses((prev) => ({ ...prev, [blank.field_key]: s }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    responses[blank.field_key] === s
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-teal-700 border-teal-200 hover:border-teal-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={handleSubmit}
          disabled={!allFilled}
          className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:from-teal-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-md"
        >
          {allFilled ? 'Continue to your vision details →' : 'Fill in the required fields above'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({
  profile, vision, setVision, actionsText, setActionsText, onFITBComplete,
}: {
  profile: UserProfile;
  vision: Partial<VisionRow>;
  setVision: (v: Partial<VisionRow>) => void;
  actionsText: string;
  setActionsText: (s: string) => void;
  onFITBComplete: (responses: FITBResponse[]) => void;
}) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fitbDone, setFitbDone] = useState((vision.fitb_responses ?? []).length > 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof VisionRow, val: string | string[] | FITBResponse[]) =>
    setVision({ ...vision, [key]: val });

  const toggleForWhom = (opt: string) => {
    const cur = vision.for_whom ?? [];
    set('for_whom', cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `vision-images/${profile.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('vision-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('vision-assets').getPublicUrl(path);
      set('vision_image_url', publicUrl);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const charCount = (val?: string, max = 250) => `${(val ?? '').length} / ${max}`;

  const handleFITBComplete = (responses: FITBResponse[]) => {
    set('fitb_responses', responses);
    setFitbDone(true);
    onFITBComplete(responses);
  };

  const hasVisionName = (vision.vision_name ?? '').trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Vision Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          1. Vision Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={vision.vision_name ?? ''}
          onChange={(e) => {
            set('vision_name', e.target.value);
            if (fitbDone) setFitbDone(false);
          }}
          placeholder="e.g. Financial Freedom"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {hasVisionName && !fitbDone && (
          <button
            type="button"
            onClick={() => {}}
            className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all"
          >
            Proceed →
          </button>
        )}
      </div>

      {/* FITB Section - appears after vision name entered */}
      {hasVisionName && !fitbDone && (
        <FITBSection
          visionName={vision.vision_name ?? ''}
          profile={profile}
          onComplete={handleFITBComplete}
          existingResponses={vision.fitb_responses ?? []}
        />
      )}

      {/* Show completed FITB summary */}
      {fitbDone && (vision.fitb_responses ?? []).length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-teal-700">Vision details captured</p>
            <p className="text-xs text-teal-600 mt-0.5">
              {(vision.fitb_responses ?? []).filter((r) => r.value).map((r) => r.value).join(' • ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFitbDone(false)}
            className="text-xs text-teal-600 hover:underline"
          >
            Edit
          </button>
        </div>
      )}

      {/* Rest of the form - only visible after FITB complete */}
      {(fitbDone || (vision.fitb_responses ?? []).length > 0) && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vision Image <span className="text-xs text-gray-400 font-normal">(JPG/PNG, landscape)</span>
            </label>
            {vision.vision_image_url ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/7' }}>
                <img src={vision.vision_image_url} alt="Vision" className="w-full h-full object-cover" />
                <button
                  onClick={() => { set('vision_image_url', ''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingImage}
                className="w-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-teal-400 bg-gray-50 flex flex-col items-center justify-center gap-2 py-10 transition-all"
                style={{ aspectRatio: '16/7', minHeight: 120 }}
              >
                {uploadingImage ? <Loader2 className="w-6 h-6 text-teal-500 animate-spin" /> : (
                  <><Upload className="w-6 h-6 text-gray-400" /><span className="text-sm text-gray-500">Upload landscape image</span><span className="text-xs text-gray-400">JPG or PNG</span></>
                )}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleImageUpload} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              2. When to achieve? <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={vision.target_date ?? ''}
                onChange={(e) => set('target_date', e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              3. Why are you best suited for this vision? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={vision.why_best_suited ?? ''}
              onChange={(e) => set('why_best_suited', e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="What makes you uniquely capable of achieving this?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{charCount(vision.why_best_suited)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              4. For whom? <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FOR_WHOM_OPTIONS.map((opt) => {
                const selected = (vision.for_whom ?? []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleForWhom(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selected ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {(vision.for_whom ?? []).includes('Others') && (
              <input
                type="text"
                value={vision.for_whom_custom ?? ''}
                onChange={(e) => set('for_whom_custom', e.target.value)}
                placeholder="Specify others..."
                className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              5. Will you still follow the vision if your friends and family are not there?
            </label>
            <div className="flex gap-3">
              {['Yes', 'No', 'Maybe'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('current_behaviour_pattern', opt)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${vision.current_behaviour_pattern === opt ? 'bg-teal-50 border-teal-500 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-teal-200'}`}
                >
                  {vision.current_behaviour_pattern === opt && <Check className="w-3.5 h-3.5" />}
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              6. What will happen if you don't achieve the vision? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={vision.what_if_not_achieved ?? ''}
              onChange={(e) => set('what_if_not_achieved', e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="What will you lose? What won't change?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{charCount(vision.what_if_not_achieved)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              7. Who or what do you idolize in the path of achieving the vision?
            </label>
            <textarea
              value={vision.ideal_person ?? ''}
              onChange={(e) => set('ideal_person', e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="A person, book, or philosophy that inspires you..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{charCount(vision.ideal_person)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              8. Who or what do you like to hear or read about in the way of achieving your vision?
            </label>
            <textarea
              value={vision.content_interests ?? ''}
              onChange={(e) => set('content_interests', e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="Podcasts, books, YouTube channels, newsletters, thought leaders..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{charCount(vision.content_interests)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              9. In the last 30 days, what actions did you take to achieve the vision?
            </label>
            <textarea
              value={actionsText}
              onChange={(e) => setActionsText(e.target.value)}
              rows={4}
              placeholder="Describe the actions you have taken in the last 30 days toward this vision..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({
  profile, vision, challenges, setC, blockers, setBlockers, edInsight,
}: {
  profile: UserProfile;
  vision: Partial<VisionRow>;
  challenges: ChallengeRow[];
  setC: (c: ChallengeRow[]) => void;
  blockers: BlockerRow[];
  setBlockers: (b: BlockerRow[]) => void;
  edInsight: string;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingChallenges, setLoadingChallenges] = useState<Record<string, boolean>>({});
  const [loadingStuck, setLoadingStuck] = useState(false);
  const [loadingPostpone, setLoadingPostpone] = useState(false);
  const [postponeYes, setPostponeYes] = useState<boolean | null>(null);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [customStuckInput, setCustomStuckInput] = useState('');
  const [customPostponeInput, setCustomPostponeInput] = useState('');
  const [closingChallenge, setClosingChallenge] = useState<string | null>(null);

  const age = profile.date_of_birth
    ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';

  const baseVars = {
    name: profile.full_name, age, gender: profile.gender,
    profession: profile.profession, job_business_details: profile.job_business_details,
    marital_status: profile.marital_status, children: String(profile.children),
    family_dependencies: `${profile.marital_status}, ${profile.children} children`,
    vision_name: vision.vision_name ?? '', target_date: vision.target_date ?? '',
    for_whom: (vision.for_whom ?? []).join(', '),
    what_if_not_achieved: vision.what_if_not_achieved ?? '',
    ed_agent_insight: edInsight,
  };

  useEffect(() => {
    if (categories.length === 0) loadCategories();
  }, []);

  // Derive categories from existing LLM challenges when editing
  useEffect(() => {
    if (challenges.length > 0 && categories.length === 0) {
      const existing = [...new Set(challenges.filter((c) => c.is_llm_suggested).map((c) => c.challenge_category))];
      if (existing.length > 0) setCategories(existing);
    }
  }, [challenges]);

  const loadCategories = async () => {
    setLoadingCats(true);
    try {
      const raw = await callLLM('challenge_categories', baseVars);
      const parsed = parseJSON<string[]>(raw);
      if (parsed && Array.isArray(parsed)) {
        const cats = parsed.slice(0, 5);
        setCategories(cats);
        // Only load LLM challenges for categories user hasn't already selected
        const alreadySelected = new Set(
          challenges.filter((c) => c.is_selected || c.is_starred).map((c) => c.challenge_category)
        );
        const catsToLoad = cats.filter((c) => !alreadySelected.has(c));
        if (catsToLoad.length > 0) loadAllCategories(catsToLoad);
        loadStuck(cats);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingCats(false); }
  };

  const loadAllCategories = async (cats: string[]) => {
    // Preserve user-selected challenges
    const userSelected = challenges.filter((c) => c.is_selected || c.is_starred || !c.is_llm_suggested);
    const allNew: ChallengeRow[] = [...userSelected];

    await Promise.all(cats.map(async (cat) => {
      setLoadingChallenges((prev) => ({ ...prev, [cat]: true }));
      try {
        const raw = await callLLM('challenges', { ...baseVars, challenge_category: cat });
        const parsed = parseJSON<string[]>(raw);
        if (parsed && Array.isArray(parsed)) {
          parsed.slice(0, 5).forEach((t) => allNew.push({
            challenge_category: cat, challenge_text: t,
            is_llm_suggested: true, is_starred: false, is_closed: false, is_selected: false,
          }));
        }
      } catch (err) { console.error(err); }
      finally { setLoadingChallenges((prev) => ({ ...prev, [cat]: false })); }
    }));
    setC(allNew);
  };

  const loadStuck = async (cats?: string[]) => {
    const catList = (cats ?? categories).join(', ');
    const specs = challenges.filter((c) => c.is_llm_suggested).slice(0, 5).map((c) => c.challenge_text).join('; ');
    setLoadingStuck(true);
    try {
      const raw = await callLLM('stuck_reasons', { ...baseVars, challenge_categories: catList, specific_challenges: specs });
      const parsed = parseJSON<string[]>(raw);
      if (parsed) {
        const userStuck = blockers.filter((b) => b.blocker_type === 'stuck' && !b.is_llm_suggested);
        const rows = parsed.slice(0, 5).map((t) => ({
          blocker_type: 'stuck' as const, blocker_text: t, is_llm_suggested: true,
          is_checked: false, is_starred: false, is_resolved: false,
        }));
        setBlockers([...userStuck, ...rows]);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingStuck(false); }
  };

  const loadPostpone = async () => {
    const catList = categories.join(', ');
    const specs = challenges.filter((c) => c.is_llm_suggested).slice(0, 5).map((c) => c.challenge_text).join('; ');
    setLoadingPostpone(true);
    try {
      const raw = await callLLM('postpone_reasons', { ...baseVars, challenge_categories: catList, specific_challenges: specs });
      const parsed = parseJSON<string[]>(raw);
      if (parsed) {
        const userPostpone = blockers.filter((b) => b.blocker_type === 'postpone' && !b.is_llm_suggested);
        const rows = parsed.slice(0, 5).map((t) => ({
          blocker_type: 'postpone' as const, blocker_text: t, is_llm_suggested: true,
          is_checked: false, is_starred: false, is_resolved: false,
        }));
        setBlockers([...blockers.filter((b) => b.blocker_type !== 'postpone' || !b.is_llm_suggested), ...userPostpone, ...rows]);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingPostpone(false); }
  };

  // Challenge actions
  const toggleSelect = (idx: number) => {
    const updated = [...challenges];
    updated[idx] = { ...updated[idx], is_selected: !updated[idx].is_selected };
    setC(updated);
  };

  const toggleStar = (idx: number) => {
    const starred = challenges.filter((c) => c.is_starred).length;
    const c = challenges[idx];
    if (!c.is_starred && starred >= 3) return;
    const updated = [...challenges];
    updated[idx] = { ...c, is_starred: !c.is_starred };
    setC(updated);
  };

  const resolveChallenge = (idx: number) => {
    const updated = [...challenges];
    const wasOpen = !updated[idx].is_closed;
    updated[idx] = { ...updated[idx], is_closed: wasOpen };
    setC(updated);
    if (wasOpen) {
      setClosingChallenge(updated[idx].challenge_text);
      setTimeout(() => setClosingChallenge(null), 3000);
    }
  };

  // Blocker actions
  const toggleBlockerSelect = (idx: number) => {
    const all = [...blockers];
    all[idx] = { ...all[idx], is_checked: !all[idx].is_checked };
    setBlockers(all);
  };

  const toggleBlockerStar = (idx: number) => {
    const all = [...blockers];
    all[idx] = { ...all[idx], is_starred: !all[idx].is_starred };
    setBlockers(all);
  };

  const resolveBlocker = (idx: number) => {
    const all = [...blockers];
    all[idx] = { ...all[idx], is_resolved: !all[idx].is_resolved };
    setBlockers(all);
  };

  const addCustomChallenge = (cat: string) => {
    const text = (customInputs[cat] ?? '').trim();
    if (!text) return;
    setC([...challenges, {
      challenge_category: cat, challenge_text: text,
      is_llm_suggested: false, is_starred: false, is_closed: false, is_selected: false,
    }]);
    setCustomInputs((prev) => ({ ...prev, [cat]: '' }));
  };

  const addCustomStuck = () => {
    const text = customStuckInput.trim();
    if (!text) return;
    setBlockers([...blockers, {
      blocker_type: 'stuck', blocker_text: text, is_llm_suggested: false,
      is_checked: false, is_starred: false, is_resolved: false,
    }]);
    setCustomStuckInput('');
  };

  const addCustomPostpone = () => {
    const text = customPostponeInput.trim();
    if (!text) return;
    setBlockers([...blockers, {
      blocker_type: 'postpone', blocker_text: text, is_llm_suggested: false,
      is_checked: false, is_starred: false, is_resolved: false,
    }]);
    setCustomPostponeInput('');
  };

  const stuckBlockers = blockers.filter((b) => b.blocker_type === 'stuck');
  const postponeBlockers = blockers.filter((b) => b.blocker_type === 'postpone');

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 space-y-0.5">
          <p><strong>Select</strong> the challenges you face. <strong>Star</strong> your top 3. <strong>Resolve</strong> when closed.</p>
          <p className="text-xs text-amber-600">Starred challenges get priority in nudges, wise advice, and stories.</p>
        </div>
      </div>

      {loadingCats ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> Generating your personal challenge map…
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat, catIdx) => {
            const color = CAT_COLORS[catIdx % CAT_COLORS.length];
            const llmChallenges = challenges.filter((c) => c.challenge_category === cat && c.is_llm_suggested);
            const customChallenges = challenges.filter((c) => c.challenge_category === cat && !c.is_llm_suggested);
            const allCat = [...llmChallenges, ...customChallenges];

            return (
              <div key={cat} className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${color.bg} ${color.border}`}>
                  <span className={`font-bold text-sm ${color.text}`}>{cat}</span>
                  {loadingChallenges[cat] && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>

                {/* Side-by-side grid for challenges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
                  {allCat.map((ch) => {
                    const globalIdx = challenges.indexOf(ch);
                    return (
                      <div
                        key={globalIdx}
                        className={`flex items-start gap-2 p-3 transition-colors ${
                          ch.is_resolved ? 'bg-gray-50' : ch.is_selected ? 'bg-teal-50/60' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        {/* Select checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelect(globalIdx)}
                          className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            ch.is_selected ? 'bg-teal-600 border-teal-600' : 'border-gray-300 bg-white'
                          }`}
                          title="Select this challenge"
                        >
                          {ch.is_selected && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>

                        {/* Text */}
                        <p className={`flex-1 text-xs leading-snug ${ch.is_resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {ch.challenge_text}
                          {!ch.is_llm_suggested && <span className="ml-1 text-xs text-blue-500 font-medium">(custom)</span>}
                        </p>

                        {/* Star */}
                        <button
                          type="button"
                          onClick={() => toggleStar(globalIdx)}
                          className={`flex-shrink-0 transition-colors ${ch.is_starred ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                          title="Star as top challenge"
                        >
                          <Star className="w-3.5 h-3.5" fill={ch.is_starred ? 'currentColor' : 'none'} />
                        </button>

                        {/* Resolve */}
                        <button
                          type="button"
                          onClick={() => resolveChallenge(globalIdx)}
                          className={`flex-shrink-0 transition-colors ${ch.is_resolved ? 'text-teal-600' : 'text-gray-200 hover:text-teal-400'}`}
                          title={ch.is_resolved ? 'Mark as open' : 'Mark as resolved'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {allCat.length === 0 && loadingChallenges[cat] && (
                    <div className="col-span-2 bg-white px-4 py-3 text-xs text-gray-400 text-center">
                      Loading challenges…
                    </div>
                  )}
                </div>

                {/* Add custom challenge */}
                <div className={`px-3 py-2 ${color.bg} border-t ${color.border}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customInputs[cat] ?? ''}
                      onChange={(e) => setCustomInputs((prev) => ({ ...prev, [cat]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomChallenge(cat)}
                      placeholder="Add your own challenge…"
                      className={`flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white`}
                    />
                    <button
                      type="button"
                      onClick={() => addCustomChallenge(cat)}
                      disabled={!(customInputs[cat] ?? '').trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        (customInputs[cat] ?? '').trim()
                          ? `${color.text} border ${color.border} hover:${color.bg}`
                          : 'text-gray-300 border border-gray-100 cursor-not-allowed'
                      }`}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Where do you get stuck */}
      <BlockerSection
        title="Where do you get stuck when working on this vision?"
        blockers={stuckBlockers}
        allBlockers={blockers}
        loading={loadingStuck}
        customInput={customStuckInput}
        onCustomInputChange={setCustomStuckInput}
        onAddCustom={addCustomStuck}
        onToggleSelect={toggleBlockerSelect}
        onToggleStar={toggleBlockerStar}
        onResolve={resolveBlocker}
        color="teal"
      />

      {/* Are you postponing */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
          <span className="font-bold text-sm text-orange-700">Are you postponing any action towards the vision?</span>
        </div>
        <div className="px-4 py-3 flex gap-3">
          {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(({ val, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setPostponeYes(val);
                if (val && postponeBlockers.filter((b) => b.is_llm_suggested).length === 0) loadPostpone();
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-medium transition-all ${postponeYes === val ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}
            >
              {postponeYes === val && <Check className="w-3.5 h-3.5" />} {label}
            </button>
          ))}
        </div>

        {postponeYes === true && (
          <div className="border-t border-gray-100">
            <BlockerSection
              title="What are you preparing instead?"
              blockers={postponeBlockers}
              allBlockers={blockers}
              loading={loadingPostpone}
              customInput={customPostponeInput}
              onCustomInputChange={setCustomPostponeInput}
              onAddCustom={addCustomPostpone}
              onToggleSelect={toggleBlockerSelect}
              onToggleStar={toggleBlockerStar}
              onResolve={resolveBlocker}
              color="orange"
              embedded
            />
          </div>
        )}
      </div>

      {closingChallenge && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Well done!</h3>
            <p className="text-sm text-gray-500 mb-3">You resolved a challenge.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
              <p className="text-sm font-bold text-amber-700">+20 Calm Points earned</p>
              <p className="text-xs text-amber-600 mt-0.5">{closingChallenge.slice(0, 50)}</p>
            </div>
            <button onClick={() => setClosingChallenge(null)} className="w-full bg-teal-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-teal-700 transition-all">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockerSection({
  title, blockers, allBlockers, loading, customInput, onCustomInputChange, onAddCustom,
  onToggleSelect, onToggleStar, onResolve, color, embedded,
}: {
  title: string;
  blockers: BlockerRow[];
  allBlockers: BlockerRow[];
  loading: boolean;
  customInput: string;
  onCustomInputChange: (v: string) => void;
  onAddCustom: () => void;
  onToggleSelect: (idx: number) => void;
  onToggleStar: (idx: number) => void;
  onResolve: (idx: number) => void;
  color: 'teal' | 'orange';
  embedded?: boolean;
}) {
  const bgClass = color === 'teal' ? 'bg-teal-50 border-teal-100' : 'bg-orange-50 border-orange-100';
  const textClass = color === 'teal' ? 'text-teal-700' : 'text-orange-700';

  return (
    <div className={embedded ? '' : 'rounded-2xl border border-gray-100 overflow-hidden shadow-sm'}>
      {!embedded && (
        <div className={`flex items-center justify-between px-4 py-3 ${bgClass} border-b`}>
          <span className={`font-bold text-sm ${textClass}`}>{title}</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      )}
      {embedded && (
        <div className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50">{title}</div>
      )}
      {loading ? (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Generating…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
          {blockers.map((b) => {
            const globalIdx = allBlockers.indexOf(b);
            return (
              <div
                key={globalIdx}
                className={`flex items-start gap-2 p-3 transition-colors ${
                  b.is_resolved ? 'bg-gray-50' : b.is_checked ? 'bg-teal-50/40' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleSelect(globalIdx)}
                  className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    b.is_checked ? 'bg-teal-600 border-teal-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {b.is_checked && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
                <p className={`flex-1 text-xs leading-snug ${b.is_resolved ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {b.blocker_text}
                  {!b.is_llm_suggested && <span className="ml-1 text-xs text-blue-500 font-medium">(custom)</span>}
                </p>
                <button
                  type="button"
                  onClick={() => onToggleStar(globalIdx)}
                  className={`flex-shrink-0 ${b.is_starred ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                >
                  <Star className="w-3.5 h-3.5" fill={b.is_starred ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => onResolve(globalIdx)}
                  className={`flex-shrink-0 ${b.is_resolved ? 'text-teal-600' : 'text-gray-200 hover:text-teal-400'}`}
                  title={b.is_resolved ? 'Re-open' : 'Mark resolved'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddCustom()}
            placeholder="Add your own reason…"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
          />
          <button
            type="button"
            onClick={onAddCustom}
            disabled={!customInput.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 disabled:text-gray-300 disabled:border-gray-100 transition-all"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({
  profile, vision, challenges, blockers, roadmap, setRoadmap,
}: {
  profile: UserProfile;
  vision: Partial<VisionRow>;
  challenges: ChallengeRow[];
  blockers: BlockerRow[];
  roadmap: RoadmapStep[];
  setRoadmap: (r: RoadmapStep[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingSubIdx, setEditingSubIdx] = useState<{ step: number; sub: number } | null>(null);

  const age = profile.date_of_birth
    ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : '';

  useEffect(() => {
    if (roadmap.length === 0) generateRoadmap();
  }, []);

  const generateRoadmap = async () => {
    setLoading(true);
    try {
      const cats = [...new Set(challenges.map((c) => c.challenge_category))].join(', ');
      const specs = challenges.filter((c) => c.is_starred || c.is_llm_suggested).slice(0, 8).map((c) => c.challenge_text).join('; ');
      const stuckList = blockers.filter((b) => b.blocker_type === 'stuck').slice(0, 5).map((b) => b.blocker_text).join('; ');
      const fitbDetails = (vision.fitb_responses ?? []).map((r) => r.value).filter(Boolean).join('; ');
      const raw = await callLLM('roadmap_with_submilestones', {
        name: profile.full_name, age, gender: profile.gender,
        profession: profile.profession, job_business_details: profile.job_business_details,
        marital_status: profile.marital_status, children: String(profile.children),
        vision_name: vision.vision_name ?? '', vision_description: vision.vision_description ?? '',
        fitb_details: fitbDetails,
        target_date: vision.target_date ?? '', why_best_suited: vision.why_best_suited ?? '',
        challenge_categories: cats, specific_challenges: specs, stuck_reasons: stuckList,
      });
      const parsed = parseJSON<RoadmapStep[]>(raw);
      if (parsed && Array.isArray(parsed)) {
        setRoadmap(parsed.slice(0, 5).map((s) => ({
          ...s,
          sub_milestones: s.sub_milestones ?? [],
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStep = (idx: number, field: keyof RoadmapStep, val: string | string[]) => {
    const updated = [...roadmap];
    (updated[idx] as Record<string, unknown>)[field] = val;
    updated[idx].is_user_edited = true;
    setRoadmap(updated);
  };

  const updateSubMilestone = (stepIdx: number, subIdx: number, val: string) => {
    const updated = [...roadmap];
    const subs = [...(updated[stepIdx].sub_milestones ?? [])];
    subs[subIdx] = val;
    updated[stepIdx] = { ...updated[stepIdx], sub_milestones: subs, is_user_edited: true };
    setRoadmap(updated);
  };

  const statusColor: Record<string, string> = {
    completed: 'bg-teal-500 text-white border-teal-500',
    in_progress: 'bg-blue-500 text-white border-blue-500',
    upcoming: 'bg-white text-gray-400 border-gray-200',
  };
  const statusBadge: Record<string, string> = {
    completed: 'bg-teal-100 text-teal-700',
    in_progress: 'bg-blue-100 text-blue-700',
    upcoming: 'bg-gray-100 text-gray-500',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-sm text-gray-500">Creating your personalised roadmap…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 flex items-start gap-2">
        <Edit2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-teal-700">Auto-generated milestones with sub-steps. Click the edit icon to modify any step.</p>
      </div>

      <div className="flex items-center gap-3 bg-teal-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">
        <Target className="w-4 h-4" /> You are here
      </div>

      <div className="relative space-y-5">
        <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-teal-300 via-blue-200 to-gray-200" />
        {roadmap.map((step, idx) => (
          <div key={idx} className="relative flex gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 border-2 shadow-sm ${statusColor[step.status] ?? statusColor.upcoming}`}>
              {step.status === 'completed' ? <Check className="w-4 h-4" /> : step.step_number}
            </div>
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Milestone header */}
              <div className={`flex items-start justify-between px-4 py-3 border-b ${step.status === 'in_progress' ? 'border-blue-100 bg-blue-50/30' : step.status === 'completed' ? 'border-teal-100 bg-teal-50/20' : 'border-gray-50'}`}>
                {editingIdx === idx ? (
                  <input value={step.title} onChange={(e) => updateStep(idx, 'title', e.target.value)}
                    className="flex-1 font-bold text-sm text-gray-800 border-0 border-b border-teal-400 focus:outline-none bg-transparent" />
                ) : (
                  <p className="font-bold text-sm text-gray-800 flex-1">{step.title}</p>
                )}
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${statusBadge[step.status]}`}>
                    {step.status === 'in_progress' ? 'In Progress' : step.status === 'completed' ? 'Done' : 'Upcoming'}
                  </span>
                  <button onClick={() => setEditingIdx(editingIdx === idx ? null : idx)} className="text-gray-400 hover:text-teal-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description */}
              {editingIdx === idx ? (
                <div className="px-4 py-3 space-y-2">
                  <textarea value={step.description} onChange={(e) => updateStep(idx, 'description', e.target.value)} rows={2}
                    className="w-full text-xs text-gray-600 border border-gray-200 rounded-xl p-2 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Target:</span>
                    <input value={step.target_period} onChange={(e) => updateStep(idx, 'target_period', e.target.value)}
                      className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    <select value={step.status} onChange={(e) => updateStep(idx, 'status', e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white">
                      <option value="upcoming">Upcoming</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button onClick={() => setEditingIdx(null)} className="ml-auto text-xs text-teal-600 font-semibold">Done</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 pb-2">
                  <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Target: {step.target_period}</p>
                </div>
              )}

              {/* Sub-milestones */}
              {(step.sub_milestones ?? []).length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Action Steps</p>
                  {(step.sub_milestones ?? []).map((sub, subIdx) => (
                    <div key={subIdx} className="flex items-start gap-2 group">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      </div>
                      {editingSubIdx?.step === idx && editingSubIdx?.sub === subIdx ? (
                        <input
                          autoFocus
                          value={sub}
                          onChange={(e) => updateSubMilestone(idx, subIdx, e.target.value)}
                          onBlur={() => setEditingSubIdx(null)}
                          className="flex-1 text-xs text-gray-600 border border-teal-300 rounded-lg px-2 py-1 focus:outline-none"
                          maxLength={100}
                        />
                      ) : (
                        <p
                          className="flex-1 text-xs text-gray-600 leading-snug cursor-pointer hover:text-teal-700 group-hover:underline"
                          onClick={() => setEditingSubIdx({ step: idx, sub: subIdx })}
                        >
                          {sub}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VisionBoardEditPage({ userId, profile, visionId, onComplete, onBack }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [edInsight, setEdInsight] = useState('');
  const [runningED, setRunningED] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [vision, setVision] = useState<Partial<VisionRow>>({
    vision_name: '', vision_description: '', vision_image_url: '',
    target_date: '', why_best_suited: '', for_whom: [],
    for_whom_custom: '', what_if_not_achieved: '', ideal_person: '',
    content_interests: '', current_behaviour_pattern: '', fitb_responses: [],
  });
  const [actionsText, setActionsText] = useState('');
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [blockers, setBlockers] = useState<BlockerRow[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([]);

  useEffect(() => {
    if (!visionId) return;
    (async () => {
      const { data: v } = await supabase.from('visions').select('*').eq('id', visionId).maybeSingle();
      if (v) setVision(v);
      const { data: acts } = await supabase.from('vision_actions').select('*').eq('vision_id', visionId).limit(1);
      if (acts?.[0]) setActionsText(acts[0].action_text ?? '');
      const { data: ch } = await supabase.from('vision_challenges').select('*').eq('vision_id', visionId);
      if (ch) setChallenges(ch.map((c) => ({ ...c, is_selected: c.is_selected ?? false })));
      const { data: bl } = await supabase.from('vision_blockers').select('*').eq('vision_id', visionId);
      if (bl) setBlockers(bl.map((b) => ({ ...b, is_starred: b.is_starred ?? false, is_resolved: b.is_resolved ?? false })));
      const { data: rm } = await supabase.from('vision_roadmap').select('*').eq('vision_id', visionId).order('step_number');
      if (rm) setRoadmap(rm.map((r) => ({ ...r, sub_milestones: r.sub_milestones ?? [] })));
    })();
  }, [visionId]);

  useEffect(() => {
    if (step === 1 && !edInsight && visionId) {
      setRunningED(true);
      callEDAgent(profile, visionId).then((result) => {
        if (result) setEdInsight(result.stuck_point + ' ' + result.root_pattern_summary);
      }).finally(() => setRunningED(false));
    }
  }, [step, visionId]);

  const validateStep1 = () => {
    if (!vision.vision_name?.trim()) return 'Please enter a Vision Name.';
    if ((vision.fitb_responses ?? []).length === 0) return 'Please complete the vision details (fill in the blanks).';
    if (!vision.target_date) return 'Please set a target date.';
    if (!vision.why_best_suited?.trim()) return 'Please explain why you are best suited.';
    if (!vision.what_if_not_achieved?.trim()) return 'Please describe what happens if not achieved.';
    if ((vision.for_whom ?? []).length === 0) return 'Please select who you are achieving this for.';
    return '';
  };

  const handleNext = () => {
    if (step === 0) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setError('');
    setStep((s) => s + 1);
  };

  const handleCancel = () => setShowCancelConfirm(true);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const age = profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 0;
      const { count } = await supabase.from('visions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active');
      if (!visionId && (count ?? 0) >= 3) { setError('You can have a maximum of 3 active visions.'); setSaving(false); return; }

      const visionPayload = { ...vision, user_id: userId, updated_at: new Date().toISOString() };
      let vid = visionId;
      if (visionId) {
        await supabase.from('visions').update(visionPayload).eq('id', visionId);
      } else {
        const { data } = await supabase.from('visions').insert(visionPayload).select('id').single();
        vid = data?.id;
      }
      if (!vid) throw new Error('Failed to save vision');

      await supabase.from('vision_actions').delete().eq('vision_id', vid);
      if (actionsText.trim()) {
        await supabase.from('vision_actions').insert({ vision_id: vid, user_id: userId, action_text: actionsText, is_llm_suggested: false, is_checked: false, sort_order: 0 });
      }

      // Preserve user-selected challenges when editing; replace LLM ones
      if (challenges.length > 0) {
        if (visionId) {
          // Delete only non-selected LLM challenges
          const { data: existing } = await supabase.from('vision_challenges').select('id, is_selected, is_starred, is_llm_suggested').eq('vision_id', vid);
          const toDelete = (existing ?? []).filter((c) => c.is_llm_suggested && !c.is_selected && !c.is_starred).map((c) => c.id);
          if (toDelete.length) await supabase.from('vision_challenges').delete().in('id', toDelete);
          // Insert new ones not already present
          const existingTexts = new Set((existing ?? []).map((c: { id: string }) => c.id));
          const toInsert = challenges.filter((c) => c.challenge_text.trim() && !('id' in c && existingTexts.has((c as { id?: string }).id ?? ''))).map((c, i) => ({
            vision_id: vid, user_id: userId,
            challenge_category: c.challenge_category, challenge_text: c.challenge_text,
            is_llm_suggested: c.is_llm_suggested, is_starred: c.is_starred,
            is_closed: c.is_closed, is_selected: c.is_selected, sort_order: i,
          }));
          if (toInsert.length) await supabase.from('vision_challenges').insert(toInsert);
          // Update existing ones
          for (const ch of challenges.filter((c) => 'id' in c && (c as { id?: string }).id)) {
            await supabase.from('vision_challenges').update({
              is_starred: ch.is_starred, is_closed: ch.is_closed, is_selected: ch.is_selected,
            }).eq('id', (ch as { id: string }).id);
          }
        } else {
          await supabase.from('vision_challenges').delete().eq('vision_id', vid);
          const rows = challenges.filter((c) => c.challenge_text.trim()).map((c, i) => ({
            vision_id: vid, user_id: userId,
            challenge_category: c.challenge_category, challenge_text: c.challenge_text,
            is_llm_suggested: c.is_llm_suggested, is_starred: c.is_starred,
            is_closed: c.is_closed, is_selected: c.is_selected, sort_order: i,
          }));
          if (rows.length) await supabase.from('vision_challenges').insert(rows);
        }
      }

      await supabase.from('vision_blockers').delete().eq('vision_id', vid);
      const blockerRows = blockers.filter((b) => b.blocker_text.trim()).map((b, i) => ({
        vision_id: vid, user_id: userId,
        blocker_type: b.blocker_type, blocker_text: b.blocker_text,
        is_llm_suggested: b.is_llm_suggested, is_checked: b.is_checked,
        is_starred: b.is_starred, is_resolved: b.is_resolved, sort_order: i,
      }));
      if (blockerRows.length) await supabase.from('vision_blockers').insert(blockerRows);

      if (roadmap.length > 0) {
        await supabase.from('vision_roadmap').delete().eq('vision_id', vid);
        const roadmapRows = roadmap.map((r) => ({
          vision_id: vid, user_id: userId,
          step_number: r.step_number, title: r.title, description: r.description,
          target_period: r.target_period, status: r.status,
          is_user_edited: r.is_user_edited ?? false,
          sub_milestones: r.sub_milestones ?? [],
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('vision_roadmap').insert(roadmapRows);
      }

      // Background: generate habits
      {
        const cats = [...new Set(challenges.map((c) => c.challenge_category))].join(', ');
        const specs = challenges.filter((c) => c.is_llm_suggested || c.is_starred).slice(0, 10).map((c) => c.challenge_text).join('; ');
        const fears = blockers.filter((b) => b.blocker_type === 'stuck').slice(0, 5).map((b) => b.blocker_text).join('; ');
        const avoided = blockers.filter((b) => b.blocker_type === 'postpone').slice(0, 5).map((b) => b.blocker_text).join('; ');
        callLLM('habits', {
          name: profile.full_name, age: String(age), gender: profile.gender,
          profession_type: profile.profession, job_business_details: profile.job_business_details,
          marital_status: profile.marital_status, children_details: String(profile.children),
          family_dependencies: `${profile.marital_status}, ${profile.children} children`,
          vision_name: vision.vision_name ?? '', vision_description: vision.vision_description ?? '',
          target_date: vision.target_date ?? '', why_best_suited: vision.why_best_suited ?? '',
          what_if_not_achieved: vision.what_if_not_achieved ?? '',
          challenge_categories: cats, specific_challenges: specs, custom_challenges: '',
          biggest_fears: fears, avoided_actions: avoided,
        }).then(async (raw) => {
          type HabitResponse = { challenge_nudges: Array<{ challenge_category: string; likely_hidden_belief: string; emotional_block: string; nudges: Array<{ nudge: string; nudge_type: string; when_to_flash: string }> }> };
          const parsed = parseJSON<HabitResponse>(raw);
          if (parsed?.challenge_nudges) {
            await supabase.from('vision_habits').delete().eq('vision_id', vid);
            const habitRows = parsed.challenge_nudges.flatMap((cat, ci) =>
              cat.nudges.map((n, ni) => ({
                vision_id: vid, user_id: userId,
                challenge_category: cat.challenge_category, habit_text: n.nudge,
                habit_type: n.nudge_type, when_to_flash: n.when_to_flash,
                likely_hidden_belief: cat.likely_hidden_belief,
                emotional_block: cat.emotional_block, is_custom: false, sort_order: ci * 10 + ni,
              }))
            );
            if (habitRows.length) await supabase.from('vision_habits').insert(habitRows);
          }
        }).catch(console.error);
      }

      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-700 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
            <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">Calm On</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 opacity-40 pointer-events-none select-none">
          {['Dashboard', 'Vision Board', 'Focus Thoughts', 'History', 'Settings', 'Profile'].map((label) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600">
              <div className="w-4 h-4 bg-gray-200 rounded" />{label}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button onClick={step === 0 ? handleCancel : () => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium">
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex-1 mx-6 max-w-sm">
            <StepIndicator current={step} />
          </div>
          <span className="text-xs text-gray-400">Step {step + 1} of 3</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {step === 0 ? 'Build Your Vision' : step === 1 ? 'Challenges in My Way' : 'Roadmap for Your Vision'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {step === 0 ? 'Define what you want to achieve and why it matters.'
                  : step === 1 ? 'Select challenges you face. Star top 3. Resolve when closed.'
                  : `Personalised roadmap to ${vision.vision_name ?? 'your vision'}.`}
              </p>
              {step === 1 && runningED && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-600">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analysing your profile for deeper insights…
                </div>
              )}
            </div>

            {step === 0 && (
              <>
                <TutorialBanner tutorialKey="vision_name" />
                <Step1
                  profile={profile} vision={vision} setVision={setVision}
                  actionsText={actionsText} setActionsText={setActionsText}
                  onFITBComplete={() => {}}
                />
              </>
            )}
            {step === 1 && (
              <>
                <TutorialBanner tutorialKey="vision_challenges" />
                <Step2
                  profile={profile} vision={vision} challenges={challenges} setC={setChallenges}
                  blockers={blockers} setBlockers={setBlockers} edInsight={edInsight}
                />
              </>
            )}
            {step === 2 && (
              <>
                <TutorialBanner tutorialKey="vision_roadmap" />
                <Step3
                  profile={profile} vision={vision} challenges={challenges}
                  blockers={blockers} roadmap={roadmap} setRoadmap={setRoadmap}
                />
              </>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">{error}</p>}
          </div>
        </div>

        <div className="bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-all"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 2 ? (
              <button onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all">
                Next {step === 0 ? '— Challenges' : '— Roadmap'} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all disabled:opacity-60">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Submit Vision Board'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-gray-900">Cancel changes?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Any unsaved changes will be lost. Are you sure you want to cancel?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                Keep Editing
              </button>
              <button onClick={() => { setShowCancelConfirm(false); onBack(); }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all">
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
