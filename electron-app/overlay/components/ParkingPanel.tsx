import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';

interface Props {
  onSubmit: (content: string) => Promise<boolean>;
}

export default function ParkingPanel({ onSubmit }: Props) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parked, setParked] = useState(false);

  const handleSubmit = async () => {
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(content);
    if (ok) {
      setText('');
      setParked(true);
      setTimeout(() => setParked(false), 2000);
    }
    setSubmitting(false);
  };

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3 h-3 text-gray-400" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Park a thought</span>
      </div>

      {parked ? (
        <div className="text-center py-3 text-xs text-teal-600 font-semibold">Thought parked!</div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Jot a thought to revisit later…"
            rows={2}
            className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-gray-50 focus:bg-white transition"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="mt-1.5 w-full bg-gradient-to-r from-teal-700 to-teal-500 text-white text-xs font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Parking…' : 'Park it'}
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-1">Cmd+Enter to submit</p>
        </>
      )}
    </div>
  );
}
