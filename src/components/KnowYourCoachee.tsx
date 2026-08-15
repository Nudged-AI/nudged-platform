import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, Download, UserPlus, Pencil, Lock, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../supabase';
import { callLLM } from '../lib/llm';

interface Coach { id: string; coach_name: string; }
interface FormVersion { id: string; form_name: string; version: number; fields: any[]; is_default: boolean; created_at: string; }
interface Response { id: string; form_id: string; email: string; response_data: any; promoted_to_coachee: boolean; created_at: string; }

const DEFAULT_FIELDS: any[] = [
  { section: 'Personal', label: 'Name', key: 'name', type: 'text', required: true },
  { section: 'Personal', label: 'Gmail ID', key: 'email', type: 'text', required: true },
  { section: 'Personal', label: 'WhatsApp number', key: 'whatsapp', type: 'text', required: false },
  { section: 'Personal', label: 'Date of Birth', key: 'dob', type: 'date', required: false },
  { section: 'Personal', label: 'Gender', key: 'gender', type: 'text', required: false },
  { section: 'Personal', label: 'Profession', key: 'profession', type: 'dropdown', options: ['Student','IT/Software','Marketing','Finance','Healthcare','Education','Business Owner','Homemaker','Consultant','Other'], required: false },
  { section: 'Personal', label: 'Marital Status', key: 'marital_status', type: 'dropdown', options: ['Single','Married','Divorced','Widowed','Separated'], required: false },
  { section: 'Personal', label: 'Which animal do you associate with?', key: 'spirit_animal', type: 'image_select', options: ['Lion','Elephant','Eagle','Wolf','Dolphin','Owl','Horse','Peacock'], required: false },
  { section: 'Personal', label: 'What do you yearn for?', key: 'yearns', type: 'multiselect_with_reason', options: ['Help others','Respect all','Trust all','Express my feelings','Learn and grow','Be always happy','Be appreciated','Contribute to the world','Be valued for my work','Remembered by all'], required: false },
  { section: 'Personal', label: 'Purpose of life', key: 'purpose', type: 'purpose_select', options: ['To love and be loved','To create something lasting','To help others grow','To find inner peace','To achieve excellence','To make the world better','To inspire others','To discover truth','To build meaningful connections','To leave a legacy'], required: false },
  { section: 'Knowing you better', label: 'Describe your goal', key: 'goal_description', type: 'text', required: false },
  { section: 'Knowing you better', label: 'When to achieve?', key: 'goal_timeline', type: 'date', required: false },
  { section: 'Knowing you better', label: 'Why are you best suited for this goal?', key: 'goal_why_suited', type: 'text', required: false },
  { section: 'Knowing you better', label: 'For whom do you want to achieve this goal?', key: 'goal_for_whom', type: 'multiselect', options: ['Self','Children','Spouse','Parents','Friends','Others'], required: false },
  { section: 'Knowing you better', label: 'What will happen if you do not achieve the goal?', key: 'goal_if_not', type: 'text', required: false },
  { section: 'Knowing you better', label: 'Who is your idol on the path of achieving the goal?', key: 'goal_idol', type: 'text', required: false },
  { section: 'Knowing you better', label: 'In the last 30 days, what steps did you take to achieve the goal?', key: 'goal_steps_30days', type: 'text', required: false },
  { section: 'Knowing you better', label: 'Challenges in achieving the goal', key: 'goal_challenges', type: 'multiline', required: false },
  { section: 'Knowing you better', label: 'When I face challenges I generally feel', key: 'challenge_emotions', type: 'multiselect_with_other', options: ['Anxiety','Insecurity','Fear','Lust','Shame','Doubt','Grief','Hatred','Lonely','Sad','Controlled','Confused','Overthink','Others'], required: false },
];

const FIELD_TYPES = [
  { type: 'text', label: 'Text box' },
  { type: 'date', label: 'Date picker' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'multiline', label: 'Multi-line text' },
  { type: 'multiselect', label: 'Multi select' },
];

export default function KnowYourCoachee({ coach, coachEmail, capsuleId }: { coach: Coach; coachEmail: string; capsuleId?: string }) {
  const [forms, setForms] = useState<FormVersion[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<any[]>([]);
  const [formName, setFormName] = useState('');
  const [showResponses, setShowResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: formsData } = await supabase.from('coach_forms').select('*').order('created_at', { ascending: false });
    const formsList = (formsData as any[]) ?? [];
    // Filter to this coach's forms + default template
    const myForms = formsList.filter(f => f.coach_id === coach.id || f.coach_id === '00000000-0000-0000-0000-000000000000');
    setForms(myForms);
    if (myForms.length > 0 && !selectedFormId) setSelectedFormId(myForms[0].id);
    setLoading(false);
  }, [coach.id]);

  useEffect(() => { load(); }, [load]);

  const loadResponses = async (formId: string) => {
    let q = supabase.from('coach_form_responses').select('*').eq('form_id', formId).order('created_at', { ascending: false });
    if (capsuleId) q = q.eq('capsule_id', capsuleId);
    const { data } = await q;
    setResponses((data as any[]) ?? []);
    setShowResponses(true);
  };

  const startEdit = (form: FormVersion) => {
    setEditFields(JSON.parse(JSON.stringify(form.fields)));
    setFormName(form.form_name);
    setSelectedFormId(form.id);
    setEditing(true);
  };

  const startNew = () => {
    setEditFields(JSON.parse(JSON.stringify(DEFAULT_FIELDS)));
    setFormName('My Exploration Form');
    setSelectedFormId('');
    setEditing(true);
  };

  const saveForm = async () => {
    setSaving(true);
    const coachForms = forms.filter(f => f.coach_id === coach.id);
    const nextVersion = coachForms.length + 1;
    const { data } = await supabase.from('coach_forms').insert({
      coach_id: coach.id, form_name: formName, version: nextVersion, fields: editFields, is_default: false,
    }).select().single();
    setSaving(false);
    if (data) {
      setEditing(false);
      setSelectedFormId((data as any).id);
      load();
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Delete this form version? All responses will also be deleted.')) return;
    await supabase.from('coach_forms').delete().eq('id', formId);
    if (selectedFormId === formId) setSelectedFormId('');
    load();
  };

  const promoteToCoachee = async (resp: Response) => {
    const d = resp.response_data || {};
    // Check if email already exists in coachees
    const { data: existing } = await supabase.from('coachees').select('id').eq('email', d.email).eq('coach_id', coach.id).maybeSingle();
    if (existing) { alert('A coachee with this email already exists.'); return; }

    // Check mandatory fields
    const missing = [];
    if (!d.name) missing.push('Name');
    if (!d.email) missing.push('Email');
    if (missing.length > 0) { alert(`Cannot promote: missing mandatory fields: ${missing.join(', ')}`); return; }

    const { error } = await supabase.from('coachees').insert({
      coach_id: coach.id, email: d.email, client_name: d.name,
      whatsapp_number: d.whatsapp || null, date_of_birth: d.dob || null, gender: d.gender || null,
      profession: d.profession || null, marital_status: d.marital_status || null,
      reasons_for_seeking: d.goal_description || null, primary_goal: d.goal_description || null,
      main_blocker: (Array.isArray(d.goal_challenges) ? d.goal_challenges.join('; ') : d.goal_challenges) || null,
      target_timeline: d.goal_timeline || null,
    });
    if (error) { alert('Failed to promote: ' + error.message); return; }
    await supabase.from('coach_form_responses').update({ promoted_to_coachee: true }).eq('id', resp.id);
    alert(`Coachee ${d.name} created successfully!`);
    loadResponses(selectedFormId);
  };

  const downloadPDF = async (resp: Response) => {
    const d = resp.response_data || {};
    const lines: string[] = [];
    for (const field of (forms.find(f => f.id === resp.form_id)?.fields || DEFAULT_FIELDS)) {
      const val = d[field.key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && typeof val === 'object') {
          lines.push(`${field.label}: ${JSON.stringify(val)}`);
        } else if (Array.isArray(val)) {
          lines.push(`${field.label}: ${val.join(', ')}`);
        } else {
          lines.push(`${field.label}: ${val}`);
        }
      }
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Form Response - ${d.email || 'Unknown'}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,Helvetica,sans-serif;padding:40px;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}h1{font-size:18px;margin-bottom:20px;}li{margin:8px 0;line-height:1.5;}}</style></head><body><h1>Exploration Form Response</h1><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) { console.error('Print failed', e); }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 5000);
      };
      setTimeout(triggerPrint, 300);
    }
  };

  const removeField = (idx: number) => setEditFields(f => f.filter((_, i) => i !== idx));
  const addField = () => setEditFields(f => [...f, { section: 'Personal', label: 'Custom Field', key: 'custom_' + Date.now(), type: 'text', required: false }]);
  const updateField = (idx: number, key: string, val: any) => setEditFields(f => f.map((field, i) => i === idx ? { ...field, [key]: val } : field));

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>;

  const selectedForm = forms.find(f => f.id === selectedFormId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Know Your Coachee</h2>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /> New Form Version
        </button>
      </div>

      {!editing ? (
        <>
          {/* Form versions list */}
          <div className="space-y-2">
            {forms.map(f => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{f.form_name} {f.is_default && <span className="text-xs text-teal-600 ml-1">(Default Template)</span>}</p>
                  <p className="text-xs text-gray-500">Version {f.version} · {f.fields?.length || 0} fields · {new Date(f.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit & save as new version"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => loadResponses(f.id)} className="p-1.5 rounded-lg hover:bg-gray-100" title="View responses"><Eye className="w-3.5 h-3.5 text-teal-600" /></button>
                {!f.is_default && <button onClick={() => deleteForm(f.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete form"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
              </div>
            ))}
          </div>

          {/* Responses modal */}
          {showResponses && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowResponses(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-800">Form Responses ({responses.length})</h3>
                  <button onClick={() => setShowResponses(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
                {responses.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No responses yet. The coachee can fill the form from their session view.</p> : (
                  <div className="space-y-3">
                    {responses.map(r => {
                      const d = r.response_data || {};
                      return (
                        <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{d.name || d.email || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">{d.email} · {new Date(r.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.promoted_to_coachee && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Promoted</span>}
                              <button onClick={() => downloadPDF(r)} className="text-xs text-sky-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" /> PDF</button>
                              {!r.promoted_to_coachee && <button onClick={() => promoteToCoachee(r)} className="text-xs text-teal-600 hover:underline flex items-center gap-1"><UserPlus className="w-3 h-3" /> Promote</button>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {Object.entries(d).filter(([k]) => k !== 'name' && k !== 'email').map(([k, v]) => (
                              <div key={k} className="text-gray-600"><span className="font-medium text-gray-700">{k}:</span> {Array.isArray(v) ? (v as any[]).map(x => typeof x === 'object' ? `${x.value}: ${x.reason}` : x).join(', ') : String(v)}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Form editor */
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Form name" />
            <button onClick={saveForm} disabled={saving} className="flex items-center gap-1 text-xs text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save as new version
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>

          <p className="text-xs text-gray-500">Edit fields below. Removing or adding fields creates your custom version. Out-of-the-box fields are shown by default.</p>

          {['Personal', 'Knowing you better'].map(section => (
            <div key={section} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{section}</h4>
              {editFields.filter(f => f.section === section).map((field, idx) => {
                const realIdx = editFields.indexOf(field);
                return (
                  <div key={realIdx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <input value={field.label} onChange={e => updateField(realIdx, 'label', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white" />
                    <select value={field.type} onChange={e => updateField(realIdx, 'type', e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
                      {FIELD_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={field.required} onChange={e => updateField(realIdx, 'required', e.target.checked)} /> Req</label>
                    {(field.type === 'dropdown' || field.type === 'multiselect') && (
                      <input value={(field.options || []).join(', ')} onChange={e => updateField(realIdx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-40 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white" placeholder="comma separated options" />
                    )}
                    <button onClick={() => removeField(realIdx)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                );
              })}
            </div>
          ))}
          <button onClick={addField} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700"><Plus className="w-3.5 h-3.5" /> Add custom field</button>
        </div>
      )}
    </div>
  );
}
