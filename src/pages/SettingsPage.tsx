import React, { useEffect, useState } from 'react';
import { Settings, Clock, Bell, Monitor, Globe, Plus, X, Save, Check, BookOpen } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { resetAllTutorials } from '../components/Tutorial';

interface UserSettings {
  id?: string;
  default_session_duration: number;
  default_reminder_tolerance: number;
  idle_exempt_apps: string[];
  idle_exempt_websites: string[];
}

interface Props {
  user: User;
}

const DEFAULT_SETTINGS: UserSettings = {
  default_session_duration: 25,
  default_reminder_tolerance: 30,
  idle_exempt_apps: [],
  idle_exempt_websites: [],
};

export default function SettingsPage({ user }: Props) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newApp, setNewApp] = useState('');
  const [newSite, setNewSite] = useState('');

  useEffect(() => {
    loadSettings();
  }, [user.id]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        id: data.id,
        default_session_duration: data.default_session_duration ?? 25,
        default_reminder_tolerance: data.default_reminder_tolerance ?? 30,
        idle_exempt_apps: data.idle_exempt_apps ?? [],
        idle_exempt_websites: data.idle_exempt_websites ?? [],
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      user_id: user.id,
      default_session_duration: settings.default_session_duration,
      default_reminder_tolerance: settings.default_reminder_tolerance,
      idle_exempt_apps: settings.idle_exempt_apps,
      idle_exempt_websites: settings.idle_exempt_websites,
      updated_at: new Date().toISOString(),
    };

    if (settings.id) {
      await supabase.from('settings').update(payload).eq('id', settings.id);
    } else {
      const { data } = await supabase.from('settings').insert(payload).select('id').single();
      if (data) setSettings((s) => ({ ...s, id: data.id }));
    }
    // Bridge default duration to extension for widget access
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ returnon_default_duration: settings.default_session_duration });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addApp = () => {
    const val = newApp.trim();
    if (!val || settings.idle_exempt_apps.includes(val)) return;
    setSettings((s) => ({ ...s, idle_exempt_apps: [...s.idle_exempt_apps, val] }));
    setNewApp('');
  };

  const removeApp = (app: string) =>
    setSettings((s) => ({ ...s, idle_exempt_apps: s.idle_exempt_apps.filter((a) => a !== app) }));

  const addSite = () => {
    const val = newSite.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!val || settings.idle_exempt_websites.includes(val)) return;
    setSettings((s) => ({ ...s, idle_exempt_websites: [...s.idle_exempt_websites, val] }));
    setNewSite('');
  };

  const removeSite = (site: string) =>
    setSettings((s) => ({ ...s, idle_exempt_websites: s.idle_exempt_websites.filter((w) => w !== site) }));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure your focus session defaults.</p>
        </div>
        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-teal-600" />
        </div>
      </div>

      {/* Default Session Duration */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          <Clock className="w-3.5 h-3.5 text-teal-600" />
          Default Session Duration
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Used as the pre-filled duration when you start a new session and as the default extension time.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[15, 20, 25, 45, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, default_session_duration: d }))}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                settings.default_session_duration === d
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
              }`}
            >
              {d} min
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={480}
            value={
              [15, 20, 25, 45, 60, 90].includes(settings.default_session_duration)
                ? ''
                : settings.default_session_duration
            }
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) setSettings((s) => ({ ...s, default_session_duration: v }));
            }}
            placeholder="Custom"
            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Default Reminder Tolerance */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          <Bell className="w-3.5 h-3.5 text-teal-600" />
          Default Reminder Tolerance
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Seconds before the widget nudges you back when you deviate from allowed sites.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[10, 20, 30, 60, 120].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, default_reminder_tolerance: t }))}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                settings.default_reminder_tolerance === t
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
              }`}
            >
              {t}s
            </button>
          ))}
          <input
            type="number"
            min={5}
            max={300}
            value={
              [10, 20, 30, 60, 120].includes(settings.default_reminder_tolerance)
                ? ''
                : settings.default_reminder_tolerance
            }
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 5) setSettings((s) => ({ ...s, default_reminder_tolerance: v }));
            }}
            placeholder="Custom"
            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Idle-exempt Apps */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Monitor className="w-3.5 h-3.5 text-teal-600" />
          Idle-Exempt Desktop Apps
        </label>
        <p className="text-xs text-gray-400 mb-3">
          When these app domains are active, idle detection is suppressed (e.g. video calls, presentations).
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addApp())}
            placeholder="e.g. teams.microsoft.com"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={addApp}
            className="px-3 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {settings.idle_exempt_apps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {settings.idle_exempt_apps.map((app) => (
              <span key={app} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
                {app}
                <button onClick={() => removeApp(app)} className="text-gray-400 hover:text-red-400 transition">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No exempt apps added.</p>
        )}
      </div>

      {/* Idle-exempt Websites */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Globe className="w-3.5 h-3.5 text-teal-600" />
          Idle-Exempt Websites
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Visiting these sites won't trigger idle detection (e.g. reference docs you read without clicking).
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSite())}
            placeholder="e.g. docs.google.com"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={addSite}
            className="px-3 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {settings.idle_exempt_websites.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {settings.idle_exempt_websites.map((site) => (
              <span key={site} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
                {site}
                <button onClick={() => removeSite(site)} className="text-gray-400 hover:text-red-400 transition">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No exempt websites added.</p>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-700 to-teal-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition disabled:opacity-60"
        >
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : saving ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save Settings</>
          )}
        </button>
      </div>

      {/* Tutorial */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600" /> App Tutorial</p>
          <p className="text-xs text-gray-400 mt-0.5">Reset all first-time hints and walkthroughs</p>
        </div>
        <button
          onClick={() => { resetAllTutorials(); window.location.reload(); }}
          className="px-4 py-2 text-sm font-semibold text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-50 transition"
        >
          Restart Tutorial
        </button>
      </div>
    </div>
  );
}
