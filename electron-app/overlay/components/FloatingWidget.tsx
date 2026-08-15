import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Send, Play, Plus, LayoutGrid, Medal, Zap, Star } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'success';
}

interface SessionInfo {
  goal: string;
  started_at: string;
  end_minutes: number;
}

interface Props {
  session: SessionInfo | null;
  remainingSeconds: number;
  messages: Message[];
  parkedCount: number;
  isPanelOpen: boolean;
  isMinimised: boolean;
  sessionTimeUp?: boolean;
  onTogglePanel: () => void;
  onMinimise: () => void;
  onExpand: () => void;
  onParkThought: (content: string) => Promise<boolean>;
  onStartSession?: (goal: string, minutes: number) => Promise<void>;
  onExtendSession?: (minutes: number) => Promise<void>;
  onFinishSession?: (achieved: boolean | null) => Promise<void>;
  defaultExtendMinutes?: number;
  currentCorner?: Corner;
  onMoveToCorner?: (corner: Corner) => void;
  earnedBadges?: string[];
  onDismissBadges?: () => void;
}

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const BASE_DURATIONS = [15, 25, 45, 60];

const BADGE_META: Record<string, { icon: React.ElementType; gradient: string; desc: string }> = {
  'Rock Focus':     { icon: Medal, gradient: 'from-yellow-400 to-amber-500', desc: 'Zero deviations!' },
  'Quick Comeback': { icon: Zap,   gradient: 'from-blue-400 to-cyan-500',   desc: '90%+ return rate!' },
  'Super Session':  { icon: Star,  gradient: 'from-green-400 to-teal-500',  desc: 'Goal achieved!' },
};

function CornerPicker({ currentCorner, onMove, onClose }: {
  currentCorner?: Corner;
  onMove: (c: Corner) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)', width: 120 }}>
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Move to</span>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 transition">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <div className="px-2 pb-2 grid grid-cols-2 gap-1">
        {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as Corner[]).map((c) => (
          <button key={c} onClick={() => onMove(c)} title={c.replace('-', ' ')}
            className={`p-1.5 rounded-lg border text-[9px] font-semibold transition ${
              currentCorner === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-400 hover:text-teal-700'
            }`}>
            {c === 'top-left' ? '↖ TL' : c === 'top-right' ? '↗ TR' : c === 'bottom-left' ? '↙ BL' : '↘ BR'}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExtendPanel({ defaultMinutes, extending, onExtend, onClose }: {
  defaultMinutes: number;
  extending: boolean;
  onExtend: (m: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState('');
  const presets = Array.from(new Set([defaultMinutes, 5, 10, 15, 25])).slice(0, 4);
  return (
    <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Plus className="w-3 h-3 text-teal-600" />
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Extend session</span>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 transition"><ChevronDown className="w-3 h-3" /></button>
      </div>
      <div className="px-3 pb-3 space-y-2">
        <div className="flex gap-1.5">
          {presets.map((m) => (
            <button key={m} onClick={() => { setCustom(''); onExtend(m); }} disabled={extending}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50 ${
                m === defaultMinutes ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
              }`}>
              +{m}m
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input type="number" min={1} placeholder="Custom mins" value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent" />
          <button
            onClick={() => { const m = parseInt(custom); if (!isNaN(m) && m > 0) { onExtend(m); setCustom(''); } }}
            disabled={extending || !custom || isNaN(parseInt(custom)) || parseInt(custom) < 1}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgeCelebration({ badges, onDismiss }: { badges: string[]; onDismiss: () => void }) {
  return (
    <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ animation: 'badgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-4 pt-3 pb-2">
        <p className="text-white text-xs font-bold uppercase tracking-wider">Badge{badges.length > 1 ? 's' : ''} Earned!</p>
        <p className="text-yellow-100 text-[10px] mt-0.5">You're on fire — keep it up!</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {badges.map((badge) => {
          const meta = BADGE_META[badge] ?? { icon: Star, gradient: 'from-gray-400 to-gray-500', desc: '' };
          const Icon = meta.icon;
          return (
            <div key={badge} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{badge}</p>
                <p className="text-[10px] text-gray-500">{meta.desc}</p>
              </div>
            </div>
          );
        })}
        <button onClick={onDismiss}
          className="w-full mt-1 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-white hover:opacity-90 transition">
          Awesome!
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function QuickStartWidget({ onStartSession, defaultMinutes = 25, onMoveToCorner, currentCorner, onParkThought, earnedBadges, onDismissBadges }: {
  onStartSession: (goal: string, minutes: number) => Promise<void>;
  defaultMinutes?: number;
  onMoveToCorner?: (corner: Corner) => void;
  currentCorner?: Corner;
  onParkThought?: (content: string) => Promise<boolean>;
  earnedBadges?: string[];
  onDismissBadges?: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [customMinutes, setCustomMinutes] = useState('');
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [parkText, setParkText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parkedFlash, setParkedFlash] = useState(false);

  const handleStart = async () => {
    if (!goal.trim() || starting) return;
    const finalMinutes = customMinutes ? parseInt(customMinutes) : minutes;
    if (isNaN(finalMinutes) || finalMinutes < 1) return;
    setStarting(true);
    await onStartSession(goal.trim(), finalMinutes);
    setStarting(false);
  };

  const handleParkSubmit = async () => {
    const content = parkText.trim();
    if (!content || submitting || !onParkThought) return;
    setSubmitting(true);
    const ok = await onParkThought(content);
    if (ok) { setParkText(''); setParkOpen(false); setParkedFlash(true); setTimeout(() => setParkedFlash(false), 2000); }
    setSubmitting(false);
  };

  const handleParkKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleParkSubmit(); }
  };

  if (!expanded) {
    return (
      <div className="flex flex-col items-end justify-end w-full h-full pr-3 pb-3 gap-2">
        {earnedBadges && earnedBadges.length > 0 && onDismissBadges && (
          <BadgeCelebration badges={earnedBadges} onDismiss={onDismissBadges} />
        )}
        {cornerOpen && onMoveToCorner && (
          <CornerPicker currentCorner={currentCorner} onMove={(c) => { onMoveToCorner(c); setCornerOpen(false); }} onClose={() => setCornerOpen(false)} />
        )}
        {parkOpen && onParkThought && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
              <Lightbulb className="w-3 h-3 text-teal-600" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Park a thought</span>
              <span className="ml-auto text-[10px] text-gray-400">Enter to save</span>
            </div>
            <div className="px-3 pb-3">
              <textarea autoFocus value={parkText} onChange={(e) => setParkText(e.target.value)} onKeyDown={handleParkKeyDown}
                placeholder="What's on your mind? Park it for later…" rows={3}
                className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-gray-50 focus:bg-white transition" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setParkOpen(false); setParkText(''); }}
                  className="flex-1 border border-gray-200 text-gray-500 text-xs font-medium py-1.5 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleParkSubmit} disabled={!parkText.trim() || submitting}
                  className="flex-1 bg-gradient-to-r from-teal-700 to-teal-500 text-white text-xs font-semibold py-1.5 rounded-xl hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-1">
                  <Send className="w-3 h-3" />{submitting ? 'Saving…' : 'Park it'}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-0 rounded-full shadow-lg overflow-hidden bg-gradient-to-r from-teal-700 to-teal-500"
          style={{ boxShadow: '0 4px 20px rgba(15,118,110,0.35)' }}>
          {onMoveToCorner && (
            <button onClick={() => { setCornerOpen((v) => !v); setParkOpen(false); }}
              className="px-2.5 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition border-r border-white/20" title="Move widget position">
              <LayoutGrid className="w-3 h-3" />
            </button>
          )}
          {onParkThought && (
            <button onClick={() => { setParkOpen((v) => !v); setCornerOpen(false); }}
              className="px-2.5 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition relative border-r border-white/20" title="Park a thought">
              <Lightbulb className="w-3 h-3" />
              {parkedFlash && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-teal-700 text-[8px] font-bold rounded-full flex items-center justify-center">✓</span>
              )}
            </button>
          )}
          <button onClick={() => { setExpanded(true); setParkOpen(false); setCornerOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold hover:bg-white/10 transition">
            <Play className="w-3 h-3" />Start Session
          </button>
        </div>
        <style>{`
          @keyframes panelIn { from { transform: scale(0.9) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
          @keyframes badgeIn { 0% { transform: scale(0.7) translateY(16px); opacity: 0; } 60% { transform: scale(1.05) translateY(-4px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-end w-full h-full pr-3 pb-3">
      <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-gradient-to-r from-teal-700 to-teal-500">
          <Play className="w-3.5 h-3.5 text-white" />
          <span className="text-white text-xs font-bold uppercase tracking-wider">Quick Start</span>
          <button onClick={() => setExpanded(false)} className="ml-auto text-white/70 hover:text-white transition">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <input autoFocus type="text" value={goal} onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            placeholder="What's your focus goal?"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent" />
          <div className="flex gap-1.5">
            {Array.from(new Set([defaultMinutes, ...BASE_DURATIONS])).slice(0, 3).map((d) => (
              <button key={d} type="button" onClick={() => { setMinutes(d); setCustomMinutes(''); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  minutes === d && !customMinutes ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
                }`}>{d}m</button>
            ))}
            <input type="number" min={1} placeholder="?" value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className={`w-12 border rounded-lg px-1.5 py-1.5 text-xs text-gray-800 text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition ${customMinutes ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}`} />
          </div>
          <button onClick={handleStart} disabled={!goal.trim() || starting}
            className="w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white text-xs font-semibold py-2 rounded-xl hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-1.5">
            {starting ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Play className="w-3 h-3" />Start Focus Session</>}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes panelIn { from { transform: scale(0.9) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

export default function FloatingWidget({
  session, remainingSeconds, messages, parkedCount,
  isPanelOpen, isMinimised, sessionTimeUp, onTogglePanel, onMinimise, onExpand, onParkThought,
  onStartSession, onExtendSession, onFinishSession, defaultExtendMinutes, currentCorner, onMoveToCorner,
  earnedBadges, onDismissBadges,
}: Props) {
  const [parkText, setParkText] = useState('');
  const [parkOpen, setParkOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parkedFlash, setParkedFlash] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  if (!session) {
    return (
      <QuickStartWidget
        onStartSession={onStartSession ?? (async () => {})}
        defaultMinutes={defaultExtendMinutes}
        onMoveToCorner={onMoveToCorner}
        currentCorner={currentCorner}
        onParkThought={onParkThought}
        earnedBadges={earnedBadges}
        onDismissBadges={onDismissBadges}
      />
    );
  }

  const isWarning = remainingSeconds < 60 && remainingSeconds > 0;

  const handleParkSubmit = async () => {
    const content = parkText.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    const ok = await onParkThought(content);
    if (ok) { setParkText(''); setParkOpen(false); setParkedFlash(true); setTimeout(() => setParkedFlash(false), 2000); }
    setSubmitting(false);
  };

  const handleParkKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleParkSubmit(); }
  };

  const handleExtend = async (minutes: number) => {
    if (extending || !onExtendSession) return;
    setExtending(true);
    await onExtendSession(minutes);
    setExtending(false);
    setExtendOpen(false);
  };

  const gradientClass = isWarning ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-teal-700 to-teal-500';
  const shadowStyle = isWarning ? '0 4px 20px rgba(249,115,22,0.4)' : '0 4px 20px rgba(15,118,110,0.35)';

  if (isMinimised) {
    return (
      <div className="flex items-end justify-end w-full h-full pr-3 pb-3">
        <button onClick={onExpand}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg text-white text-xs font-semibold transition-all hover:scale-105 ${gradientClass}`}
          style={{ boxShadow: shadowStyle }}>
          <span className="tabular-nums">{formatTime(remainingSeconds)}</span>
          <ChevronUp className="w-3 h-3 opacity-70" />
          {parkedCount > 0 && (
            <span className="bg-white/30 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{parkedCount}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-end w-full h-full pr-3 pb-3">
      <div className="flex flex-col items-end gap-2" style={{ maxWidth: 300 }}>

        {earnedBadges && earnedBadges.length > 0 && onDismissBadges && (
          <BadgeCelebration badges={earnedBadges} onDismiss={onDismissBadges} />
        )}

        {cornerOpen && onMoveToCorner && (
          <CornerPicker currentCorner={currentCorner} onMove={(c) => { onMoveToCorner(c); setCornerOpen(false); }} onClose={() => setCornerOpen(false)} />
        )}

        {sessionTimeUp && onFinishSession && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="bg-gradient-to-r from-teal-700 to-teal-500 px-4 pt-3 pb-2">
              <p className="text-white text-xs font-bold uppercase tracking-wider">Session Complete!</p>
              <p className="text-teal-100 text-[10px] mt-0.5 truncate">{session.goal}</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-gray-600 text-center">Did you achieve your goal?</p>
              <div className="flex gap-2">
                <button onClick={async () => { setFinishing(true); await onFinishSession(true); }} disabled={finishing}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-50">Yes!</button>
                <button onClick={async () => { setFinishing(true); await onFinishSession(false); }} disabled={finishing}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50">Not quite</button>
              </div>
              <button onClick={async () => { setFinishing(true); await onFinishSession(null); }} disabled={finishing}
                className="w-full py-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition disabled:opacity-50">Skip</button>
            </div>
          </div>
        )}

        {extendOpen && onExtendSession && !sessionTimeUp && (
          <ExtendPanel defaultMinutes={defaultExtendMinutes ?? 25} extending={extending} onExtend={handleExtend} onClose={() => setExtendOpen(false)} />
        )}

        {parkOpen && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
              <Lightbulb className="w-3 h-3 text-teal-600" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Park a thought</span>
              <span className="ml-auto text-[10px] text-gray-400">Enter to save</span>
            </div>
            <div className="px-3 pb-3">
              <textarea autoFocus value={parkText} onChange={(e) => setParkText(e.target.value)} onKeyDown={handleParkKeyDown}
                placeholder="What's on your mind? Park it and stay focused…" rows={3}
                className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-gray-50 focus:bg-white transition" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setParkOpen(false); setParkText(''); }}
                  className="flex-1 border border-gray-200 text-gray-500 text-xs font-medium py-1.5 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleParkSubmit} disabled={!parkText.trim() || submitting}
                  className="flex-1 bg-gradient-to-r from-teal-700 to-teal-500 text-white text-xs font-semibold py-1.5 rounded-xl hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-1">
                  <Send className="w-3 h-3" />{submitting ? 'Saving…' : 'Park it'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isPanelOpen && !parkOpen && messages.length > 0 && (
          <div className="w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            style={{ animation: 'panelIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className="overflow-y-auto max-h-36 px-3 py-2 space-y-1">
              {messages.slice(0, 10).map((m) => (
                <p key={m.id} className={`text-xs py-1 leading-tight border-b border-gray-50 last:border-0 ${
                  m.type === 'warn' ? 'text-amber-700' : m.type === 'success' ? 'text-teal-700' : 'text-gray-600'
                }`}>{m.text}</p>
              ))}
            </div>
          </div>
        )}

        <div className={`flex items-center rounded-2xl shadow-lg border border-white/20 overflow-hidden ${gradientClass}`}
          style={{ boxShadow: shadowStyle }}>
          <div className="px-3 py-2 border-r border-white/20">
            <span className="text-white text-sm font-bold tabular-nums">{formatTime(remainingSeconds)}</span>
          </div>
          <div className="px-3 py-2 flex-1 cursor-pointer select-none" onClick={onTogglePanel} title={session.goal}>
            <p className="text-white text-xs font-medium truncate max-w-[120px]">{session.goal}</p>
          </div>
          {onExtendSession && (
            <button onClick={() => { setExtendOpen((v) => !v); setParkOpen(false); }}
              className="px-2.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition border-r border-white/20" title="Extend session">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { setParkOpen((v) => !v); setExtendOpen(false); }}
            className="px-2.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition relative border-r border-white/20" title="Park a thought">
            <Lightbulb className="w-4 h-4" />
            {(parkedCount > 0 || parkedFlash) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-teal-700 text-[9px] font-bold rounded-full flex items-center justify-center">
                {parkedFlash ? '✓' : parkedCount > 9 ? '9+' : parkedCount}
              </span>
            )}
          </button>
          {onMoveToCorner && (
            <button onClick={() => { setCornerOpen((v) => !v); setParkOpen(false); setExtendOpen(false); }}
              className="px-2.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition border-l border-white/20" title="Move widget position">
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onMinimise} className="px-2.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition" title="Minimise">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes panelIn { from { transform: scale(0.9) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes badgeIn { 0% { transform: scale(0.7) translateY(16px); opacity: 0; } 60% { transform: scale(1.05) translateY(-4px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
