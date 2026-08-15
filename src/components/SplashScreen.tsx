import React, { useEffect } from 'react';

interface Props { onDone: () => void; }

export default function SplashScreen({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <img
        src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM copy.png"
        alt="Parker"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
