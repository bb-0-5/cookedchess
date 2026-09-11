import React, { useState } from 'react';
import { Agent8, GovernmentType, VoteData5, VoteData8 } from '../types';
import { squareName } from '../engine/fiveByFive';

interface ParliamentChamberProps {
  mode: '5x5' | '8x8';
  activeTurn: 'Cyan' | 'Magenta';
  // 5x5 data:
  voteData5: VoteData5 | null;
  // 8x8 data:
  voteData8: VoteData8 | null;
  agents8: Record<string, Agent8>;
  positions8: Record<string, string>;
  whiteGov: GovernmentType;
  blackGov: GovernmentType;
}

export const ParliamentChamber: React.FC<ParliamentChamberProps> = ({
  mode,
  activeTurn,
  voteData5,
  voteData8,
  agents8,
  positions8,
  whiteGov,
  blackGov
}) => {
  const [selectedSide, setSelectedSide] = useState<'Cyan' | 'Magenta'>('Cyan');

  const currentSide = selectedSide;
  const isTurn = currentSide === activeTurn;
  const currentGov = currentSide === 'Cyan' ? whiteGov : blackGov;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex flex-col h-full shadow-lg">
      {/* Header & Side Selector */}
      <div className="flex items-center justify-between border-b border-neutral-700 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏛️</span>
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Chamber of Parliament
            </h2>
            <div className="text-xs text-neutral-400 capitalize flex items-center gap-1.5">
              <span>{currentSide} Parliament</span>
              {mode === '8x8' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentGov}
                </span>
              )}
              {isTurn && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Voting Now
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Side Tabs */}
        <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-700">
          <button
            id="tab-white-parliament"
            type="button"
            onClick={() => setSelectedSide('Cyan')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              selectedSide === 'Cyan'
                ? 'bg-neutral-200 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Cyan
          </button>
          <button
            id="tab-black-parliament"
            type="button"
            onClick={() => setSelectedSide('Magenta')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              selectedSide === 'Magenta'
                ? 'bg-neutral-700 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Magenta
          </button>
        </div>
      </div>

      {/* Mode-Specific Member Rosters */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px] sm:max-h-[440px]">
        {mode === '5x5' && (
          <div>
            {!voteData5 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Press <span className="font-semibold text-neutral-300">Convene Parliament</span> to collect initial ballots.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-neutral-400 px-1 flex justify-between">
                  <span>Parliamentarian</span>
                  <span>Ballot / Enthusiasm</span>
                </div>
                {voteData5.voters.map(({ square, piece }) => {
                  const sqStr = squareName(square[0], square[1]);
                  const key = `${square[0]},${square[1]}`;
                  const ballot = voteData5.ballots[key];
                  const isWinningSupporter = ballot && ballot.notation === voteData5.winner.notation;

                  return (
                    <div
                      key={sqStr}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        isWinningSupporter
                          ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-100'
                          : 'bg-neutral-900/60 border-neutral-700/60 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200 border border-neutral-700">
                          {piece.kind}@{sqStr}
                        </span>
                        {isWinningSupporter && (
                          <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                            Enacted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-amber-300 font-semibold">{ballot?.notation || 'Abstain'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === '8x8' && (
          <div className="space-y-2">
            {Object.entries(positions8)
              .map(([sq, agentId]) => ({ sq, agent: agents8[agentId] }))
              .filter(({ agent }) => agent && agent.color === (currentSide === 'Cyan' ? 'w' : 'b'))
              .sort((a, b) => {
                const ranks = { k: 6, q: 5, r: 4, b: 3, n: 2, p: 1 };
                return (ranks[b.agent.currentPiece] || 0) - (ranks[a.agent.currentPiece] || 0);
              })
              .map(({ sq, agent }) => {
                const votedUci = voteData8?.ballots[agent.agentId];
                const isSupporter = voteData8 && votedUci === voteData8.selectedMoveUci;

                return (
                  <div
                    key={agent.agentId}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition-colors ${
                      isSupporter
                        ? 'bg-emerald-950/25 border-emerald-600/50 text-emerald-100'
                        : 'bg-neutral-900/70 border-neutral-700/50 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-neutral-100">
                          {agent.agentId}
                        </span>
                        <span className="text-neutral-400 uppercase font-mono text-[11px]">
                          @{sq}
                        </span>
                        {isSupporter && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Majority Coalition
                          </span>
                        )}
                      </div>

                      {votedUci && (
                        <div className="font-mono font-bold text-amber-300">
                          Voted: {votedUci}
                        </div>
                      )}
                    </div>

                    {/* Agent Personality Traits & Reputation Trust Score */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/80">
                      <div>
                        Surv: <span className="text-neutral-200 font-mono">{agent.survival}</span>
                      </div>
                      <div>
                        Mat: <span className="text-neutral-200 font-mono">{agent.material}</span>
                      </div>
                      <div>
                        Act: <span className="text-neutral-200 font-mono">{agent.activity}</span>
                      </div>
                      <div>
                        Trust: <span className="text-amber-400 font-mono font-semibold">{agent.trust}</span>
                        {currentGov === 'reputation' && (
                          <span className="text-neutral-400 text-[9px] ml-0.5">({agent.voteWeight}w)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Plurality / Utility Tally Card */}
      {mode === '5x5' && voteData5 && (
        <div className="mt-3 pt-3 border-t border-neutral-700">
          <div className="text-[11px] font-medium text-neutral-400 mb-1.5 flex justify-between items-center">
            <span>Leading Proposals</span>
            <span className="text-[10px] text-neutral-500">Votes / Enthusiasm</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {Object.entries(voteData5.totals)
              .filter(([_, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([notation, count]) => (
                <div
                  key={notation}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded font-mono ${
                    notation === voteData5.winner.notation
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold'
                      : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  <span>{notation}</span>
                  <span>
                    {count} vote{count !== 1 ? 's' : ''} ({voteData5.totalEnthusiasm[notation]} pts)
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {mode === '8x8' && voteData8 && (
        <div className="mt-3 pt-3 border-t border-neutral-700">
          <div className="text-[11px] font-medium text-neutral-400 mb-1.5 flex justify-between items-center">
            <span>Constitutional Resolution</span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Mode: {voteData8.government}
            </span>
          </div>
          <div className="text-xs font-mono bg-neutral-900 p-2 rounded border border-neutral-700/70 text-neutral-200 flex justify-between items-center">
            <span className="text-amber-300 font-bold">
              {voteData8.selectedMoveSan} ({voteData8.selectedMoveUci})
            </span>
            <span className="text-neutral-400">
              {voteData8.supportCounts[voteData8.selectedMoveUci] || 0} direct votes
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
