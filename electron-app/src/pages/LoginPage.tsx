import React, { useState } from 'react';
import { Target } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

interface Props {
  onAuth: () => void;
}

export default function LoginPage({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); setInfo(''); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onAuth();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onAuth();
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setInfo('Password reset instructions sent to your email.');
  };

  const logoBlock = (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 bg-gradient-to-br from-teal-700 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
        <Target className="w-7 h-7 text-white" strokeWidth={2.2} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Calm On</h1>
      <p className="text-sm text-gray-500 mt-1">Small steps. Calm mind. Big change.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {logoBlock}

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {/* Mode tabs */}
          {mode !== 'reset' && (
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-7">
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); reset(); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                    mode === m ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          )}

          {/* Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl shadow-sm shadow-teal-200 hover:opacity-90 transition-all disabled:opacity-60 text-sm"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('reset'); reset(); }}
                className="w-full text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors mt-1"
              >
                Forgot your password?
              </button>
            </form>
          )}

          {/* Create Account */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Riya"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Sharma"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email (your login ID) <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl shadow-sm shadow-teal-200 hover:opacity-90 transition-all disabled:opacity-60 text-sm"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Reset Password */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
                <p className="text-xs text-gray-500 mt-1">Enter your email and we'll send you reset instructions.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}
              {info && <p className="text-xs text-teal-700 bg-teal-50 rounded-xl px-4 py-2.5">{info}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white font-semibold py-3 rounded-xl shadow-sm shadow-teal-200 hover:opacity-90 transition-all disabled:opacity-60 text-sm"
              >
                {loading ? 'Sending…' : 'Send Reset Instructions'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signin'); reset(); }}
                className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Your information is private and secure.</p>
      </div>
    </div>
  );
}
