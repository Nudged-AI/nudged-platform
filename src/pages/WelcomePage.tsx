import React from 'react';

interface Props {
  onGetStarted: () => void;
}

export default function WelcomePage({ onGetStarted }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-teal-100/30 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-emerald-100/40 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative z-10 text-center max-w-sm w-full">
        <div className="flex flex-col items-center gap-4 mb-8">
          <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-36 h-36 object-contain drop-shadow-xl" />
        </div>

        <p className="text-gray-600 text-lg font-medium mb-2">World's first thought mapping app</p>

        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-teal-300" />
          <div className="w-1.5 h-1.5 rounded-full bg-teal-200" />
        </div>

        <button
          onClick={onGetStarted}
          className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 active:scale-95"
        >
          Get Started
        </button>
        <button
          onClick={onGetStarted}
          className="mt-3 w-full text-teal-600 py-3 rounded-2xl font-medium text-sm hover:bg-teal-50 transition-all"
        >
          Sign in to existing account
        </button>
      </div>
    </div>
  );
}
