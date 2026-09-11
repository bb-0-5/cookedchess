import React from 'react';
import { Piece5, Move5 } from '../types';

interface ChessBoardProps {
  mode: '5x5' | '8x8';
  // For 5x5:
  grid5?: (Piece5 | null)[][];
  lastMove5?: Move5 | null;
  // For 8x8:
  board8?: Array<Array<{ type: string; color: string } | null>>;
  lastMove8?: { from: string; to: string } | null;
  turn: 'W' | 'B' | 'w' | 'b';
  selectedSquare: string | null;
  legalDestinations: string[];
  onSquareClick: (square: string) => void;
  supportersMap?: Record<string, boolean>; // square -> isSupporter of last winning move
}

const PIECE_SYMBOLS: Record<string, string> = {
  // White pieces
  WK: '♔', WQ: '♕', WR: '♖', WB: '♗', WN: '♘', WP: '♙',
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  // Black pieces
  BK: '♚', BQ: '♛', BR: '♜', BB: '♝', BN: '♞', BP: '♟',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

const FILES_5 = ['A', 'B', 'C', 'D', 'E'];
const FILES_8 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const ChessBoard: React.FC<ChessBoardProps> = ({
  mode,
  grid5,
  lastMove5,
  board8,
  lastMove8,
  selectedSquare,
  legalDestinations,
  onSquareClick,
  supportersMap = {}
}) => {
  if (mode === '5x5' && grid5) {
    return (
      <div className="flex flex-col items-center select-none">
        {/* Top coordinates */}
        <div className="flex w-full max-w-[420px] justify-around px-8 py-1 text-xs font-semibold text-neutral-400">
          {FILES_5.map(f => (
            <span key={f} className="w-12 text-center">{f}</span>
          ))}
        </div>

        <div className="relative border-4 border-neutral-700 bg-neutral-800 rounded-lg p-2 shadow-2xl">
          <div className="grid grid-cols-5 gap-1 w-[320px] sm:w-[380px] h-[320px] sm:h-[380px]">
            {grid5.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const sqName = `${FILES_5[cIdx]}${5 - rIdx}`;
                const isSelected = selectedSquare === sqName;
                const isLegalDest = legalDestinations.includes(sqName);
                const isLightSquare = (rIdx + cIdx) % 2 === 0;
                const isLastOrigin = lastMove5 && lastMove5.origin[0] === rIdx && lastMove5.origin[1] === cIdx;
                const isLastDest = lastMove5 && lastMove5.destination[0] === rIdx && lastMove5.destination[1] === cIdx;
                const isSupporter = !!supportersMap[sqName];

                let bgClass = isLightSquare ? 'bg-amber-100 hover:bg-amber-200' : 'bg-amber-800/80 hover:bg-amber-700/80';
                if (isLastOrigin || isLastDest) {
                  bgClass = isLightSquare ? 'bg-amber-300' : 'bg-amber-600';
                }
                if (isSelected) {
                  bgClass = 'bg-yellow-400 ring-4 ring-yellow-500 z-10';
                }

                const pieceKey = cell ? `${cell.side}${cell.kind}` : null;
                const symbol = pieceKey ? PIECE_SYMBOLS[pieceKey] : null;

                return (
                  <button
                    key={sqName}
                    id={`square-${sqName}`}
                    type="button"
                    onClick={() => onSquareClick(sqName)}
                    className={`relative flex items-center justify-center rounded transition-all cursor-pointer ${bgClass}`}
                  >
                    {/* Square coordinate watermark in corner */}
                    <span className={`absolute bottom-0.5 right-1 text-[9px] font-mono leading-none ${isLightSquare ? 'text-amber-900/40' : 'text-amber-200/40'}`}>
                      {sqName}
                    </span>

                    {/* Supporter badge indicator */}
                    {isSupporter && (
                      <span
                        title="Voted for current move"
                        className="absolute top-1 left-1 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white"
                      />
                    )}

                    {/* Legal target dot */}
                    {isLegalDest && (
                      <div className={`absolute z-10 rounded-full ${cell ? 'inset-1 border-2 border-emerald-500/80' : 'w-3 h-3 bg-emerald-600/70'}`} />
                    )}

                    {/* Piece Symbol */}
                    {cell && (
                      <span
                        className={`text-3xl sm:text-4xl leading-none drop-shadow-sm transition-transform active:scale-95 ${
                          cell.side === 'W'
                            ? 'text-cyan-400 drop-shadow-[0_1px_1px_rgba(0,255,255,0.6)] font-bold'
                            : 'text-fuchsia-500 font-bold drop-shadow-[0_1px_2px_rgba(255,0,255,0.6)]'
                        }`}
                      >
                        {symbol}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // 8x8 Board
  if (mode === '8x8' && board8) {
    return (
      <div className="flex flex-col items-center select-none">
        {/* Top file coordinates */}
        <div className="flex w-full max-w-[460px] justify-around px-4 py-1 text-xs font-semibold text-neutral-400">
          {FILES_8.map(f => (
            <span key={f} className="w-10 text-center uppercase">{f}</span>
          ))}
        </div>

        <div className="relative border-4 border-neutral-700 bg-neutral-800 rounded-lg p-2 shadow-2xl">
          <div className="grid grid-cols-8 gap-0.5 w-[330px] sm:w-[440px] h-[330px] sm:h-[440px]">
            {board8.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const rank = 8 - rIdx;
                const file = FILES_8[cIdx];
                const sqName = `${file}${rank}`;
                const isSelected = selectedSquare === sqName;
                const isLegalDest = legalDestinations.includes(sqName);
                const isLightSquare = (rIdx + cIdx) % 2 === 0;
                const isLastOrigin = lastMove8 && lastMove8.from === sqName;
                const isLastDest = lastMove8 && lastMove8.to === sqName;
                const isSupporter = !!supportersMap[sqName];

                let bgClass = isLightSquare ? 'bg-amber-100 hover:bg-amber-200' : 'bg-amber-800/85 hover:bg-amber-700/85';
                if (isLastOrigin || isLastDest) {
                  bgClass = isLightSquare ? 'bg-amber-300' : 'bg-amber-600';
                }
                if (isSelected) {
                  bgClass = 'bg-yellow-400 ring-4 ring-yellow-500 z-10';
                }

                const pieceKey = cell ? `${cell.color}${cell.type}` : null;
                const symbol = pieceKey ? PIECE_SYMBOLS[pieceKey] : null;

                return (
                  <button
                    key={sqName}
                    id={`square-${sqName}`}
                    type="button"
                    onClick={() => onSquareClick(sqName)}
                    className={`relative flex items-center justify-center transition-all cursor-pointer ${bgClass}`}
                  >
                    {/* Rank coordinate on left edge */}
                    {cIdx === 0 && (
                      <span className={`absolute top-0.5 left-0.5 text-[8px] font-mono leading-none ${isLightSquare ? 'text-amber-900/50' : 'text-amber-200/50'}`}>
                        {rank}
                      </span>
                    )}
                    {/* File coordinate on bottom edge */}
                    {rIdx === 7 && (
                      <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-mono leading-none uppercase ${isLightSquare ? 'text-amber-900/50' : 'text-amber-200/50'}`}>
                        {file}
                      </span>
                    )}

                    {/* Supporter badge indicator */}
                    {isSupporter && (
                      <span
                        title="Voted for winning move"
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white"
                      />
                    )}

                    {/* Legal target dot */}
                    {isLegalDest && (
                      <div className={`absolute z-10 rounded-full ${cell ? 'inset-0.5 border-2 border-emerald-500/90' : 'w-2.5 h-2.5 bg-emerald-600/70'}`} />
                    )}

                    {/* Piece Symbol */}
                    {cell && (
                      <span
                        className={`text-2xl sm:text-3xl leading-none drop-shadow-sm transition-transform active:scale-95 ${
                          cell.color === 'w'
                            ? 'text-cyan-400 drop-shadow-[0_1px_1px_rgba(0,255,255,0.6)] font-bold'
                            : 'text-fuchsia-500 font-bold drop-shadow-[0_1px_2px_rgba(255,0,255,0.6)]'
                        }`}
                      >
                        {symbol}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
