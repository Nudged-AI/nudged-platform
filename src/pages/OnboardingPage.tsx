import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Briefcase, Leaf, Calendar, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  onComplete: () => void;
}

interface ProfileData {
  full_name: string;
  date_of_birth: string;
  gender: string;
  profession: string;
  job_business_details: string;
  marital_status: string;
  children: number;
}

const STEPS = 4;

const stepIllustrations = [
  'https://images.pexels.com/photos/3807571/pexels-photo-3807571.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=400',
];

export default function OnboardingPage({ user, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const defaultName = (user.user_metadata?.full_name as string) ||
    `${user.user_metadata?.first_name ?? ''} ${user.user_metadata?.last_name ?? ''}`.trim() || '';

  const [data, setData] = useState<ProfileData>({
    full_name: defaultName,
    date_of_birth: '',
    gender: '',
    profession: '',
    job_business_details: '',
    marital_status: '',
    children: 0,
  });

  const set = (field: keyof ProfileData, value: string | number) =>
    setData(d => ({ ...d, [field]: value }));

  const validateStep = () => {
    if (step === 1) return data.full_name.trim() !== '' && data.date_of_birth !== '';
    if (step === 2) return data.gender !== '' && data.profession !== '' && data.job_business_details.trim() !== '';
    if (step === 3) return data.marital_status !== '' && data.children >= 0;
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) { setError('Please fill all required fields.'); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = () => { setError(''); setStep(s => s - 1); };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    const { error: dbErr } = await supabase.from('user_profiles').upsert({
      id: user.id,
      ...data,
      date_of_birth: data.date_of_birth || null,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onComplete();
  };

  const completedSteps = step - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex">
      {/* Left illustration panel – desktop only */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col bg-gradient-to-b from-teal-700 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full" />
          <div className="absolute bottom-20 right-5 w-60 h-60 bg-white rounded-full" />
        </div>
        <div className="relative z-10 flex flex-col h-full p-8">
          <div className="flex items-center gap-2 mb-auto">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base">Nudged</span>
          </div>
          <div className="mb-8">
            <img
              src={stepIllustrations[step - 1]}
              alt="onboarding illustration"
              className="w-full h-48 object-cover rounded-2xl opacity-80"
            />
          </div>
          <div>
            <p className="text-white/80 text-xs font-medium uppercase tracking-widest mb-1">Step {step} of {STEPS}</p>
            <p className="text-white text-xl font-bold leading-snug">
              {step === 1 && "Let's get to know you"}
              {step === 2 && 'Your work & identity'}
              {step === 3 && 'Your personal life'}
              {step === 4 && "Welcome to Nudged!"}
            </p>
            <p className="text-white/70 text-sm mt-2">
              {step === 1 && 'Tell us your name and when you were born.'}
              {step === 2 && 'Help us understand your professional side.'}
              {step === 3 && 'Every detail helps us support you better.'}
              {step === 4 && "World's First Digital Motivation Platform — your $5 AI credits are ready."}
            </p>
          </div>
          <p className="text-white/50 text-xs mt-8 flex items-center gap-1"><Lock className="w-3 h-3" /> All personal data is protected with AES-256 encryption</p>
        </div>
      </div>

      {/* Main form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <p className="text-xs text-teal-600 font-semibold uppercase tracking-widest mb-1">Profile Onboarding</p>
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 1 && "Let's get to know you"}
              {step === 2 && 'Your work & identity'}
              {step === 3 && 'Your personal life'}
              {step === 4 && "Welcome to Nudged!"}
            </h2>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: STEPS }).map((_, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <React.Fragment key={n}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${done ? 'bg-teal-600 border-teal-600 text-white' : active ? 'bg-white border-teal-600 text-teal-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </div>
                  {i < STEPS - 1 && <div className={`flex-1 h-0.5 rounded-full transition-all ${n < step ? 'bg-teal-500' : 'bg-gray-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-7">
            {/* STEP 1: Name & DOB */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="lg:hidden mb-4">
                  <img src={stepIllustrations[0]} alt="" className="w-full h-36 object-cover rounded-xl opacity-80" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    1. Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={data.full_name} onChange={e => set('full_name', e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    2. Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date" value={data.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Gender, Profession, Details */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    3. Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={data.gender} onChange={e => set('gender', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    4. Profession <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'Job', icon: Briefcase, label: 'Job', sub: 'I work for someone' },
                      { value: 'Business', icon: Leaf, label: 'Business', sub: 'I run my own thing' },
                    ].map(({ value, icon: Icon, label, sub }) => (
                      <button
                        key={value} type="button"
                        onClick={() => set('profession', value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${data.profession === value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data.profession === value ? 'bg-teal-100' : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${data.profession === value ? 'text-teal-600' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-sm font-semibold ${data.profession === value ? 'text-teal-700' : 'text-gray-700'}`}>{label}</span>
                        <span className="text-xs text-gray-400 text-center">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    5. Job / Business Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={data.job_business_details} onChange={e => set('job_business_details', e.target.value)}
                    maxLength={200} rows={3}
                    placeholder="Describe your role, industry, or business in a few lines..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{data.job_business_details.length} / 200</p>
                </div>
              </div>
            )}

            {/* STEP 3: Marital Status & Children */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="lg:hidden mb-4">
                  <img src={stepIllustrations[2]} alt="" className="w-full h-36 object-cover rounded-xl opacity-80" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    6. Marital Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={data.marital_status} onChange={e => set('marital_status', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select marital status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    7. Children <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={data.children} onChange={e => set('children', parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white"
                  >
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n === 0 ? 'None' : n === 5 ? '5 or more' : n}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <p className="text-sm text-teal-700 font-medium">Every detail you share helps us support your journey better.</p>
                </div>
              </div>
            )}

            {/* STEP 4: Branded welcome slide */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-100">
                  <Leaf className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Nudged</h3>
                  <p className="text-teal-600 font-semibold text-base">World's First Digital Motivation Platform</p>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto mt-3 leading-relaxed">
                    You're all set! Nudged will use your profile to deliver personalised nudges, rituals, and insights — every day.
                  </p>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-2xl px-5 py-4 w-full text-center">
                  <p className="text-teal-700 text-sm font-medium">You've been gifted <span className="font-bold">$5 AI credits</span> to explore Harry, Rituals, Good News and more.</p>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{error}</p>}

            {/* Navigation */}
            <div className={`flex gap-3 mt-6 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
              {step > 1 && (
                <button type="button" onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              )}
              {step < STEPS ? (
                <button type="button" onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition shadow-md shadow-teal-100"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition shadow-md shadow-teal-100 disabled:opacity-60"
                >
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Complete Onboarding
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Nudged — World's 1st digital motivation app.
          </p>
        </div>
      </div>
    </div>
  );
}
