import React, { useState, useEffect } from 'react';
import { Loader2, Check, FileText, Send, Lock } from 'lucide-react';
import { supabase } from '../supabase';

const ANIMAL_IMAGES: Record<string, string> = {
  Lion: 'https://images.pexels.com/photos/2220337/pexels-photo-2220337.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Elephant: 'https://images.pexels.com/photos/237853/pexels-photo-237853.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Eagle: 'https://images.pexels.com/photos/326900/pexels-photo-326900.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Wolf: 'https://images.pexels.com/photos/39245/lion-wild-big-cat-fauna-39245.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Dolphin: 'https://images.pexels.com/photos/84691/pexels-photo-84691.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Owl: 'https://images.pexels.com/photos/326875/pexels-photo-326875.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Horse: 'https://images.pexels.com/photos/52500/horse-herd-nature-wild-52500.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
  Peacock: 'https://images.pexels.com/photos/326209/pexels-photo-326209.jpeg?auto=compress&cs=tinysrgb&h=120&w=120',
};

const YEARNS_IMAGES: Record<string, string> = {
  'Help others': 'https://images.pexels.com/photos/6347822/pexels-photo-6347822.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Respect all': 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Trust all': 'https://images.pexels.com/photos/2251577/pexels-photo-2251577.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Express my feelings': 'https://images.pexels.com/photos/3760790/pexels-photo-3760790.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Learn and grow': 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Be always happy': 'https://images.pexels.com/photos/207962/pexels-photo-207962.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Be appreciated': 'https://images.pexels.com/photos/3760130/pexels-photo-3760130.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Contribute to the world': 'https://images.pexels.com/photos/4226119/pexels-photo-4226119.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Be valued for my work': 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  'Remembered by all': 'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
};

const EMOTION_IMAGES: Record<string, string> = {
  Anxiety: 'https://images.pexels.com/photos/33299/ants-insects-wildlife-insects-33299.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Insecurity: 'https://images.pexels.com/photos/3760930/pexels-photo-3760930.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Fear: 'https://images.pexels.com/photos/1671623/pexels-photo-1671623.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Lust: 'https://images.pexels.com/photos/2067648/pexels-photo-2067648.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Shame: 'https://images.pexels.com/photos/3760140/pexels-photo-3760140.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Doubt: 'https://images.pexels.com/photos/3760915/pexels-photo-3760915.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Grief: 'https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Hatred: 'https://images.pexels.com/photos/3760900/pexels-photo-3760900.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Lonely: 'https://images.pexels.com/photos/3760879/pexels-photo-3760879.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Sad: 'https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Controlled: 'https://images.pexels.com/photos/3760930/pexels-photo-3760930.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Confused: 'https://images.pexels.com/photos/3760915/pexels-photo-3760915.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
  Overthink: 'https://images.pexels.com/photos/3760900/pexels-photo-3760900.jpeg?auto=compress&cs=tinysrgb&h=60&w=60',
};

interface Props {
  coachId: string;
  capsuleId: string;
  coacheeEmail: string;
}

export default function ExplorationFormTab({ coachId, capsuleId, coacheeEmail }: Props) {
  const [form, setForm] = useState<any>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingResponse, setExistingResponse] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // Load coach's latest non-default form
      const { data: forms } = await supabase
        .from('coach_forms')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
      const myForms = (forms as any[]) ?? [];
      // Fall back to default template if no custom forms
      const { data: defaults } = await supabase
        .from('coach_forms')
        .select('*')
        .eq('coach_id', '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false });
      const defaultForms = (defaults as any[]) ?? [];
      const chosen = myForms[0] ?? defaultForms[0] ?? null;
      if (!chosen) { setLoading(false); return; }
      setForm(chosen);
      // Filter out name & email fields — these are collected during registration
      const filteredFields = (chosen.fields || []).filter((f: any) => f.key !== 'email' && f.key !== 'client_name' && f.key !== 'name' && f.key !== 'full_name');
      setForm({ ...chosen, fields: filteredFields });
      // Check if coachee already submitted for this capsule
      const { data: existing } = await supabase
        .from('coach_form_responses')
        .select('*')
        .eq('form_id', chosen.id)
        .eq('email', coacheeEmail)
        .eq('capsule_id', capsuleId)
        .maybeSingle();
      if (existing) {
        setExistingResponse(existing);
        setValues((existing as any).response_data ?? {});
      }
      setLoading(false);
    })();
  }, [coachId, capsuleId, coacheeEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const missing = (form.fields || []).filter((f: any) => f.required && !values[f.key]);
    if (missing.length > 0) { setError(`Please fill in: ${missing.map((f: any) => f.label).join(', ')}`); return; }
    setSubmitting(true);
    try {
      const { error: upsertErr } = await supabase
        .from('coach_form_responses')
        .upsert(
          { form_id: form.id, coach_id: coachId, email: coacheeEmail, response_data: values, capsule_id: capsuleId },
          { onConflict: 'form_id,email' }
        );
      if (upsertErr) throw new Error(upsertErr.message);
      setSubmitted(true);
      // Reload to get the response row
      const { data: resp } = await supabase
        .from('coach_form_responses')
        .select('*')
        .eq('form_id', form.id)
        .eq('email', coacheeEmail)
        .eq('capsule_id', capsuleId)
        .maybeSingle();
      if (resp) setExistingResponse(resp);
    } catch (err: any) {
      setError('Submission failed: ' + err.message);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;
  if (!form) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500">Your coach hasn't set up an exploration form yet.</p>
    </div>
  );

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="text-sm font-bold text-gray-800">Form Submitted!</p>
        <p className="text-xs text-gray-500 mt-1">Your coach can now view your responses. You can edit your submission anytime.</p>
        <button onClick={() => setSubmitted(false)} className="mt-4 text-xs text-teal-600 hover:underline">Review my responses</button>
      </div>
    );
  }

  const fields = form.fields || [];
  const sections = [...new Set(fields.map((f: any) => f.section))];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-800">Exploration Form</p>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {existingResponse ? 'You have already filled this form. You can update your answers below.' : 'Please fill out this form so your coach can understand you better.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {sections.map((section: string) => (
          <div key={section} className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">{section}</h3>
            <div className="space-y-4">
              {fields.filter((f: any) => f.section === section).map((field: any) => (
                <FormField key={field.key} field={field} values={values} setValues={setValues} />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <span>Your data is encrypted with AES-256 encryption</span>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Submitting...' : existingResponse ? 'Update Form' : 'Submit Form'}
        </button>
      </form>
    </div>
  );
}

function FormField({ field, values, setValues }: { field: any; values: Record<string, any>; setValues: React.Dispatch<React.SetStateAction<Record<string, any>>> }) {
  const val = values[field.key];

  if (field.type === 'image_select') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <div className="grid grid-cols-4 gap-2">
          {(field.options || []).map((opt: string) => (
            <button key={opt} type="button" onClick={() => setValues(v => ({ ...v, [field.key]: opt }))} className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition ${val === opt ? 'border-teal-500 bg-teal-50' : 'border-gray-100 hover:border-teal-200'}`}>
              <img src={ANIMAL_IMAGES[opt] || ''} alt={opt} className="w-12 h-12 rounded-lg object-cover" />
              <span className="text-xs text-gray-600">{opt}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'multiselect_with_reason') {
    const selected: any[] = val || [];
    const toggle = (opt: string) => {
      if (selected.find((s: any) => s.value === opt)) {
        setValues(v => ({ ...v, [field.key]: selected.filter((s: any) => s.value !== opt) }));
      } else {
        setValues(v => ({ ...v, [field.key]: [...selected, { value: opt, reason: '' }] }));
      }
    };
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <div className="grid grid-cols-2 gap-2">
          {(field.options || []).map((opt: string) => (
            <div key={opt} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${selected.find((s: any) => s.value === opt) ? 'border-teal-400 bg-teal-50' : 'border-gray-100'}`} onClick={() => toggle(opt)}>
              {YEARNS_IMAGES[opt] && <img src={YEARNS_IMAGES[opt]} alt="" className="w-8 h-8 rounded object-cover" />}
              <span className="text-xs text-gray-700">{opt}</span>
              <input type="checkbox" checked={!!selected.find((s: any) => s.value === opt)} readOnly className="ml-auto" />
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="mt-2 space-y-2">
            {selected.map((s: any, i: number) => (
              <input key={i} type="text" placeholder={`Why do you yearn for "${s.value}"?`} value={s.reason} onChange={e => { const updated = [...selected]; updated[i] = { ...s, reason: e.target.value }; setValues(v => ({ ...v, [field.key]: updated })); }} className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'multiselect_with_other') {
    const selected: string[] = val?.selected || [];
    const otherText = val?.other || '';
    const toggle = (opt: string) => {
      if (selected.includes(opt)) { setValues(v => ({ ...v, [field.key]: { ...v[field.key], selected: selected.filter(s => s !== opt) } })); }
      else { setValues(v => ({ ...v, [field.key]: { ...v[field.key], selected: [...selected, opt] } })); }
    };
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <div className="grid grid-cols-3 gap-2">
          {(field.options || []).map((opt: string) => (
            <div key={opt} className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer ${selected.includes(opt) ? 'border-teal-400 bg-teal-50' : 'border-gray-100'}`} onClick={() => toggle(opt)}>
              {EMOTION_IMAGES[opt] && <img src={EMOTION_IMAGES[opt]} alt="" className="w-6 h-6 rounded object-cover" />}
              <span className="text-xs text-gray-700">{opt}</span>
            </div>
          ))}
        </div>
        {selected.includes('Others') && <input type="text" placeholder="Specify other" value={otherText} onChange={e => setValues(v => ({ ...v, [field.key]: { ...v[field.key], other: e.target.value } }))} className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-2" />}
      </div>
    );
  }

  if (field.type === 'purpose_select') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <select value={val || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
          <option value="">Select a purpose...</option>
          {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <input type="text" placeholder="Or write your own purpose" value={val && !(field.options || []).includes(val) ? val : ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
      </div>
    );
  }

  if (field.type === 'multiselect') {
    const selected: string[] = val || [];
    const toggle = (opt: string) => setValues(v => ({ ...v, [field.key]: selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt] }));
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-2 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((opt: string) => (
            <button key={opt} type="button" onClick={() => toggle(opt)} className={`text-xs px-3 py-1.5 rounded-full border ${selected.includes(opt) ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>{opt}</button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <select value={val || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
          <option value="">Select...</option>
          {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <input type="date" value={val || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
      </div>
    );
  }

  if (field.type === 'multiline') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
        <textarea value={val || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 mb-1 block">{field.label}{field.required && <span className="text-red-500"> *</span>}</label>
      <input type="text" value={val || ''} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
    </div>
  );
}
