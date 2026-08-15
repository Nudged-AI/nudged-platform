import React, { useState } from 'react';
import { Plus, X, Search, Monitor, Globe } from 'lucide-react';
import type { AllowedApp } from '../lib/ipc';

// Desktop apps — appName matches what macOS reports, bundleId is the real bundle ID
const DESKTOP_APPS: AllowedApp[] = [
  { appName: 'Slack',            bundleId: 'com.tinyspeck.slackmacgui' },
  { appName: 'Microsoft Teams',  bundleId: 'com.microsoft.teams2' },
  { appName: 'Zoom',             bundleId: 'us.zoom.xos' },
  { appName: 'VS Code',          bundleId: 'com.microsoft.VSCode' },
  { appName: 'Cursor',           bundleId: 'com.todesktop.230313mzl4w4u92' },
  { appName: 'Figma',            bundleId: 'com.figma.desktop' },
  { appName: 'Notion',           bundleId: 'notion.id' },
  { appName: 'Linear',           bundleId: 'com.linear.linear' },
  { appName: 'Obsidian',         bundleId: 'md.obsidian' },
  { appName: 'ChatGPT',          bundleId: 'com.openai.chat' },
  { appName: 'WhatsApp',         bundleId: 'net.whatsapp.WhatsApp' },
  { appName: 'Return On',        bundleId: 'com.returnon.desktop' },
  { appName: 'Telegram',         bundleId: 'ru.keepcoder.Telegram' },
  { appName: 'Discord',          bundleId: 'com.hnc.Discord' },
  { appName: 'Loom',             bundleId: 'com.loom.desktop' },
  { appName: 'Outlook',          bundleId: 'com.microsoft.Outlook' },
  { appName: 'Terminal',         bundleId: 'com.apple.Terminal' },
  { appName: 'iTerm2',           bundleId: 'com.googlecode.iterm2' },
  { appName: 'Warp',             bundleId: 'dev.warp.Warp-Stable' },
  { appName: 'WebStorm',         bundleId: 'com.jetbrains.webstorm' },
  { appName: 'IntelliJ IDEA',    bundleId: 'com.jetbrains.intellij' },
  { appName: 'Xcode',            bundleId: 'com.apple.dt.Xcode' },
];

// Browser-based sites — tracked by active tab URL in Chrome
const WEB_APPS: AllowedApp[] = [
  { appName: 'ChatGPT (web)',     bundleId: 'com.google.Chrome', url: 'chatgpt.com' },
  { appName: 'NotebookLM',        bundleId: 'com.google.Chrome', url: 'notebooklm.google.com' },
  { appName: 'Google Docs',       bundleId: 'com.google.Chrome', url: 'docs.google.com' },
  { appName: 'Google Sheets',     bundleId: 'com.google.Chrome', url: 'sheets.google.com' },
  { appName: 'Gmail',             bundleId: 'com.google.Chrome', url: 'mail.google.com' },
  { appName: 'Google Meet',       bundleId: 'com.google.Chrome', url: 'meet.google.com' },
  { appName: 'Canva',             bundleId: 'com.google.Chrome', url: 'canva.com' },
  { appName: 'Figma (web)',       bundleId: 'com.google.Chrome', url: 'figma.com' },
  { appName: 'Notion (web)',      bundleId: 'com.google.Chrome', url: 'notion.so' },
  { appName: 'Linear (web)',      bundleId: 'com.google.Chrome', url: 'linear.app' },
  { appName: 'GitHub',            bundleId: 'com.google.Chrome', url: 'github.com' },
  { appName: 'Jira',              bundleId: 'com.google.Chrome', url: 'atlassian.net' },
  { appName: 'Miro',              bundleId: 'com.google.Chrome', url: 'miro.com' },
  { appName: 'Vercel',            bundleId: 'com.google.Chrome', url: 'vercel.com' },
  { appName: 'Supabase',          bundleId: 'com.google.Chrome', url: 'supabase.com' },
];

const ALL_APPS = [...DESKTOP_APPS, ...WEB_APPS];

interface Props {
  selected: AllowedApp[];
  onChange: (apps: AllowedApp[]) => void;
}

export default function AppPicker({ selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [tab, setTab] = useState<'desktop' | 'web'>('desktop');

  const isSelected = (app: AllowedApp) => selected.some((s) => s.appName === app.appName);
  const remove = (appName: string) => onChange(selected.filter((a) => a.appName !== appName));

  const add = (app: AllowedApp) => {
    if (!isSelected(app)) onChange([...selected, app]);
    setQuery('');
    setShowDropdown(false);
  };

  const addCustom = () => {
    const raw = query.trim();
    if (!raw) return;
    const isDomain = /^(https?:\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})(\/\S*)?$/.test(raw);
    const domain = isDomain
      ? raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
      : '';
    const entry: AllowedApp = isDomain
      ? { appName: domain, bundleId: 'com.google.Chrome', url: domain }
      : { appName: raw };
    if (!isSelected(entry)) onChange([...selected, entry]);
    setQuery('');
    setShowDropdown(false);
  };

  const filteredSearch = ALL_APPS.filter(
    (a) => a.appName.toLowerCase().includes(query.toLowerCase()) && !isSelected(a)
  );

  const quickDesktop = DESKTOP_APPS.slice(0, 8);
  const quickWeb = WEB_APPS.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setTab('desktop')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition ${
            tab === 'desktop' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Monitor className="w-3 h-3" /> Desktop Apps
        </button>
        <button
          type="button"
          onClick={() => setTab('web')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition ${
            tab === 'web' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-3 h-3" /> Websites (Chrome)
        </button>
      </div>

      {/* Quick-add pills for current tab */}
      <div className="flex flex-wrap gap-2">
        {(tab === 'desktop' ? quickDesktop : quickWeb).map((app) => {
          const sel = isSelected(app);
          return (
            <button
              key={app.appName}
              type="button"
              onClick={() => sel ? remove(app.appName) : add(app)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                sel
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'
              }`}
            >
              {sel ? '✓ ' : '+ '}{app.appName}
            </button>
          );
        })}
      </div>

      {/* Search + add */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-transparent transition bg-white">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={tab === 'web' ? 'Search or type a domain like notion.so…' : 'Search desktop apps…'}
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setShowDropdown(false); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showDropdown && (filteredSearch.length > 0 || query.trim()) && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {filteredSearch.slice(0, 8).map((app) => (
              <button
                key={app.appName}
                type="button"
                onMouseDown={() => add(app)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2"
              >
                {app.url ? <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <Monitor className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                {app.appName}
                {app.url && <span className="text-xs text-gray-400 ml-auto">{app.url}</span>}
              </button>
            ))}
            {query.trim() && !ALL_APPS.find((a) => a.appName.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={addCustom}
                className="w-full text-left px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 transition-colors flex items-center gap-2 border-t border-gray-100"
              >
                <Plus className="w-4 h-4" />
                Add &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected apps */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((app) => (
            <span
              key={app.appName}
              className="flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-xs px-2.5 py-1.5 rounded-lg font-medium"
            >
              {app.url ? <Globe className="w-3 h-3 opacity-60" /> : <Monitor className="w-3 h-3 opacity-60" />}
              {app.appName}
              <button type="button" onClick={() => remove(app.appName)} className="text-teal-500 hover:text-teal-700 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
