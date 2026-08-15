import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Briefcase, TrendingUp, Target } from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';

interface Props {
  userId: string;
  prefillName: string;
  onComplete: (profile: UserProfile) => void;
}

const STEP_COUNT = 4;

const STEP_IMAGES = [
  'https://images.pexels.com/photos/3807571/pexels-photo-3807571.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/4473398/pexels-photo-4473398.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/7180617/pexels-photo-7180617.jpeg?auto=compress&cs=tinysrgb&w=400',
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                done
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : active
                  ? 'border-teal-600 text-teal-600 bg-white'
                  : 'border-gray-200 text-gray-400 bg-white'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < STEP_COUNT - 1 && (
              <div className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${done ? 'bg-teal-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function OnboardingPage({ userId, prefillName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(prefillName);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [profession, setProfession] = useState('');
  const [jobDetails, setJobDetails] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [children, setChildren] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validateStep = () => {
    if (step === 0 && (!fullName.trim() || !dob)) return 'Please fill in all required fields.';
    if (step === 1 && (!gender || !profession || !jobDetails.trim())) return 'Please fill in all required fields.';
    if (step === 2 && (!maritalStatus || children === '')) return 'Please fill in all required fields.';
    return '';
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep((s) => s + 1);
  };

  const handleBack = () => { setError(''); setStep((s) => s - 1); };

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    const profileData = {
      id: userId,
      full_name: fullName.trim(),
      date_of_birth: dob,
      gender,
      profession,
      job_business_details: jobDetails.trim(),
      marital_status: maritalStatus,
      children: parseInt(children, 10),
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };
    const { data, error: err } = await supabase
      .from('user_profiles')
      .upsert(profileData)
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onComplete(data as UserProfile);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar stub — matches AppShell layout but simplified for onboarding */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-700 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
            <Target className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">Calm On</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 opacity-40 pointer-events-none select-none">
          {['Dashboard', 'Vision Board', 'Parked Thoughts', 'History', 'Settings', 'Profile'].map((label) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              {label}
            </div>
          ))}
        </nav>
        <div className="px-5 py-6 text-center">
          <p className="text-xs font-semibold text-gray-400 leading-relaxed">Small steps.<br />Calm mind.<br />Big change.</p>
          <div className="mt-2 text-lg text-teal-400">♡</div>
        </div>
      </aside>

      {/* Main onboarding area */}
      <div className="flex-1 flex items-start justify-center p-6 md:p-10 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="mb-2">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Profile Onboarding</span>
          </div>
          <StepIndicator current={step} />

          {/* Step 0 — Name & DOB */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex justify-center mb-2">
                <img
                  src={STEP_IMAGES[0]}
                  alt="Get to know you"
                  className="w-48 h-36 object-cover rounded-2xl shadow-md"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Let's get to know you</h2>
                <p className="text-sm text-gray-500 mt-1">This helps us personalize Calm On for your journey.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  1. Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  2. Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
            </div>
          )}

          {/* Step 1 — Gender, Profession, Job Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex justify-center mb-2">
                <img
                  src={STEP_IMAGES[1]}
                  alt="Your work"
                  className="w-48 h-36 object-cover rounded-2xl shadow-md"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  3. Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  4. Profession <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'job', icon: Briefcase, title: 'Job', desc: 'I work for someone' },
                    { value: 'business', icon: TrendingUp, title: 'Business', desc: 'I run my own thing' },
                  ].map(({ value, icon: Icon, title, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProfession(value)}
                      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200 ${
                        profession === value
                          ? 'border-teal-500 bg-teal-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-teal-300'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        profession === value ? 'bg-teal-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${profession === value ? 'text-teal-600' : 'text-gray-500'}`} />
                      </div>
                      <p className={`text-sm font-bold ${profession === value ? 'text-teal-700' : 'text-gray-700'}`}>{title}</p>
                      <p className={`text-xs text-center ${profession === value ? 'text-teal-500' : 'text-gray-400'}`}>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  5. Job / Business Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={jobDetails}
                  onChange={(e) => setJobDetails(e.target.value)}
                  maxLength={200}
                  rows={4}
                  placeholder="Describe your role, industry, or business in a few lines..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{jobDetails.length} / 200</p>
              </div>
            </div>
          )}

          {/* Step 2 — Marital Status & Children */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-center mb-2">
                <img
                  src={STEP_IMAGES[2]}
                  alt="Your family"
                  className="w-48 h-36 object-cover rounded-2xl shadow-md"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  6. Marital Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition bg-white"
                >
                  <option value="">Select marital status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  7. Children <span className="text-red-500">*</span>
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition bg-white"
                >
                  <option value="">Select number of children</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5+</option>
                </select>
              </div>
              <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-sm text-teal-700 leading-relaxed">
                Every detail you share helps us support your journey better.
              </div>
            </div>
          )}

          {/* Step 3 — Summary & Complete */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex justify-center mb-2">
                <img
                  src={STEP_IMAGES[3]}
                  alt="All set"
                  className="w-48 h-36 object-cover rounded-2xl shadow-md"
                />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
                <p className="text-sm text-gray-500 mt-1">Your profile helps us personalize Calm On just for you.</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-800">Your Profile Summary</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'Name', value: fullName },
                    { label: 'DOB', value: dob ? new Date(dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Gender', value: gender },
                    { label: 'Profession', value: profession === 'job' ? 'Job' : profession === 'business' ? 'Business' : '—' },
                    { label: 'Job / Business Details', value: jobDetails },
                    { label: 'Marital Status', value: maritalStatus },
                    { label: 'Children', value: children },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between px-5 py-3">
                      <p className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</p>
                      <p className="text-xs font-medium text-gray-800 text-right">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">{error}</p>
          )}

          {/* Navigation */}
          <div className={`flex gap-3 mt-8 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl text-sm font-semibold shadow-sm shadow-teal-200 hover:opacity-90 transition-all"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl text-sm font-semibold shadow-sm shadow-teal-200 hover:opacity-90 transition-all disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Complete Onboarding'}
                {!saving && <span className="text-base">🎉</span>}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1">
            <span>🔒</span> Your information is private and secure
          </p>
        </div>
      </div>
    </div>
  );
}
