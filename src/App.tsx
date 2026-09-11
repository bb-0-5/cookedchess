import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import { GovernmentType, HansardLogItem, Move5, VoteData5, VoteData8 } from './types';
import { Board5, conductVote5, parseSquare, squareName } from './engine/fiveByFive';
import { conductVote8, makeAgents, applyMove } from './engine/governanceChess';
import { ChessBoard } from './components/ChessBoard';
import { ParliamentChamber } from './components/ParliamentChamber';
import { BreakingNews } from './components/BreakingNews';
import { GameControls } from './components/GameControls';
import { AnalyticsPanel } from './components/AnalyticsPanel';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'5x5' | '8x8'>('5x5');

  // --- 5x5 State ---
  const [board5, setBoard5] = useState<Board5>(() => new Board5());
  const [lastMove5, setLastMove5] = useState<Move5 | null>(null);
  const [voteData5, setVoteData5] = useState<VoteData5 | null>(null);

  // --- 8x8 State ---
  const [chess8, setChess8] = useState<Chess>(() => new Chess());
  const [agents8, setAgents8] = useState(() => makeAgents(new Chess(), 42).agents);
  const [positions8, setPositions8] = useState(() => makeAgents(new Chess(), 42).positions);
  const [lastMove8, setLastMove8] = useState<{ from: string; to: string } | null>(null);
  const [voteData8, setVoteData8] = useState<VoteData8 | null>(null);
  const [whiteGov, setWhiteGov] = useState<GovernmentType>('democracy');
  const [blackGov, setBlackGov] = useState<GovernmentType>('dictatorship');

  // Interactive Board Selection
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<string[]>([]);

  // General Simulation State
  const [bulletin, setBulletin] = useState<string>(
    'Session open. Pieces are in position. Click "Convene Parliament" to conduct initial vote.'
  );
  const [history, setHistory] = useState<HansardLogItem[]>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(700);
  const [supportersMap, setSupportersMap] = useState<Record<string, boolean>>({});

  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derived Game Over state
  const isGameOver = mode === '5x5'
    ? board5.isGameOver()
    : chess8.isGameOver();

  const gameResult = mode === '5x5'
    ? board5.result()
    : chess8.isCheckmate()
      ? `${chess8.turn() === 'w' ? 'Black' : 'White'} wins by checkmate!`
      : chess8.isDraw()
        ? 'Draw declared (stalemate, repetition, or insufficient material).'
        : '';

  const activeTurnName: 'White' | 'Black' = mode === '5x5'
    ? (board5.turn === 'W' ? 'White' : 'Black')
    : (chess8.turn() === 'w' ? 'White' : 'Black');

  // Reset function
  const handleReset = useCallback(() => {
    setIsAutoPlaying(false);
    setSelectedSquare(null);
    setLegalDestinations([]);
    setSupportersMap({});
    setHistory([]);

    if (mode === '5x5') {
      const b = new Board5();
      setBoard5(b);
      setLastMove5(null);
      setVoteData5(null);
      setBulletin('5×5 Parliament dissolved. New House convened at initial squares.');
    } else {
      const c = new Chess();
      const { agents, positions } = makeAgents(c, Math.floor(Math.random() * 100000));
      setChess8(c);
      setAgents8(agents);
      setPositions8(positions);
      setLastMove8(null);
      setVoteData8(null);
      setBulletin('8×8 Governance Tournament reset. New piece personalities seeded.');
    }
  }, [mode]);

  // Mode change handler
  const handleModeChange = (newMode: '5x5' | '8x8') => {
    if (newMode === mode) return;
    setIsAutoPlaying(false);
    setSelectedSquare(null);
    setLegalDestinations([]);
    setSupportersMap({});
    setHistory([]);
    setMode(newMode);

    if (newMode === '5x5') {
      const b = new Board5();
      setBoard5(b);
      setLastMove5(null);
      setVoteData5(null);
      setBulletin('Switched to 5×5 Parliament Prototype. Pieces vote on every move.');
    } else {
      const c = new Chess();
      const { agents, positions } = makeAgents(c, 42);
      setChess8(c);
      setAgents8(agents);
      setPositions8(positions);
      setLastMove8(null);
      setVoteData8(null);
      setBulletin('Switched to 8×8 Governance Tournament. Select constitutions for White and Black.');
    }
  };

  // Step Move: Convene Parliament
  const conveneParliament = useCallback(() => {
    if (isGameOver) {
      setIsAutoPlaying(false);
      return;
    }

    if (mode === '5x5') {
      const vote = conductVote5(board5);
      if (!vote) {
        setBulletin('Parliament dissolved — no legal moves remaining.');
        setIsAutoPlaying(false);
        return;
      }

      setVoteData5(vote);
      setBulletin(vote.bulletin);

      // Map supporters to squares
      const supMap: Record<string, boolean> = {};
      for (const { square } of vote.voters) {
        const sqName = squareName(square[0], square[1]);
        const key = `${square[0]},${square[1]}`;
        if (vote.ballots[key]?.notation === vote.winner.notation) {
          supMap[sqName] = true;
        }
      }
      setSupportersMap(supMap);

      const sideName = board5.turn === 'W' ? 'White' : 'Black';
      const winnerNotation = vote.winner.notation;
      const votersCount = vote.voters.length;
      const winningVotes = vote.totals[winnerNotation] || 0;

      // Push move to board
      const newBoard = board5.clone();
      newBoard.push(vote.winner);
      setBoard5(newBoard);
      setLastMove5(vote.winner);

      // Add to Hansard history
      setHistory(prev => [
        ...prev,
        {
          id: `5x5-${prev.length + 1}-${Date.now()}`,
          turnNumber: prev.length + 1,
          side: sideName,
          mode: '5x5',
          moveNotation: winnerNotation,
          votersCount,
          winningVotes,
          supporters: vote.supporters,
          headline: `Passage of Motion ${winnerNotation}`,
          summary: vote.bulletin
        }
      ]);
    } else {
      // 8x8 Governance Chess
      const currentGov = chess8.turn() === 'w' ? whiteGov : blackGov;
      const vote = conductVote8(chess8, agents8, positions8, currentGov);

      if (!vote) {
        setBulletin('Governance deadlock — no legal moves available.');
        setIsAutoPlaying(false);
        return;
      }

      setVoteData8(vote);
      setBulletin(vote.bulletin);

      // Map supporters
      const supMap: Record<string, boolean> = {};
      for (const voter of vote.voters) {
        if (voter.ballotUci === vote.selectedMoveUci) {
          supMap[voter.square] = true;
        }
      }
      setSupportersMap(supMap);

      const sideName = chess8.turn() === 'w' ? 'White' : 'Black';
      const moveUci = vote.selectedMoveUci;
      const fromSq = moveUci.slice(0, 2);
      const toSq = moveUci.slice(2, 4);

      // Push move to chess8
      const moves = chess8.moves({ verbose: true });
      const matchingMove = moves.find(m => `${m.from}${m.to}${m.promotion || ''}` === moveUci);

      if (matchingMove) {
        const newChess = new Chess(chess8.fen());
        const newPositions = { ...positions8 };
        applyMove(newChess, newPositions, matchingMove);

        setChess8(newChess);
        setPositions8(newPositions);
        setLastMove8({ from: fromSq, to: toSq });

        // Add to history
        setHistory(prev => [
          ...prev,
          {
            id: `8x8-${prev.length + 1}-${Date.now()}`,
            turnNumber: prev.length + 1,
            side: sideName,
            mode: '8x8',
            government: currentGov,
            moveNotation: vote.selectedMoveSan,
            votersCount: vote.voters.length,
            winningVotes: vote.supportCounts[moveUci] || 0,
            supporters: vote.supporters,
            headline: `${sideName} (${currentGov}) passes ${vote.selectedMoveSan}`,
            summary: vote.bulletin
          }
        ]);
      }
    }
  }, [mode, board5, chess8, agents8, positions8, whiteGov, blackGov, isGameOver]);

  // Auto-play loop
  useEffect(() => {
    if (isAutoPlaying && !isGameOver) {
      autoPlayTimerRef.current = setTimeout(() => {
        conveneParliament();
      }, speed);
    } else {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [isAutoPlaying, isGameOver, speed, conveneParliament]);

  // Square Click interaction (inspecting pieces & legal moves)
  const handleSquareClick = (squareStr: string) => {
    if (mode === '5x5') {
      const coords = parseSquare(squareStr);
      if (!coords) return;
      const piece = board5.at(coords[0], coords[1]);

      if (selectedSquare === squareStr) {
        setSelectedSquare(null);
        setLegalDestinations([]);
        return;
      }

      if (piece && piece.side === board5.turn) {
        setSelectedSquare(squareStr);
        const dests = board5.destinations(coords, piece);
        setLegalDestinations(dests.map(d => squareName(d[0], d[1])));
      } else {
        setSelectedSquare(null);
        setLegalDestinations([]);
      }
    } else {
      const piece = chess8.get(squareStr as Square);
      if (selectedSquare === squareStr) {
        setSelectedSquare(null);
        setLegalDestinations([]);
        return;
      }

      if (piece && piece.color === chess8.turn()) {
        setSelectedSquare(squareStr);
        const moves = chess8.moves({ square: squareStr as Square, verbose: true });
        setLegalDestinations(moves.map(m => m.to));
      } else {
        setSelectedSquare(null);
        setLegalDestinations([]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur px-4 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Parliament">🏛️</span>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-100 flex items-center gap-2">
                <span>Consensus Chess</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                  The Parliament of Pieces
                </span>
              </h1>
              <p className="text-xs text-neutral-400 hidden sm:block">
                Every piece votes on legal moves under democratic, monarchic, or reputation rules.
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-neutral-400">Regime:</span>
            <span className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded font-semibold text-amber-400">
              {mode === '5x5' ? '5×5 Parliament' : '8×8 Tournament'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Board & Controls (lg: 7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center shadow-xl">
            {/* Turn & Status Header */}
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    activeTurnName === 'White' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-neutral-950 ring-2 ring-neutral-600'
                  }`}
                />
                <span className="text-sm font-bold text-neutral-200">
                  {activeTurnName}'s Turn
                </span>
                {mode === '8x8' && (
                  <span className="text-xs text-neutral-400 font-mono">
                    ({activeTurnName === 'White' ? whiteGov : blackGov})
                  </span>
                )}
              </div>

              {isGameOver && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Session Adjourned
                </span>
              )}
            </div>

            {/* Chess Board */}
            <ChessBoard
              mode={mode}
              grid5={board5.grid}
              lastMove5={lastMove5}
              board8={chess8.board()}
              lastMove8={lastMove8}
              turn={mode === '5x5' ? board5.turn : chess8.turn()}
              selectedSquare={selectedSquare}
              legalDestinations={legalDestinations}
              onSquareClick={handleSquareClick}
              supportersMap={supportersMap}
            />

            {/* Hint */}
            <p className="mt-3 text-[11px] text-neutral-500 text-center">
              Green badges highlight parliamentarians who voted for the enacted move.
            </p>
          </div>

          {/* Interactive Game Controls */}
          <GameControls
            mode={mode}
            onModeChange={handleModeChange}
            onConveneParliament={conveneParliament}
            onResetGame={handleReset}
            isAutoPlaying={isAutoPlaying}
            onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
            speed={speed}
            onSpeedChange={setSpeed}
            isGameOver={isGameOver}
            whiteGov={whiteGov}
            blackGov={blackGov}
            onWhiteGovChange={setWhiteGov}
            onBlackGovChange={setBlackGov}
            activeTurn={activeTurnName}
          />

          {/* Analytics & Constitutional Metrics */}
          <AnalyticsPanel
            mode={mode}
            whiteGov={whiteGov}
            blackGov={blackGov}
            history={history}
            agents8={agents8}
          />
        </div>

        {/* Right Column: Parliamentary Chamber & News Desk (lg: 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Breaking News Dispatch */}
          <BreakingNews
            bulletin={bulletin}
            history={history}
            isGameOver={isGameOver}
            gameResult={gameResult}
          />

          {/* Parliamentary Chamber Roster & Live Ballots */}
          <ParliamentChamber
            mode={mode}
            activeTurn={activeTurnName}
            voteData5={voteData5}
            voteData8={voteData8}
            agents8={agents8}
            positions8={positions8}
            whiteGov={whiteGov}
            blackGov={blackGov}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
