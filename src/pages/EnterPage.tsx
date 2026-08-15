import React from 'react';
import { Target } from 'lucide-react';

interface Props {
  onEnter: () => void;
  loading: boolean;
  error: string;
}

export default function EnterPage({ onEnter, loading, error }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-teal-700 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-200">
          <Target className="w-10 h-10 text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Return On</h1>
        <p className="text-gray-500 text-lg mb-10">Declare your focus. Stay on track.</p>

        <button
          onClick={onEnter}
          disabled={loading}
          className="bg-gradient-to-r from-teal-700 to-teal-500 text-white rounded-2xl px-12 py-4 text-base font-semibold hover:from-teal-800 hover:to-teal-600 active:scale-95 transition-all duration-150 shadow-lg shadow-teal-200 disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            'Enter App'
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl inline-block">{error}</p>
        )}
      </div>
    </div>
  );
}
