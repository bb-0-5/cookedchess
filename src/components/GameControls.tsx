import React from 'react';
import { GovernmentType } from '../types';

interface GameControlsProps {
  mode: '5x5' | '8x8';
  onModeChange: (mode: '5x5' | '8x8') => void;
  onConveneParliament: () => void;
  onResetGame: () => void;
  isAutoPlaying: boolean;
  onToggleAutoPlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  isGameOver: boolean;
  whiteGov: GovernmentType;
  blackGov: GovernmentType;
  onCyanGovChange: (gov: GovernmentType) => void;
  onMagentaGovChange: (gov: GovernmentType) => void;
  activeTurn: 'Cyan' | 'Magenta';
}

const GOVERNMENTS: { id: GovernmentType; label: string; desc: string }[] = [
  { id: 'democracy', label: 'Democracy', desc: '1 piece = 1 vote. Plurality wins.' },
  { id: 'monarchy', label: 'Monarchy', desc: 'The King gets +4 extra votes.' },
  { id: 'dictatorship', label: 'Dictatorship', desc: 'The King decides unilaterally.' },
  { id: 'utilitarian', label: 'Utilitarian', desc: 'Maximizes total collective piece utility.' },
  { id: 'reputation', label: 'Reputation', desc: 'Votes weighted (0.5–1.5x) by forecast accuracy.' }
];

export const GameControls: React.FC<GameControlsProps> = ({
  mode,
  onModeChange,
  onConveneParliament,
  onResetGame,
  isAutoPlaying,
  onToggleAutoPlay,
  speed,
  onSpeedChange,
  isGameOver,
  whiteGov,
  blackGov,
  onCyanGovChange,
  onMagentaGovChange,
  activeTurn
}) => {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 shadow-lg space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-neutral-700 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Simulation Regime:
        </span>
        <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-700 w-full sm:w-auto">
          <button
            id="mode-5x5-btn"
            type="button"
            onClick={() => onModeChange('5x5')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded transition-all ${
              mode === '5x5'
                ? 'bg-amber-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            5×5 Parliament Prototype
          </button>
          <button
            id="mode-8x8-btn"
            type="button"
            onClick={() => onModeChange('8x8')}
            className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded transition-all ${
              mode === '8x8'
                ? 'bg-amber-600 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            8×8 Governance Tournament
          </button>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          id="btn-convene-parliament"
          type="button"
          onClick={onConveneParliament}
          disabled={isGameOver || isAutoPlaying}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-950 font-bold text-sm rounded-lg shadow transition-transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>⚖️</span>
          <span>Convene {activeTurn} Parliament</span>
        </button>

        <button
          id="btn-toggle-autoplay"
          type="button"
          onClick={onToggleAutoPlay}
          disabled={isGameOver}
          className={`px-4 py-2.5 font-semibold text-sm rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            isAutoPlaying
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          <span>{isAutoPlaying ? '⏸️' : '▶️'}</span>
          <span>{isAutoPlaying ? 'Pause Simulation' : 'Auto-Play Match'}</span>
        </button>

        <button
          id="btn-reset-game"
          type="button"
          onClick={onResetGame}
          className="px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 font-medium text-sm rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🔄</span>
          <span>New Session</span>
        </button>
      </div>

      {/* Speed Controls */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
        <span>Simulation Speed:</span>
        <div className="flex items-center gap-1 bg-neutral-900 rounded p-0.5 border border-neutral-700">
          {[
            { label: '0.5x', val: 1200 },
            { label: '1x', val: 700 },
            { label: '2x', val: 350 },
            { label: 'Blitz', val: 150 }
          ].map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSpeedChange(s.val)}
              className={`px-2 py-0.5 text-xs rounded transition-all ${
                speed === s.val
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Constitutions (in 8x8 mode) */}
      {mode === '8x8' && (
        <div className="pt-3 border-t border-neutral-700 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Constitutional Governance Setup:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cyan Government */}
            <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/60">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Cyan Constitution:
              </label>
              <select
                id="select-white-gov"
                value={whiteGov}
                onChange={e => onCyanGovChange(e.target.value as GovernmentType)}
                className="w-full bg-neutral-800 text-amber-300 border border-neutral-600 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {GOVERNMENTS.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1">
                {GOVERNMENTS.find(g => g.id === whiteGov)?.desc}
              </p>
            </div>

            {/* Magenta Government */}
            <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/60">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Magenta Constitution:
              </label>
              <select
                id="select-black-gov"
                value={blackGov}
                onChange={e => onMagentaGovChange(e.target.value as GovernmentType)}
                className="w-full bg-neutral-800 text-amber-300 border border-neutral-600 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {GOVERNMENTS.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1">
                {GOVERNMENTS.find(g => g.id === blackGov)?.desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
