
import React, { useEffect, useRef } from 'react';

export const AudioVisualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    
    const bars = containerRef.current?.children;
    if (!bars) return;

    const interval = setInterval(() => {
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i] as HTMLElement;
        const height = Math.random() * 100 + 10;
        bar.style.height = `${height}%`;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="flex items-end justify-center gap-1 h-12 w-full max-w-xs mx-auto overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-[#708238] rounded-full transition-all duration-150 ease-in-out"
          style={{ height: '10%' }}
        />
      ))}
    </div>
  );
};
