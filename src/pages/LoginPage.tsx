import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../supabase';

interface Props {
  onAuth: () => void;
}

type Tab = 'signin' | 'signup';

const BG_IMAGES = [
  'https://images.pexels.com/photos/6625770/pexels-photo-6625770.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/5119613/pexels-photo-5119613.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/8727573/pexels-photo-8727573.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/8764905/pexels-photo-8764905.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/30888106/pexels-photo-30888106.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/35640969/pexels-photo-35640969.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

export default function LoginPage({ onAuth }: Props) {
  const [tab, setTab] = useState<Tab>('signin');

  // sign in
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPw, setSiShowPw] = useState(false);
  const [siLoading, setSiLoading] = useState(false);
  const [siError, setSiError] = useState('');

  // sign up
  const [suFirstName, setSuFirstName] = useState('');
  const [suLastName, setSuLastName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suShowPw, setSuShowPw] = useState(false);
  const [suLoading, setSuLoading] = useState(false);
  const [suError, setSuError] = useState('');
  const [suSuccess, setSuSuccess] = useState('');

  // forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiLoading(true);
    setSiError('');
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword });
    if (error) {
      setSiError(error.message);
      setSiLoading(false);
    } else {
      onAuth();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuError('');
    setSuSuccess('');
    if (suPassword !== suConfirm) { setSuError('Passwords do not match.'); return; }
    if (suPassword.length < 6) { setSuError('Password must be at least 6 characters.'); return; }
    setSuLoading(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPassword,
      options: { data: { first_name: suFirstName, last_name: suLastName, full_name: `${suFirstName} ${suLastName}`.trim() } },
    });
    if (error) {
      setSuError(error.message);
      setSuLoading(false);
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: suEmail, password: suPassword });
    setSuLoading(false);
    if (signInErr) {
      setSuSuccess('Account created! Please sign in.');
      setTab('signin');
      setSiEmail(suEmail);
    } else {
      onAuth();
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpLoading(true);
    setFpMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
      redirectTo: window.location.origin,
    });
    setFpLoading(false);
    setFpMsg(error ? error.message : 'If an account exists, a reset link has been sent to your email.');
  };

  // Distribute images across the grid positions
  const gridImages = [
    BG_IMAGES[0], BG_IMAGES[1], BG_IMAGES[2],
    BG_IMAGES[3], BG_IMAGES[4], BG_IMAGES[5],
    BG_IMAGES[1], BG_IMAGES[2],
  ];

  return (
    <div className="min-h-screen w-full flex items-stretch bg-gray-900">
      {/* Background grid of smiling faces — hidden on small screens */}
      <div className="hidden lg:grid grid-cols-4 gap-0 flex-1 auto-rows-fr opacity-90">
        {gridImages.map((src, i) => (
          <div key={i} className="relative overflow-hidden h-full min-h-[200px]">
            <img src={src} alt="" className="w-full h-full object-cover" style={{ filter: 'saturate(1.05)' }} />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/10 via-transparent to-emerald-900/10" />
          </div>
        ))}
      </div>

      {/* Login card */}
      <div className="w-full lg:w-[480px] flex-shrink-0 flex items-center justify-center px-4 py-10 bg-white lg:shadow-2xl">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-24 h-24 mx-auto mb-3 object-contain drop-shadow-md" />
            <h1 className="text-3xl font-bold text-gray-900">Buddy</h1>
            <p className="text-sm text-gray-400 mt-1">by Nudged</p>
            <p className="text-xs text-teal-600 font-semibold mt-2">World's first thought mapping app</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => { setTab('signin'); setSiError(''); setShowForgot(false); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === 'signin' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Get Started
              </button>
              <button
                onClick={() => { setTab('signup'); setSuError(''); setSuSuccess(''); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === 'signup' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Create Account
              </button>
            </div>

            <div className="p-7">
              {/* SIGN IN */}
              {tab === 'signin' && !showForgot && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                      required placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={siShowPw ? 'text' : 'password'} value={siPassword} onChange={e => setSiPassword(e.target.value)}
                        required placeholder="••••••••"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                      />
                      <button type="button" onClick={() => setSiShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {siShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {siError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{siError}</p>}
                  {suSuccess && <p className="text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">{suSuccess}</p>}
                  <button
                    type="submit" disabled={siLoading}
                    className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-all disabled:opacity-60 shadow-md shadow-teal-100 flex items-center justify-center gap-2"
                  >
                    {siLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {siLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                  <button type="button" onClick={() => { setShowForgot(true); setFpEmail(siEmail); setFpMsg(''); }} className="w-full text-xs text-teal-600 hover:text-teal-800 text-center">
                    Forgot password?
                  </button>
                </form>
              )}

              {/* FORGOT PASSWORD */}
              {tab === 'signin' && showForgot && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm font-semibold text-gray-800">Reset Password</p>
                    <p className="text-xs text-gray-500 mt-1">Enter your email and we'll send a reset link.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                      required placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                  </div>
                  {fpMsg && <p className="text-xs text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">{fpMsg}</p>}
                  <button
                    type="submit" disabled={fpLoading}
                    className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-all disabled:opacity-60 shadow-md shadow-teal-100 flex items-center justify-center gap-2"
                  >
                    {fpLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {fpLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => setShowForgot(false)} className="w-full text-xs text-gray-500 hover:text-gray-700 text-center">
                    Back to sign in
                  </button>
                </form>
              )}

              {/* SIGN UP */}
              {tab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                      <input
                        type="text" value={suFirstName} onChange={e => setSuFirstName(e.target.value)}
                        required placeholder="Riya"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                      <input
                        type="text" value={suLastName} onChange={e => setSuLastName(e.target.value)}
                        required placeholder="Sharma"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)}
                      required placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={suShowPw ? 'text' : 'password'} value={suPassword} onChange={e => setSuPassword(e.target.value)}
                        required placeholder="Min 6 characters"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                      />
                      <button type="button" onClick={() => setSuShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {suShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                    <input
                      type="password" value={suConfirm} onChange={e => setSuConfirm(e.target.value)}
                      required placeholder="Re-enter password"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                    />
                  </div>
                  {suError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{suError}</p>}
                  <button
                    type="submit" disabled={suLoading}
                    className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-teal-800 hover:to-teal-600 transition-all disabled:opacity-60 shadow-md shadow-teal-100 flex items-center justify-center gap-2"
                  >
                    {suLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {suLoading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>

            <div className="px-7 pb-5 space-y-2">
              {/* AES encryption notice */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <Lock className="w-3 h-3" />
                <span>All personal data is protected with AES-256 encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
