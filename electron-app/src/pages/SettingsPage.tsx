import React, { useEffect, useState } from 'react';
import { Settings, Bell, Shield, Info, Save, Bug, CheckCircle, XCircle, Loader, Clock } from 'lucide-react';
import { ipc } from '../lib/ipc';
import AppPicker from '../components/AppPicker';
import type { AllowedApp } from '../lib/ipc';

interface DebugStep {
  label: string;
  ok: boolean;
  detail: string;
}

const IDLE_EXEMPT_DEFAULTS: AllowedApp[] = [
  { appName: 'Slack', bundleId: 'com.tinyspeck.slackmacgui' },
  { appName: 'Microsoft Teams', bundleId: 'com.microsoft.teams2' },
  { appName: 'Zoom', bundleId: 'us.zoom.xos' },
  { appName: 'FaceTime', bundleId: 'com.apple.FaceTime' },
];

export default function SettingsPage() {
  const [idleExemptApps, setIdleExemptApps] = useState<AllowedApp[]>(IDLE_EXEMPT_DEFAULTS);
  const [defaultTolerance, setDefaultTolerance] = useState('20');
  const [defaultSessionDuration, setDefaultSessionDuration] = useState('25');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugRunning, setDebugRunning] = useState(false);
  const [debugSteps, setDebugSteps] = useState<DebugStep[] | null>(null);

  useEffect(() => {
    ipc.settingsGet().then((s) => {
      if (s.idleExemptApps) {
        try { setIdleExemptApps(JSON.parse(s.idleExemptApps)); } catch { /* keep defaults */ }
      }
      if (s.defaultTolerance) setDefaultTolerance(s.defaultTolerance);
      if ((s as Record<string, string>).defaultSessionDuration) setDefaultSessionDuration((s as Record<string, string>).defaultSessionDuration);
      setLoading(false);
    });
  }, []);

  const handleRunChromeDebug = async () => {
    setDebugRunning(true);
    setDebugSteps(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (window as any).debugAPI.chromeTest() as DebugStep[];
      setDebugSteps(results);
    } catch (e) {
      setDebugSteps([{ label: 'IPC call failed', ok: false, detail: String(e) }]);
    } finally {
      setDebugRunning(false);
    }
  };

  const handleSave = async () => {
    await ipc.settingsSet({
      idle_exempt_apps: JSON.stringify(idleExemptApps),
      default_tolerance: defaultTolerance,
      default_session_duration: defaultSessionDuration,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure Return On to match your workflow.</p>
        </div>
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-500" />
        </div>
      </div>

      {/* Idle exempt apps */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Shield className="w-3.5 h-3.5 text-teal-600" />
          Idle-exempt Apps
        </label>
        <p className="text-xs text-gray-400 mb-4">
          When you are in these apps, Return On will not show idle reminders — useful for video calls.
        </p>
        <AppPicker selected={idleExemptApps} onChange={setIdleExemptApps} />
      </div>

      {/* Default session duration */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Clock className="w-3.5 h-3.5 text-teal-600" />
          Default Session Duration
        </label>
        <p className="text-xs text-gray-400 mb-3">Pre-selected duration when starting a new session.</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={480}
            value={defaultSessionDuration}
            onChange={(e) => setDefaultSessionDuration(e.target.value)}
            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
          <span className="text-sm text-gray-500">minutes</span>
        </div>
      </div>

      {/* Default tolerance */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          <Bell className="w-3.5 h-3.5 text-teal-600" />
          Default Reminder Tolerance
        </label>
        <p className="text-xs text-gray-400 mb-3">Default seconds before a deviation reminder appears in new sessions.</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={5}
            max={300}
            value={defaultTolerance}
            onChange={(e) => setDefaultTolerance(e.target.value)}
            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
          <span className="text-sm text-gray-500">seconds</span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1">How Return On tracks your focus</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Return On uses macOS Accessibility APIs to detect which app is in the foreground, and macOS Automation to read and control Chrome tabs. The first launch prompts for both permissions in System Settings. No screen recording or keylogging is involved.
          </p>
        </div>
      </div>

      {/* Chrome debug diagnostics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bug className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chrome Debug</span>
          </div>
          <button
            onClick={handleRunChromeDebug}
            disabled={debugRunning}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {debugRunning ? <Loader className="w-3 h-3 animate-spin" /> : <Bug className="w-3 h-3" />}
            {debugRunning ? 'Running…' : 'Run Chrome Test'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Diagnoses whether Return On can read and control Chrome tabs. Run this if the Return button is not switching tabs correctly.
        </p>

        {debugSteps && (
          <div className="space-y-2 mt-3">
            {debugSteps.map((step, i) => (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2.5 ${step.ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}
              >
                <div className="flex items-start gap-2">
                  {step.ok
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${step.ok ? 'text-green-700' : 'text-red-700'}`}>{step.label}</p>
                    <p className={`text-xs mt-0.5 break-all whitespace-pre-wrap ${step.ok ? 'text-green-600' : 'text-red-600'}`}>{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
            {debugSteps.every((s) => s.ok) && (
              <p className="text-xs text-green-600 font-medium text-center pt-1">All checks passed — Chrome control is working correctly.</p>
            )}
            {debugSteps.some((s) => !s.ok) && (
              <p className="text-xs text-red-600 font-medium text-center pt-1">One or more checks failed — see the red steps above for what to fix.</p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm transition-all ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-gradient-to-r from-teal-700 to-teal-500 text-white hover:opacity-90 shadow-md shadow-teal-200'
        }`}
      >
        <Save className="w-4 h-4" />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
