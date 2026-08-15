import React, { useState, useEffect } from 'react';

interface Props {
  onDone: () => void;
}

export default function WelcomeScreen({ onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in immediately
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: 'linear-gradient(135deg, #f0f7f4 0%, #e8f5ef 40%, #d4ede6 70%, #e8f0ec 100%)' }}
      onClick={() => { setVisible(false); setTimeout(onDone, 400); }}
    >
      {/* Soft watercolor blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #b2d8cc 0%, transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-16 w-96 h-96 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #a8d5c4 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 right-10 w-40 h-40 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #f0c5b0 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/3 left-8 w-28 h-28 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #c5e0d4 0%, transparent 70%)' }} />
        {/* Scattered dots */}
        {[
          { top: '18%', left: '22%', r: 5, c: '#c8a882' },
          { top: '25%', left: '75%', r: 4, c: '#b0c8b8' },
          { top: '65%', left: '15%', r: 6, c: '#d4b8a0' },
          { top: '72%', left: '80%', r: 4, c: '#a8c4b4' },
          { top: '40%', left: '88%', r: 3, c: '#c8b4a0' },
          { top: '55%', left: '5%', r: 5, c: '#b4d0c0' },
        ].map((d, i) => (
          <div key={i} className="absolute rounded-full" style={{ top: d.top, left: d.left, width: d.r * 2, height: d.r * 2, background: d.c, opacity: 0.6 }} />
        ))}
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-8"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Lotus icon - SVG drawn inline to match mockup feel */}
        <div className="mb-6">
          <svg width="90" height="72" viewBox="0 0 90 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Center petals */}
            <ellipse cx="45" cy="42" rx="12" ry="22" fill="#e8d5cc" stroke="#c8a890" strokeWidth="0.8" transform="rotate(-5 45 42)" opacity="0.9" />
            <ellipse cx="45" cy="42" rx="12" ry="22" fill="#d4e8e0" stroke="#90b8a8" strokeWidth="0.8" transform="rotate(5 45 42)" opacity="0.85" />
            <ellipse cx="45" cy="44" rx="10" ry="20" fill="#e8d5cc" stroke="#c8a890" strokeWidth="0.8" opacity="0.9" />
            {/* Side petals */}
            <ellipse cx="28" cy="46" rx="10" ry="18" fill="#d4e8e0" stroke="#90b8a8" strokeWidth="0.8" transform="rotate(-25 28 46)" opacity="0.8" />
            <ellipse cx="62" cy="46" rx="10" ry="18" fill="#d4e8e0" stroke="#90b8a8" strokeWidth="0.8" transform="rotate(25 62 46)" opacity="0.8" />
            {/* Outer petals */}
            <ellipse cx="14" cy="50" rx="9" ry="16" fill="#e8ede8" stroke="#a8c4b4" strokeWidth="0.7" transform="rotate(-42 14 50)" opacity="0.7" />
            <ellipse cx="76" cy="50" rx="9" ry="16" fill="#e8ede8" stroke="#a8c4b4" strokeWidth="0.7" transform="rotate(42 76 50)" opacity="0.7" />
            {/* Tiny leaf sprigs */}
            <path d="M38 10 Q35 4 30 6" stroke="#90b8a8" strokeWidth="1" fill="none" />
            <path d="M52 8 Q55 2 60 5" stroke="#90b8a8" strokeWidth="1" fill="none" />
            <path d="M44 6 Q44 1 44 1" stroke="#90b8a8" strokeWidth="1" fill="none" />
          </svg>
        </div>

        {/* Brand name */}
        <h1
          className="font-serif font-bold tracking-tight leading-none"
          style={{ fontSize: '4.5rem', color: '#1a5c4a', fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Nudged
        </h1>

        {/* Tagline */}
        <p className="mt-3 text-base font-normal tracking-widest" style={{ color: '#2a7a5a', letterSpacing: '0.12em' }}>
          World first Positive thinking App
        </p>

        {/* Divider with leaf */}
        <div className="flex items-center gap-3 mt-5 mb-5">
          <div className="h-px w-16" style={{ background: '#c8a890' }} />
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
            <path d="M10 1 Q14 7 10 13 Q6 7 10 1Z" fill="#90b8a8" opacity="0.7" />
            <path d="M10 1 L10 13" stroke="#90b8a8" strokeWidth="0.8" />
          </svg>
          <div className="h-px w-16" style={{ background: '#c8a890' }} />
        </div>

        {/* Body text */}
        <p
          className="text-lg font-medium leading-relaxed max-w-sm"
          style={{ color: '#1a5c4a' }}
        >
          We nudge you towards your goal,<br />
          gently, consistently and interestingly
        </p>
      </div>

      {/* Tap hint */}
      <p
        className="absolute bottom-6 text-xs"
        style={{ color: '#2a7a5a', opacity: 0.5 }}
      >
        tap to continue
      </p>
    </div>
  );
}
