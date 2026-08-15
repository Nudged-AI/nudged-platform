import React, { useEffect, useState } from 'react';
import { Brain, Check, X, Tag, Trash2, Filter } from 'lucide-react';
import { ipc, type ThoughtRow } from '../lib/ipc';

interface Props {
  userId: string;
}

const STATUS_OPTIONS = ['all', 'pending', 'accepted', 'rejected'] as const;

type RangeKey = '7d' | '14d' | '1m' | '3m' | '6m' | 'all';
const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '7d',  label: 'Last 7 days',   days: 7   },
  { key: '14d', label: 'Last 2 weeks',  days: 14  },
  { key: '1m',  label: 'Last 1 month',  days: 30  },
  { key: '3m',  label: 'Last 3 months', days: 90  },
  { key: '6m',  label: 'Last 6 months', days: 180 },
  { key: 'all', label: 'All time',      days: null },
];

export default function ParkedThoughtsPage({ userId }: Props) {
  const [thoughts, setThoughts] = useState<ThoughtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_OPTIONS[number]>('all');
  const [dateRange, setDateRange] = useState<RangeKey>('1m');
  const [themeInput, setThemeInput] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTheme, setBulkTheme] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadThoughts(); }, [userId]);

  const loadThoughts = async () => {
    setLoading(true);
    const data = await ipc.dbThoughtsList();
    setThoughts(data);
    setLoading(false);
  };

  const updateThought = async (id: string, updates: Partial<Pick<ThoughtRow, 'status' | 'theme'>>) => {
    setSaving(id);
    await ipc.dbThoughtsUpdate(id, updates);
    setThoughts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    setSaving(null);
  };

  const deleteThought = async (id: string) => {
    await ipc.dbThoughtsDelete(id);
    setThoughts((prev) => prev.filter((t) => t.id !== id));
  };

  const applyBulkTheme = async () => {
    if (!bulkTheme.trim() || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await ipc.dbThoughtsBulkTheme(ids, bulkTheme.trim());
    setThoughts((prev) => prev.map((t) => selectedIds.has(t.id) ? { ...t, theme: bulkTheme.trim() } : t));
    setSelectedIds(new Set());
    setBulkTheme('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const rangeStart = (() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === dateRange)!;
    if (!opt.days) return null;
    const d = new Date();
    d.setDate(d.getDate() - (opt.days - 1));
    return d.toISOString().slice(0, 10);
  })();

  const filtered = thoughts.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (rangeStart && t.created_at.slice(0, 10) < rangeStart) return false;
    return true;
  });
  const grouped = filtered.reduce<Record<string, ThoughtRow[]>>((acc, t) => {
    const key = t.theme ?? '(unthemed)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parked Thoughts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review, accept, reject, and group your captured ideas.</p>
        </div>
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Brain className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period:</span>
        {RANGE_OPTIONS.map((r) => (
          <button key={r.key} onClick={() => setDateRange(r.key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
              dateRange === r.key ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition capitalize ${
              filter === s ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-sm text-teal-700 font-medium">{selectedIds.size} selected</span>
          <input
            type="text"
            value={bulkTheme}
            onChange={(e) => setBulkTheme(e.target.value)}
            placeholder="Enter theme name..."
            className="flex-1 border border-teal-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            onClick={applyBulkTheme}
            disabled={!bulkTheme.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
          >
            <Tag className="w-3 h-3" /> Apply Theme
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Brain className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-gray-500 text-sm">No parked thoughts yet.</p>
          <p className="text-xs text-gray-400 mt-1">Use the overlay widget during a session to park thoughts.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([theme, items]) => (
          <div key={theme}>
            <div className="flex items-center gap-2 mb-2 mt-4">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{theme}</h3>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${
                    selectedIds.has(t.id) ? 'border-teal-300 bg-teal-50/30' : 'border-gray-100'
                  } ${t.status === 'accepted' ? 'border-l-4 border-l-green-400' : t.status === 'rejected' ? 'border-l-4 border-l-red-300 opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="mt-0.5 accent-teal-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-relaxed">{t.content}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {t.theme && (
                          <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full font-medium">{t.theme}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          t.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          t.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                        }`}>{t.status}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={themeInput[t.id] ?? t.theme ?? ''}
                          onChange={(e) => setThemeInput((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Assign theme..."
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 placeholder-gray-400"
                        />
                        <button
                          onClick={() => updateThought(t.id, { theme: themeInput[t.id] ?? t.theme ?? undefined })}
                          disabled={saving === t.id}
                          className="text-xs text-teal-600 font-medium hover:text-teal-700 transition whitespace-nowrap disabled:opacity-50"
                        >
                          {saving === t.id ? '...' : 'Save theme'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.status !== 'accepted' && (
                        <button onClick={() => updateThought(t.id, { status: 'accepted' })} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Accept">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {t.status !== 'rejected' && (
                        <button onClick={() => updateThought(t.id, { status: 'rejected' })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Reject">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteThought(t.id)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
