import React from 'react';
import { HansardLogItem } from '../types';

interface BreakingNewsProps {
  bulletin: string;
  history: HansardLogItem[];
  isGameOver: boolean;
  gameResult: string;
}

export const BreakingNews: React.FC<BreakingNewsProps> = ({
  bulletin,
  history,
  isGameOver,
  gameResult
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Breaking News Dispatch Banner */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 shadow-md">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
            Parliamentary News Service
          </h3>
        </div>

        <p className="text-sm font-medium text-neutral-100 font-sans leading-relaxed">
          {bulletin || 'Awaiting commencement of the legislative session...'}
        </p>

        {isGameOver && (
          <div className="mt-2.5 p-2 bg-red-950/40 border border-red-700/60 rounded-lg text-xs font-semibold text-red-200">
            📢 {gameResult}
          </div>
        )}
      </div>

      {/* Hansard Record (Legislative Move History) */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 shadow-md flex flex-col">
        <div className="flex items-center justify-between border-b border-neutral-700 pb-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Hansard Record (Debates & Passed Motions)
          </h3>
          <span className="text-[11px] text-neutral-400">
            {history.length} record{history.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-y-auto max-h-48 space-y-1.5 pr-1">
          {history.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-xs italic">
              No bills passed into law yet.
            </div>
          ) : (
            history.slice().reverse().map((item) => (
              <div
                key={item.id}
                className="bg-neutral-900/80 p-2 rounded-lg border border-neutral-700/50 text-xs flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-neutral-400">
                    Turn {item.turnNumber} • <strong className="text-neutral-200">{item.side}</strong>
                    {item.government && ` (${item.government})`}
                  </span>
                  <span className="font-bold text-amber-300 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40">
                    {item.moveNotation}
                  </span>
                </div>
                <div className="text-neutral-300 text-[11px]">
                  Passed by {item.winningVotes} of {item.votersCount} votes
                </div>
                {item.supporters.length > 0 && (
                  <div className="text-[10px] text-neutral-400 truncate">
                    Coalition: {item.supporters.slice(0, 5).join(', ')}
                    {item.supporters.length > 5 && ` (+${item.supporters.length - 5})`}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
