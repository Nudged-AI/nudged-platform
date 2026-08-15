import { useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus, Check, Upload, Sparkles, Bot } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { getCoachForEmail, CATEGORY_OPTIONS, NICHE_OPTIONS, TONE_OPTIONS, STOCK_IMAGES, type Coach, type CoachProfile } from '../lib/coach';
import { callLLM as callLLMFn, stripMarkdown } from '../lib/llm';

interface Props { user: User; }

export default function CoachProfileSection({ user }: Props) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '', pronouns: '', portrait_url: '', brand_logo_url: '',
    welcome_message: '', philosophy: '',
    categories: [] as string[], niches: [] as string[], tone_tags: [] as string[],
  });
  const [customCat, setCustomCat] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [customTone, setCustomTone] = useState('');
  const [chatbotForm, setChatbotForm] = useState({ chatbot_name: 'Wise Harry', chatbot_avatar_url: '', greeting_line: '' });
  const [chatbotSaving, setChatbotSaving] = useState(false);
  const [generatingGreeting, setGeneratingGreeting] = useState(false);

  const STOCK_CHATBOT_IMAGES = [
    STOCK_IMAGES.wiseHarry,
    'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=200',
    'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=200',
    'https://images.pexels.com/photos/736422/pexels-photo-736422.jpeg?auto=compress&cs=tinysrgb&w=200',
    'https://images.pexels.com/photos/3752834/pexels-photo-3752834.jpeg?auto=compress&cs=tinysrgb&w=200',
  ];

  useEffect(() => {
    (async () => {
      const c = await getCoachForEmail(user.email ?? '');
      if (!c) { setLoading(false); return; }
      setCoach(c);
      const { data } = await supabase.from('coach_profiles').select('*').eq('coach_id', c.id).maybeSingle();
      const p = data as CoachProfile | null;
      setProfile(p);
      if (p) {
        setForm({
          display_name: p.display_name ?? '', pronouns: p.pronouns ?? '',
          portrait_url: p.portrait_url ?? '', brand_logo_url: p.brand_logo_url ?? '',
          welcome_message: p.welcome_message ?? '', philosophy: p.philosophy ?? '',
          categories: p.categories ?? [], niches: p.niches ?? [], tone_tags: p.tone_tags ?? [],
        });
      }
      const { data: cb } = await supabase.from('coach_chatbot_config').select('*').eq('coach_id', c.id).maybeSingle();
      if (cb) {
        const cbData = cb as any;
        setChatbotForm({ chatbot_name: cbData.chatbot_name || 'Wise Harry', chatbot_avatar_url: cbData.chatbot_avatar_url || '', greeting_line: cbData.greeting_line || '' });
      }
      setLoading(false);
    })();
  }, [user.email]);

  if (loading) return null;
  if (!coach) return null;

  const toggle = (key: 'categories' | 'niches' | 'tone_tags', val: string) => {
    setForm(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val] }));
  };
  const addCustom = (key: 'categories' | 'niches' | 'tone_tags', val: string, setter: (v: string) => void) => {
    if (!val.trim()) return;
    setForm(f => f[key].includes(val.trim()) ? f : ({ ...f, [key]: [...f[key], val.trim()] }));
    setter('');
  };

  const uploadImage = async (file: File, field: 'portrait_url' | 'brand_logo_url') => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `coach-profiles/${coach.id}-${field}.${ext}`;
    const { error: upErr } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
    if (upErr) { alert(upErr.message); return; }
    const { data: pub } = supabase.storage.from('app-assets').getPublicUrl(path);
    setForm(f => ({ ...f, [field]: pub.publicUrl }));
  };

  const uploadChatbotImage = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `coach-profiles/${coach.id}-chatbot.${ext}`;
    const { error: upErr } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
    if (upErr) { alert(upErr.message); return; }
    const { data: pub } = supabase.storage.from('app-assets').getPublicUrl(path);
    setChatbotForm(f => ({ ...f, chatbot_avatar_url: pub.publicUrl }));
  };

  const saveChatbot = async () => {
    setChatbotSaving(true);
    const { data: existing } = await supabase.from('coach_chatbot_config').select('id').eq('coach_id', coach.id).maybeSingle();
    if (existing) {
      await supabase.from('coach_chatbot_config').update({
        chatbot_name: chatbotForm.chatbot_name, chatbot_avatar_url: chatbotForm.chatbot_avatar_url, greeting_line: chatbotForm.greeting_line, updated_at: new Date().toISOString(),
      }).eq('id', (existing as any).id);
    } else {
      await supabase.from('coach_chatbot_config').insert({ coach_id: coach.id, ...chatbotForm });
    }
    setChatbotSaving(false);
    alert('Chatbot settings saved.');
  };

  const generateGreeting = async () => {
    setGeneratingGreeting(true);
    try {
      const res = await callLLMFn('chatbot_greeting_gen', { chatbot_name: chatbotForm.chatbot_name }, undefined);
      setChatbotForm(f => ({ ...f, greeting_line: stripMarkdown(res).trim() }));
    } catch { alert('Could not generate greeting.'); }
    setGeneratingGreeting(false);
  };

  const save = async () => {
    setSaving(true);
    if (profile) {
      await supabase.from('coach_profiles').update({
        display_name: form.display_name, pronouns: form.pronouns, portrait_url: form.portrait_url,
        brand_logo_url: form.brand_logo_url, welcome_message: form.welcome_message,
        philosophy: form.philosophy, categories: form.categories, niches: form.niches, tone_tags: form.tone_tags,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    } else {
      await supabase.from('coach_profiles').insert({
        coach_id: coach.id, ...form,
      });
    }
    setSaving(false);
    alert('Coach details saved.');
  };

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-teal-600" />
        <p className="text-sm font-bold text-gray-800">Coach Details</p>
        <span className="text-xs text-gray-400">· shared in Nudged Marketplace</span>
      </div>
      <div className="px-6 py-5 space-y-5">
        {/* Display name + pronouns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Display Name</label>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Pronouns</label>
            <select value={form.pronouns} onChange={e => setForm(f => ({ ...f, pronouns: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none">
              <option value="">Select</option>
              <option>He / Him</option><option>She / Her</option><option>They / Them</option>
            </select>
          </div>
        </div>

        {/* Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Coach Portrait (clear face)</label>
            <div className="flex items-center gap-3">
              {form.portrait_url ? (
                <img src={form.portrait_url} alt="portrait" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <label className="flex items-center gap-1 text-xs text-teal-600 cursor-pointer hover:text-teal-700">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'portrait_url')} />
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Brand Logo</label>
            <div className="flex items-center gap-3">
              {form.brand_logo_url ? (
                <img src={form.brand_logo_url} alt="logo" className="w-16 h-16 rounded-xl object-contain bg-gray-50" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <label className="flex items-center gap-1 text-xs text-teal-600 cursor-pointer hover:text-teal-700">
                <Upload className="w-3.5 h-3.5" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'brand_logo_url')} />
              </label>
            </div>
          </div>
        </div>

        {/* Welcome message */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Welcome Message for Portal</label>
          <textarea value={form.welcome_message} onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))}
            rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none resize-none" />
        </div>

        {/* Category multi-select */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map(o => (
              <button key={o} onClick={() => toggle('categories', o)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${form.categories.includes(o) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Add custom category"
              className="flex-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs outline-none"
              onKeyDown={e => e.key === 'Enter' && addCustom('categories', customCat, setCustomCat)} />
            <button onClick={() => addCustom('categories', customCat, setCustomCat)} className="text-xs text-teal-600"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Niche multi-select */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Coaching Niche</label>
          <div className="flex flex-wrap gap-2">
            {NICHE_OPTIONS.map(o => (
              <button key={o} onClick={() => toggle('niches', o)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${form.niches.includes(o) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={customNiche} onChange={e => setCustomNiche(e.target.value)} placeholder="Add custom niche"
              className="flex-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs outline-none"
              onKeyDown={e => e.key === 'Enter' && addCustom('niches', customNiche, setCustomNiche)} />
            <button onClick={() => addCustom('niches', customNiche, setCustomNiche)} className="text-xs text-teal-600"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Philosophy */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Coaching Philosophy</label>
          <textarea value={form.philosophy} onChange={e => setForm(f => ({ ...f, philosophy: e.target.value }))}
            rows={2} placeholder="e.g. I help people reconnect with their inner clarity through small daily practices"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none resize-none" />
        </div>

        {/* Tone tags */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Tone Tags</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map(o => (
              <button key={o} onClick={() => toggle('tone_tags', o)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${form.tone_tags.includes(o) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={customTone} onChange={e => setCustomTone(e.target.value)} placeholder="Add custom tone"
              className="flex-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs outline-none"
              onKeyDown={e => e.key === 'Enter' && addCustom('tone_tags', customTone, setCustomTone)} />
            <button onClick={() => addCustom('tone_tags', customTone, setCustomTone)} className="text-xs text-teal-600"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Coach Details
          </button>
        </div>
      </div>

      {/* Chatbot Customization Section */}
      <div className="px-6 py-5 border-t border-gray-100 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-800">Talk Chatbot Customization</p>
          <span className="text-xs text-gray-400">· used across all your capsules</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Chatbot Name</label>
            <input value={chatbotForm.chatbot_name} onChange={e => setChatbotForm(f => ({ ...f, chatbot_name: e.target.value }))}
              placeholder="Wise Harry"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Greeting Line</label>
            <div className="flex gap-2">
              <input value={chatbotForm.greeting_line} onChange={e => setChatbotForm(f => ({ ...f, greeting_line: e.target.value }))}
                placeholder="Welcome! Let's reflect together..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-100 outline-none" />
              <button onClick={generateGreeting} disabled={generatingGreeting}
                className="flex items-center gap-1 text-xs text-teal-600 border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-50 disabled:opacity-40 whitespace-nowrap">
                {generatingGreeting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Chatbot Display Image</label>
          <div className="flex items-center gap-3 mb-2">
            {chatbotForm.chatbot_avatar_url ? (
              <img src={chatbotForm.chatbot_avatar_url} alt="chatbot" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <img src={STOCK_IMAGES.wiseHarry} alt="default" className="w-16 h-16 rounded-full object-cover" />
            )}
            <label className="flex items-center gap-1 text-xs text-teal-600 cursor-pointer hover:text-teal-700">
              <Upload className="w-3.5 h-3.5" /> Upload custom image
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadChatbotImage(e.target.files[0])} />
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-1.5">Or choose from stock images:</p>
          <div className="flex flex-wrap gap-2">
            {STOCK_CHATBOT_IMAGES.map((url, i) => (
              <button key={i} onClick={() => setChatbotForm(f => ({ ...f, chatbot_avatar_url: url }))}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${chatbotForm.chatbot_avatar_url === url ? 'border-teal-500' : 'border-gray-200 hover:border-teal-300'}`}>
                <img src={url} alt={`option ${i}`} className="w-full h-full object-cover" />
              </button>
            ))}
            <button onClick={() => setChatbotForm(f => ({ ...f, chatbot_avatar_url: form.portrait_url }))}
              className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${chatbotForm.chatbot_avatar_url === form.portrait_url ? 'border-teal-500' : 'border-gray-200 hover:border-teal-300'}`}>
              {form.portrait_url ? <img src={form.portrait_url} alt="use profile" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400" /></div>}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={saveChatbot} disabled={chatbotSaving}
            className="flex items-center gap-1.5 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition disabled:opacity-60">
            {chatbotSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Chatbot Settings
          </button>
        </div>
      </div>
    </div>
  );
}
