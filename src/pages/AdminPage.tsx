import React, { useEffect, useState } from 'react';
import { Loader2, Shield, DollarSign, Activity, User, RefreshCw, Check, X, Plus, Trash2, Ban, AlertTriangle, MessageSquare, ThumbsUp, ThumbsDown, LogIn, GraduationCap } from 'lucide-react';
import { supabase } from '../supabase';
import type { User as SupaUser } from '@supabase/supabase-js';
import CoachOnboardingSection from '../components/CoachOnboarding';
import CoachExplorer from '../components/CoachExplorer';

interface Props {
  user: SupaUser;
}

interface UserStat {
  user_id: string;
  email: string;
  full_name: string;
  balance_usd: number;
  total_granted_usd: number;
  total_spent_usd: number;
  is_exempt: boolean;
  call_count: number;
  last_used_at: string | null;
  created_at: string;
}

interface CreditRequest {
  id: string;
  user_id: string;
  requested_usd: number;
  status: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface ExemptEmail {
  email: string;
  added_by: string;
  created_at: string;
}

interface AppFeedback {
  id: string;
  email: string | null;
  feature: string;
  text_feedback: string | null;
  screenshot_url: string | null;
  created_at: string;
}

interface ReactionFeedback {
  id: string;
  email: string | null;
  action_type: string;
  is_positive: boolean;
  qualitative: string | null;
  created_at: string;
}

interface LoginEvent {
  id: string;
  email: string | null;
  created_at: string;
}

const ADMIN_EMAIL = 'deepagster@gmail.com';

export default function AdminPage({ user }: Props) {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [exemptEmails, setExemptEmails] = useState<ExemptEmail[]>([]);
  const [newExemptEmail, setNewExemptEmail] = useState('');
  const [addingExempt, setAddingExempt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bannedEmails, setBannedEmails] = useState<{ email: string; banned_by: string; created_at: string }[]>([]);
  const [newBanEmail, setNewBanEmail] = useState('');
  const [addingBan, setAddingBan] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [extRequests, setExtRequests] = useState<{id:string;user_id:string;email:string;whatsapp:string|null;amount_usd:number;status:string;created_at:string}[]>([]);
  const [appFeedback, setAppFeedback] = useState<AppFeedback[]>([]);
  const [reactionFeedback, setReactionFeedback] = useState<ReactionFeedback[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [adminTab, setAdminTab] = useState<'main' | 'coach'>('main');

  const isAdmin = user.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, reqRes, exemptRes, bannedRes, maintenanceRes, extRes, fbRes, reactionRes, loginRes] = await Promise.all([
        supabase.rpc('admin_user_stats'),
        supabase.from('credit_requests').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.rpc('list_exempt_emails'),
        supabase.from('banned_users').select('email, banned_by, created_at').order('created_at', { ascending: false }),
        supabase.from('admin_controls').select('value').eq('key', 'global_maintenance').maybeSingle(),
        supabase.from('credit_extension_requests').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('app_feedback').select('id,email,feature,text_feedback,screenshot_url,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('reaction_feedback').select('id,email,action_type,is_positive,qualitative,created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('user_login_events').select('id,email,created_at').order('created_at', { ascending: false }).limit(200),
      ]);

      if (statsRes.data) setStats(statsRes.data as UserStat[]);
      if (reqRes.data) setRequests(reqRes.data as CreditRequest[]);
      if (exemptRes.data) setExemptEmails(exemptRes.data as ExemptEmail[]);
      if (bannedRes.data) setBannedEmails(bannedRes.data as { email: string; banned_by: string; created_at: string }[]);
      if (maintenanceRes.data) setMaintenanceMode(maintenanceRes.data.value === 'true');
      if (extRes.data) setExtRequests(extRes.data as any[]);
      if (fbRes.data) setAppFeedback(fbRes.data as AppFeedback[]);
      if (reactionRes.data) setReactionFeedback(reactionRes.data as ReactionFeedback[]);
      if (loginRes.data) setLoginEvents(loginRes.data as LoginEvent[]);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (req: CreditRequest) => {
    setActionLoading(req.id);
    try {
      await supabase.rpc('grant_credit', {
        p_user_id: req.user_id,
        p_amount: req.requested_usd,
      });

      await supabase
        .from('credit_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', req.id);

      await loadData();
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRequest = async (reqId: string) => {
    setActionLoading(reqId);
    try {
      await supabase
        .from('credit_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', reqId);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExempt = async (userId: string, current: boolean) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_credits')
        .update({ is_exempt: !current, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const approveExtRequest = async (id: string, userId: string, amount: number) => {
    setActionLoading(id);
    try {
      await supabase.rpc('grant_credit', { p_user_id: userId, p_amount: amount });
      await supabase.from('credit_extension_requests').update({ status: 'approved' }).eq('id', id);
      await loadData();
    } finally { setActionLoading(null); }
  };

  const rejectExtRequest = async (id: string) => {
    setActionLoading(id);
    try {
      await supabase.from('credit_extension_requests').update({ status: 'rejected' }).eq('id', id);
      await loadData();
    } finally { setActionLoading(null); }
  };

  const addExemptEmail = async () => {
    if (!newExemptEmail.trim()) return;
    setAddingExempt(true);
    try {
      await supabase.rpc('add_exempt_email', { p_email: newExemptEmail.trim(), p_added_by: user.email ?? 'admin' });
      setNewExemptEmail('');
      await loadData();
    } finally {
      setAddingExempt(false);
    }
  };

  const removeExemptEmail = async (email: string) => {
    setActionLoading(email);
    try {
      await supabase.rpc('remove_exempt_email', { p_email: email });
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const toggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      await supabase.from('admin_controls').update({ value: (!maintenanceMode).toString() }).eq('key', 'global_maintenance');
      setMaintenanceMode(m => !m);
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const banUser = async () => {
    if (!newBanEmail.trim()) return;
    setAddingBan(true);
    try {
      await supabase.from('banned_users').insert({ email: newBanEmail.trim(), banned_by: user.email ?? 'admin' });
      setNewBanEmail('');
      await loadData();
    } finally {
      setAddingBan(false);
    }
  };

  const unbanUser = async (email: string) => {
    setActionLoading('ban_' + email);
    try {
      await supabase.from('banned_users').delete().eq('email', email);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-600 font-semibold">Access Restricted</p>
          <p className="text-sm text-gray-400">This area is for administrators only.</p>
        </div>
      </div>
    );
  }

  const totalUsers = stats.length;
  const totalSpent = stats.reduce((s, u) => s + (u.total_spent_usd ?? 0), 0);
  const totalGranted = stats.reduce((s, u) => s + (u.total_granted_usd ?? 0), 0);
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
              <p className="text-xs text-gray-400">Nudged usage & credit management</p>
            </div>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Admin tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([['main', 'Main', Shield], ['coach', 'Coach', GraduationCap]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setAdminTab(k)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${adminTab === k ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {adminTab === 'coach' ? (
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-teal-600" /> Coach Explorer</h2>
            <p className="text-xs text-gray-500 mb-4">View all capsules and sessions created by every coach. Use filters to narrow down.</p>
          </div>
          <CoachExplorer showCoach />
        </div>
      ) : (
        <>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Registered Users', value: totalUsers, icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Granted', value: `$${totalGranted.toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Spent', value: `$${totalSpent.toFixed(4)}`, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Pending Requests', value: pendingRequests.length, icon: RefreshCw, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Pending credit requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-orange-50 bg-orange-50">
              <h2 className="text-sm font-bold text-orange-800">Pending Top-Up Requests ({pendingRequests.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-5 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{req.user_id}</p>
                    <p className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString()} · Requesting ${req.requested_usd}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => approveRequest(req)}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-all disabled:opacity-50"
                    >
                      {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">All Users</h2>
            <p className="text-xs text-gray-400">{totalUsers} registered</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Granted</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Spent</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Calls</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Exempt</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800 text-xs">{u.full_name || '—'}</p>
                        <p className="text-gray-400 text-xs truncate max-w-[180px]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${u.balance_usd > 0.5 ? 'text-green-600' : u.balance_usd > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                          ${(u.balance_usd ?? 0).toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">${(u.total_granted_usd ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">${(u.total_spent_usd ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">{u.call_count ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleExempt(u.user_id, u.is_exempt)}
                          disabled={actionLoading === u.user_id}
                          className={`w-7 h-4 rounded-full transition-colors ${u.is_exempt ? 'bg-teal-500' : 'bg-gray-200'}`}
                        >
                          <span className={`block w-3 h-3 bg-white rounded-full shadow transition-transform mx-auto ${u.is_exempt ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u.last_used_at ? new Date(u.last_used_at).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                  {stats.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Exempt email list management */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Unlimited Access List</h2>
              <p className="text-xs text-gray-400 mt-0.5">Users on this list have no credit limits</p>
            </div>
            <span className="text-xs text-gray-400">{exemptEmails.length} entries</span>
          </div>
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex gap-2">
              <input
                type="email"
                value={newExemptEmail}
                onChange={(e) => setNewExemptEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExemptEmail()}
                placeholder="Add email address..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={addExemptEmail}
                disabled={addingExempt || !newExemptEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all disabled:opacity-50"
              >
                {addingExempt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {exemptEmails.length === 0 && (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">No entries yet</p>
            )}
            {exemptEmails.map((e) => (
              <div key={e.email} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.email}</p>
                  <p className="text-xs text-gray-400">Added by {e.added_by} · {new Date(e.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => removeExemptEmail(e.email)}
                  disabled={actionLoading === e.email}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {actionLoading === e.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance mode + Ban controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Maintenance mode */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-800">Maintenance Mode</h2>
            </div>
            <div className="px-5 py-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-700 font-medium">{maintenanceMode ? 'App is in maintenance' : 'App is live'}</p>
                <p className="text-xs text-gray-400 mt-0.5">When enabled, all non-admin users see a maintenance screen.</p>
              </div>
              <button
                onClick={toggleMaintenance}
                disabled={togglingMaintenance}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${maintenanceMode ? 'bg-orange-500' : 'bg-gray-200'} disabled:opacity-60`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${maintenanceMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Ban user */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-gray-800">Ban User</h2>
              <span className="ml-auto text-xs text-gray-400">{bannedEmails.length} banned</span>
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newBanEmail}
                  onChange={(e) => setNewBanEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && banUser()}
                  placeholder="Enter email to ban..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={banUser}
                  disabled={addingBan || !newBanEmail.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {addingBan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Ban
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
              {bannedEmails.length === 0 && (
                <p className="px-5 py-4 text-center text-gray-400 text-sm">No banned users</p>
              )}
              {bannedEmails.map((b) => (
                <div key={b.email} className="flex items-center justify-between px-5 py-2.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{b.email}</p>
                    <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => unbanUser(b.email)}
                    disabled={actionLoading === 'ban_' + b.email}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {actionLoading === 'ban_' + b.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Unban
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-10 space-y-6">
      {/* Credit Extension Requests */}
      {extRequests.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3 px-1">Credit Extension Requests ({extRequests.filter(r => r.status === 'pending').length} pending)</h2>
          <div className="space-y-2">
            {extRequests.filter(r => r.status === 'pending').map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{r.email}</p>
                  {r.whatsapp && <p className="text-xs text-gray-400">WhatsApp: {r.whatsapp}</p>}
                  <p className="text-xs text-gray-400">${r.amount_usd} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveExtRequest(r.id, r.user_id, r.amount_usd)} disabled={actionLoading === r.id} className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition disabled:opacity-50">
                    {actionLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                  </button>
                  <button onClick={() => rejectExtRequest(r.id)} disabled={actionLoading === r.id} className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App Feedback */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-gray-800">App Feedback</h2>
          <span className="ml-auto text-xs text-gray-400">{appFeedback.length} entries</span>
        </div>
        {appFeedback.length === 0 ? (
          <p className="px-5 py-6 text-center text-gray-400 text-sm">No feedback yet</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {appFeedback.map(fb => (
              <div key={fb.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700 truncate">{fb.email ?? 'unknown'}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(fb.created_at).toLocaleString()}</span>
                </div>
                <span className="inline-block text-xs bg-teal-50 text-teal-700 rounded-full px-2 py-0.5 mb-1">{fb.feature}</span>
                {fb.text_feedback && <p className="text-xs text-gray-600 mt-1">{fb.text_feedback}</p>}
                {fb.screenshot_url && (
                  <a href={fb.screenshot_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                    <img src={fb.screenshot_url} alt="screenshot" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reaction Feedback */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-green-600" />
          <h2 className="text-sm font-bold text-gray-800">Reaction Feedback</h2>
          <span className="ml-auto text-xs text-gray-400">{reactionFeedback.filter(r => r.is_positive).length} positive / {reactionFeedback.filter(r => !r.is_positive).length} negative</span>
        </div>
        {reactionFeedback.length === 0 ? (
          <p className="px-5 py-6 text-center text-gray-400 text-sm">No reactions yet</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {reactionFeedback.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-start gap-3">
                {r.is_positive
                  ? <ThumbsUp className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <ThumbsDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 truncate">{r.email ?? 'unknown'}</span>
                    <span className="text-xs text-gray-400">{r.action_type}</span>
                    <span className="text-xs text-gray-300 flex-shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.qualitative && <p className="text-xs text-gray-500 mt-0.5 italic">"{r.qualitative}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Login Events */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <LogIn className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-gray-800">Login Events</h2>
          <span className="ml-auto text-xs text-gray-400">{loginEvents.length} recent</span>
        </div>
        {loginEvents.length === 0 ? (
          <p className="px-5 py-6 text-center text-gray-400 text-sm">No login events yet</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {loginEvents.map(ev => (
              <div key={ev.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                <span className="text-sm text-gray-700 truncate">{ev.email ?? 'unknown'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Nudged Buddy Coach Onboarding */}
      <CoachOnboardingSection user={user} />
        </>
      )}
    </div>
  );
}
