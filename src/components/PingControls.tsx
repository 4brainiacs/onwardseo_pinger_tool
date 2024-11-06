import React from 'react';
import { Pause, Play, Square } from 'lucide-react';

interface PingControlsProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled: boolean;
}

export function PingControls({
  isPaused,
  onPause,
  onResume,
  onStop,
  disabled
}: PingControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {isPaused ? (
        <button
          onClick={onResume}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
        >
          <Play className="h-5 w-5" />
          <span>Resume</span>
        </button>
      ) : (
        <button
          onClick={onPause}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
        >
          <Pause className="h-5 w-5" />
          <span>Pause</span>
        </button>
      )}
      <button
        onClick={onStop}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
      >
        <Square className="h-5 w-5" />
        <span>Stop</span>
      </button>
    </div>
  );
}