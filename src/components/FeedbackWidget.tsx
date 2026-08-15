import React, { useState, useRef } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, X, Upload, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

const FEATURES = [
  'Thought parking using voice',
  'Thought parking with text',
  'Bulk thought parking with voice',
  'Bulk thought parking using text',
  'Image parking',
  'Thought summary',
  'Thought search',
  'Thought Dashboard',
  'Confess',
  'Vent Out',
  'Help me think',
  'Others',
];

interface Props {
  user: User;
  onClose: () => void;
}

export default function FeedbackWidget({ user, onClose }: Props) {
  const [feature, setFeature] = useState('');
  const [text, setText] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feature) return;
    setLoading(true);
    try {
      let screenshot_url: string | null = null;
      if (screenshotFile) {
        const path = `feedback/${user.id}/${Date.now()}_${screenshotFile.name}`;
        const { data: upload } = await supabase.storage.from('app-assets').upload(path, screenshotFile, { upsert: true });
        if (upload) {
          const { data: pub } = supabase.storage.from('app-assets').getPublicUrl(upload.path);
          screenshot_url = pub.publicUrl;
        }
      }
      await supabase.from('app_feedback').insert({
        user_id: user.id,
        email: user.email,
        feature,
        screenshot_url,
        text_feedback: text.trim() || null,
      });
      setDone(true);
      setTimeout(onClose, 2000);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  if (done) return (
    <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
      <CheckCircle className="w-8 h-8 text-teal-500" />
      <p className="text-sm font-semibold text-gray-800">Thanks for your feedback!</p>
      <p className="text-xs text-gray-400">It helps us improve Parker.</p>
    </div>
  );

  return (
    <div className="px-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-gray-800">Send Feedback</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <select
          value={feature} onChange={e => setFeature(e.target.value)} required
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <option value="">Select feature...</option>
          {FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="What's your feedback? (optional)"
          rows={3}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <div>
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={e => setScreenshotFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600 border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 w-full transition">
            <Upload className="w-3 h-3" />
            {screenshotFile ? screenshotFile.name : 'Attach screenshot (optional)'}
          </button>
        </div>
        <button type="submit" disabled={loading || !feature}
          className="w-full flex items-center justify-center gap-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg py-2 hover:bg-teal-700 disabled:opacity-50 transition">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
          {loading ? 'Sending...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}

interface ReactionProps {
  user: User;
  actionType: string;
  onDone?: () => void;
}

export function ReactionToast({ user, actionType, onDone }: ReactionProps) {
  const [selected, setSelected] = useState<'up' | 'down' | null>(null);
  const [negText, setNegText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async (isPositive: boolean, qualitative?: string) => {
    setSelected(isPositive ? 'up' : 'down');
    await supabase.from('reaction_feedback').insert({
      user_id: user.id,
      email: user.email,
      action_type: actionType,
      is_positive: isPositive,
      qualitative: qualitative ?? null,
    });
    setSubmitted(true);
    setTimeout(() => onDone?.(), 1200);
  };

  if (submitted) return (
    <div className="flex items-center gap-2 text-xs text-teal-700 font-medium">
      <CheckCircle className="w-4 h-4 text-teal-500" /> Thanks!
    </div>
  );

  if (selected === 'down') return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-gray-500">What went wrong? (optional)</p>
      <textarea
        value={negText} onChange={e => setNegText(e.target.value)}
        rows={2} placeholder="Tell us more..."
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400 w-full"
      />
      <button onClick={() => submit(false, negText.trim() || undefined)}
        className="text-xs bg-teal-600 text-white rounded-lg px-3 py-1 font-medium hover:bg-teal-700 transition self-end">
        Submit
      </button>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">How was this?</span>
      <button onClick={() => submit(true)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition">
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button onClick={() => setSelected('down')} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}
