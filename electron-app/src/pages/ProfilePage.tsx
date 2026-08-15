import React, { useState } from 'react';
import { CreditCard as Edit2, Save, X, User, Briefcase, TrendingUp, LogOut } from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';

interface Props {
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  onSignOut: () => void;
}

const PROFESSION_LABEL: Record<string, string> = { job: 'Job', business: 'Business' };

export default function ProfilePage({ profile, onProfileUpdate, onSignOut }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const field = (k: keyof UserProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.date_of_birth || !form.gender || !form.profession || !form.job_business_details.trim() || !form.marital_status || form.children === null) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await supabase
      .from('user_profiles')
      .update({
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        profession: form.profession,
        job_business_details: form.job_business_details.trim(),
        marital_status: form.marital_status,
        children: form.children,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onProfileUpdate(data as UserProfile);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setForm({ ...profile });
    setEditing(false);
    setError('');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    if (!newPassword || !confirmPassword) { setPasswordMsg('Please fill in both fields.'); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg('Passwords do not match.'); return; }
    if (newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters.'); return; }
    setPasswordLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (err) { setPasswordMsg(err.message); return; }
    setPasswordMsg('Password updated successfully.');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => { setPasswordMsg(''); setShowPasswordChange(false); }, 2000);
  };

  const dobDisplay = profile.date_of_birth
    ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="px-5 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your personal information</p>
        </div>
        <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center shadow-md">
          <User className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
      </div>

      {/* View Mode */}
      {!editing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">Profile Summary</p>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { label: 'Name', value: profile.full_name },
              { label: 'DOB', value: dobDisplay },
              { label: 'Gender', value: profile.gender },
              { label: 'Profession', value: PROFESSION_LABEL[profile.profession] ?? profile.profession },
              { label: 'Job / Business Details', value: profile.job_business_details },
              { label: 'Marital Status', value: profile.marital_status },
              { label: 'Children', value: String(profile.children) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-5 py-3.5">
                <p className="text-xs text-gray-400 w-40 flex-shrink-0">{label}</p>
                <p className="text-sm font-medium text-gray-800 text-right">{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {editing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-800">Edit Profile</p>
            <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => field('full_name', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.date_of_birth ?? ''}
              onChange={(e) => field('date_of_birth', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender <span className="text-red-500">*</span></label>
            <select
              value={form.gender}
              onChange={(e) => field('gender', e.target.value)}
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
            <label className="block text-xs font-semibold text-gray-600 mb-2">Profession <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'job', icon: Briefcase, title: 'Job', desc: 'I work for someone' },
                { value: 'business', icon: TrendingUp, title: 'Business', desc: 'I run my own thing' },
              ].map(({ value, icon: Icon, title, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field('profession', value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    form.profession === value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 bg-white hover:border-teal-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${form.profession === value ? 'text-teal-600' : 'text-gray-400'}`} />
                  <p className={`text-xs font-bold ${form.profession === value ? 'text-teal-700' : 'text-gray-600'}`}>{title}</p>
                  <p className={`text-[10px] text-center ${form.profession === value ? 'text-teal-500' : 'text-gray-400'}`}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Job / Business Details <span className="text-red-500">*</span></label>
            <textarea
              value={form.job_business_details}
              onChange={(e) => field('job_business_details', e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{form.job_business_details.length} / 200</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Marital Status <span className="text-red-500">*</span></label>
            <select
              value={form.marital_status}
              onChange={(e) => field('marital_status', e.target.value)}
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Children <span className="text-red-500">*</span></label>
            <select
              value={String(form.children)}
              onChange={(e) => setForm((f) => ({ ...f, children: parseInt(e.target.value, 10) }))}
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

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl shadow-sm shadow-teal-200 hover:opacity-90 transition-all disabled:opacity-60 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <button
          onClick={() => { setShowPasswordChange((v) => !v); setPasswordMsg(''); }}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:text-teal-700 transition-colors"
        >
          <span>Change Password</span>
          <span className="text-xs text-gray-400">{showPasswordChange ? 'Cancel' : 'Update'}</span>
        </button>

        {showPasswordChange && (
          <form onSubmit={handlePasswordChange} className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              />
            </div>
            {passwordMsg && (
              <p className={`text-xs rounded-xl px-4 py-2.5 ${passwordMsg.includes('success') ? 'text-teal-700 bg-teal-50' : 'text-red-600 bg-red-50'}`}>
                {passwordMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl text-sm hover:opacity-90 transition-all disabled:opacity-60"
            >
              {passwordLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
}
