import React from 'react';
import { Agent8, GovernmentType, HansardLogItem } from '../types';

interface AnalyticsPanelProps {
  mode: '5x5' | '8x8';
  whiteGov: GovernmentType;
  blackGov: GovernmentType;
  history: HansardLogItem[];
  agents8: Record<string, Agent8>;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  mode,
  whiteGov,
  blackGov,
  history,
  agents8
}) => {
  // Aggregate stats from history
  const totalMoves = history.length;
  const whiteMoves = history.filter(h => h.side === 'White').length;
  const blackMoves = history.filter(h => h.side === 'Black').length;

  // Compute average consensus margin
  const avgConsensusPct = totalMoves > 0
    ? Math.round((history.reduce((acc, h) => acc + (h.winningVotes / Math.max(h.votersCount, 1)), 0) / totalMoves) * 100)
    : 0;

  const agentList = Object.values(agents8);
  const avgTrustWhite = agentList.filter(a => a.color === 'w').length > 0
    ? Math.round((agentList.filter(a => a.color === 'w').reduce((acc, a) => acc + a.trust, 0) / agentList.filter(a => a.color === 'w').length) * 100) / 100
    : 0.5;
  const avgTrustBlack = agentList.filter(a => a.color === 'b').length > 0
    ? Math.round((agentList.filter(a => a.color === 'b').reduce((acc, a) => acc + a.trust, 0) / agentList.filter(a => a.color === 'b').length) * 100) / 100
    : 0.5;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
          <span>📊</span>
          <span>Governance & Political Metrics</span>
        </h3>
        <span className="text-[11px] font-mono text-neutral-400">
          {mode === '5x5' ? 'Plurality Prototype' : `${whiteGov} vs ${blackGov}`}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/50">
          <div className="text-[10px] text-neutral-400 uppercase font-medium">Plies Enacted</div>
          <div className="text-lg font-bold font-mono text-neutral-100 mt-0.5">{totalMoves}</div>
          <div className="text-[10px] text-neutral-500">W: {whiteMoves} | B: {blackMoves}</div>
        </div>

        <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/50">
          <div className="text-[10px] text-neutral-400 uppercase font-medium">Avg Consensus</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{avgConsensusPct}%</div>
          <div className="text-[10px] text-neutral-500">Winning coalition share</div>
        </div>

        <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/50">
          <div className="text-[10px] text-neutral-400 uppercase font-medium">White Avg Trust</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{avgTrustWhite}</div>
          <div className="text-[10px] text-neutral-500">Weight: ~{(0.5 + avgTrustWhite).toFixed(2)}x</div>
        </div>

        <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-700/50">
          <div className="text-[10px] text-neutral-400 uppercase font-medium">Black Avg Trust</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{avgTrustBlack}</div>
          <div className="text-[10px] text-neutral-500">Weight: ~{(0.5 + avgTrustBlack).toFixed(2)}x</div>
        </div>
      </div>

      {/* Overview Notes */}
      <div className="text-[11px] text-neutral-400 bg-neutral-900/50 p-2 rounded border border-neutral-700/40 leading-relaxed">
        <strong>The Political Logic:</strong> Each surviving chess piece calculates legal proposal utilities based on personal agency, survival risk, expansion zeal, and target material. Under <em>Democracy</em>, votes are counted 1-per-piece; under <em>Monarchy</em>, the King holds 4 extra votes; under <em>Dictatorship</em>, the King's ballot is sovereign; under <em>Utilitarianism</em>, the move with maximal collective utility prevails; and under <em>Reputation</em>, past forecast accuracy dynamically scales political influence.
      </div>
    </div>
  );
};
