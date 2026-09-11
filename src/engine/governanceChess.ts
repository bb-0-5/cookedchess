import { Chess, Square, PieceSymbol, Color, Move } from 'chess.js';
import { Agent8, GovernmentType, VoteData8 } from '../types';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100
};

export const BASE_PROFILES: Record<PieceSymbol, [number, number, number]> = {
  p: [1.15, 0.75, 1.25], // survival, material, activity
  n: [0.95, 1.00, 1.25],
  b: [0.95, 1.10, 1.10],
  r: [1.10, 1.25, 0.85],
  q: [1.30, 1.50, 1.10],
  k: [1.80, 0.75, 0.40]
};

// Seeded simple pseudo-random number generator for reproducible personalities
function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function makeAgents(board: Chess, seed: number = 42): {
  agents: Record<string, Agent8>;
  positions: Record<string, string>; // square (e.g. 'e2') -> agentId
} {
  const rng = createRng(seed + 91117);
  const counters: Record<string, number> = {};
  const agents: Record<string, Agent8> = {};
  const positions: Record<string, string> = {};

  const squares: Square[] = [
    'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
    'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
    'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
    'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'
  ];

  for (const sq of squares) {
    const piece = board.get(sq);
    if (!piece) continue;

    const prefix = piece.color === 'w' ? 'W' : 'B';
    const tag = piece.type.toUpperCase();
    const key = `${prefix}${tag}`;
    counters[key] = (counters[key] || 0) + 1;
    const agentId = `${key}${counters[key]}`;

    const profile = BASE_PROFILES[piece.type];
    const jitter = (val: number) => {
      const u = 0.86 + rng() * (1.14 - 0.86);
      return Math.round(val * u * 1000) / 1000;
    };

    agents[agentId] = {
      agentId,
      color: piece.color,
      startPiece: piece.type,
      currentPiece: piece.type,
      survival: jitter(profile[0]),
      material: jitter(profile[1]),
      activity: jitter(profile[2]),
      trust: 0.5,
      voteWeight: 1.0
    };

    positions[sq] = agentId;
  }

  return { agents, positions };
}

export function applyMove(
  board: Chess,
  positions: Record<string, string>,
  move: Move
) {
  const moverAgentId = positions[move.from];
  delete positions[move.from];
  delete positions[move.to];

  // En passant square removal
  if (move.flags.includes('e')) {
    const epSq = `${move.to[0]}${move.from[1]}` as Square;
    delete positions[epSq];
  }

  // Castling rook movement
  if (move.flags.includes('k')) {
    // King-side
    const rank = move.color === 'w' ? '1' : '8';
    const rookFrom = `h${rank}`;
    const rookTo = `f${rank}`;
    const rookAgent = positions[rookFrom];
    delete positions[rookFrom];
    if (rookAgent) positions[rookTo] = rookAgent;
  } else if (move.flags.includes('q')) {
    // Queen-side
    const rank = move.color === 'w' ? '1' : '8';
    const rookFrom = `a${rank}`;
    const rookTo = `d${rank}`;
    const rookAgent = positions[rookFrom];
    delete positions[rookFrom];
    if (rookAgent) positions[rookTo] = rookAgent;
  }

  board.move(move);
  if (moverAgentId) {
    positions[move.to] = moverAgentId;
  }
}

export function isSquareAttackedBy(board: Chess, square: Square, color: Color): boolean {
  // Check if square is attacked by color
  return board.isAttacked(square, color);
}

export function objectiveValue(afterBoard: Chess, focalColor: Color): number {
  if (afterBoard.isCheckmate()) {
    const winnerColor = afterBoard.turn() === 'w' ? 'b' : 'w';
    return winnerColor === focalColor ? 10000 : -10000;
  }
  if (afterBoard.isDraw()) {
    return 0;
  }

  let material = 0;
  const boardLayout = afterBoard.board();
  for (const row of boardLayout) {
    for (const cell of row) {
      if (cell) {
        const val = PIECE_VALUES[cell.type];
        material += cell.color === focalColor ? val : -val;
      }
    }
  }

  const opposingTurn = afterBoard.turn();
  const checkBonus = opposingTurn !== focalColor && afterBoard.inCheck() ? 0.35 : 0;
  return material + checkBonus;
}

export function agentUtility(
  board: Chess,
  afterBoard: Chess,
  move: Move,
  voterSquare: Square,
  voter: Agent8,
  positions: Record<string, string>
): number {
  const moverId = positions[move.from];
  const movingPiece = board.get(move.from);
  const capturedPiece = move.captured ? { type: move.captured, color: (voter.color === 'w' ? 'b' : 'w') as Color } : null;

  let score = 0.0;
  if (capturedPiece) {
    score += PIECE_VALUES[capturedPiece.type] * voter.material;
  }

  if (moverId === voter.agentId) {
    score += 1.4 * voter.activity;
    if (movingPiece && movingPiece.type === 'p') {
      const fromRank = parseInt(move.from[1], 10);
      const toRank = parseInt(move.to[1], 10);
      let advance = toRank - fromRank;
      if (voter.color === 'b') advance *= -1;
      score += Math.max(0, advance) * 0.35 * voter.activity;
    }
  }

  const personalSquare = (moverId === voter.agentId ? move.to : voterSquare) as Square;
  const personalPiece = afterBoard.get(personalSquare);
  const opponentColor: Color = voter.color === 'w' ? 'b' : 'w';

  if (personalPiece && isSquareAttackedBy(afterBoard, personalSquare, opponentColor)) {
    score -= PIECE_VALUES[personalPiece.type] * 0.28 * voter.survival;
  }

  if (afterBoard.turn() !== voter.color && afterBoard.inCheck()) {
    score += 0.5 * voter.activity;
  }

  return Math.round(score * 100000) / 100000;
}

export function conductVote8(
  board: Chess,
  agents: Record<string, Agent8>,
  positions: Record<string, string>,
  government: GovernmentType
): VoteData8 | null {
  const moves = board.moves({ verbose: true });
  if (moves.length === 0) return null;

  const color = board.turn();
  const voters: Array<{ square: Square; agent: Agent8 }> = [];

  for (const [sq, agentId] of Object.entries(positions)) {
    const agent = agents[agentId];
    if (agent && agent.color === color) {
      voters.push({ square: sq as Square, agent });
    }
  }

  // Pre-calculate after-boards and benchmark objectives
  const afters: Record<string, Chess> = {};
  const benchmark: Record<string, number> = {};

  for (const move of moves) {
    const uci = `${move.from}${move.to}${move.promotion || ''}`;
    const after = new Chess(board.fen());
    after.move(move);
    afters[uci] = after;
    benchmark[uci] = objectiveValue(after, color);
  }

  const utilities: Record<string, Record<string, number>> = {};
  const ballots: Record<string, string> = {}; // agentId -> moveUci
  const voterBallotItems: Array<{ square: string; agent: Agent8; ballotUci: string; utility: number }> = [];

  for (const { square, agent } of voters) {
    const row: Record<string, number> = {};
    let bestUci = `${moves[0].from}${moves[0].to}${moves[0].promotion || ''}`;
    let bestUtil = -Infinity;

    for (const move of moves) {
      const uci = `${move.from}${move.to}${move.promotion || ''}`;
      const util = agentUtility(board, afters[uci], move, square, agent, positions);
      row[uci] = util;

      if (util > bestUtil || (util === bestUtil && uci.localeCompare(bestUci) > 0)) {
        bestUtil = util;
        bestUci = uci;
      }
    }

    utilities[agent.agentId] = row;
    ballots[agent.agentId] = bestUci;
    voterBallotItems.push({
      square,
      agent,
      ballotUci: bestUci,
      utility: bestUtil
    });
  }

  // Raw vote support count
  const rawSupport: Record<string, number> = {};
  const totalUtility: Record<string, number> = {};
  const weightedSupport: Record<string, number> = {};

  for (const move of moves) {
    const uci = `${move.from}${move.to}${move.promotion || ''}`;
    rawSupport[uci] = 0;
    totalUtility[uci] = 0;
    weightedSupport[uci] = 0;
  }

  for (const { agent } of voters) {
    const votedUci = ballots[agent.agentId];
    if (votedUci) {
      rawSupport[votedUci] = (rawSupport[votedUci] || 0) + 1;
      weightedSupport[votedUci] = (weightedSupport[votedUci] || 0) + agent.voteWeight;
    }
  }

  for (const move of moves) {
    const uci = `${move.from}${move.to}${move.promotion || ''}`;
    let sumU = 0;
    for (const { agent } of voters) {
      sumU += utilities[agent.agentId][uci] || 0;
    }
    totalUtility[uci] = Math.round(sumU * 1000) / 1000;
  }

  // Constitution decision rule
  const kingVoter = voters.find(v => v.agent.startPiece === 'k');
  let selectedMove = moves[0];
  let selectedUci = `${moves[0].from}${moves[0].to}${moves[0].promotion || ''}`;

  if (government === 'dictatorship' && kingVoter) {
    const kingChoiceUci = ballots[kingVoter.agent.agentId];
    selectedMove = moves.find(m => `${m.from}${m.to}${m.promotion || ''}` === kingChoiceUci) || moves[0];
    selectedUci = kingChoiceUci;
  } else if (government === 'utilitarian') {
    selectedMove = moves.reduce((best, m) => {
      const uci = `${m.from}${m.to}${m.promotion || ''}`;
      const bestUci = `${best.from}${best.to}${best.promotion || ''}`;
      const utilDiff = (totalUtility[uci] || 0) - (totalUtility[bestUci] || 0);
      if (Math.abs(utilDiff) > 0.0001) return utilDiff > 0 ? m : best;
      const suppDiff = (rawSupport[uci] || 0) - (rawSupport[bestUci] || 0);
      if (suppDiff !== 0) return suppDiff > 0 ? m : best;
      return uci.localeCompare(bestUci) > 0 ? m : best;
    }, moves[0]);
    selectedUci = `${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`;
  } else if (government === 'monarchy' && kingVoter) {
    const kingChoiceUci = ballots[kingVoter.agent.agentId];
    selectedMove = moves.reduce((best, m) => {
      const uci = `${m.from}${m.to}${m.promotion || ''}`;
      const bestUci = `${best.from}${best.to}${best.promotion || ''}`;
      const mWeight = (rawSupport[uci] || 0) + (uci === kingChoiceUci ? 4 : 0);
      const bWeight = (rawSupport[bestUci] || 0) + (bestUci === kingChoiceUci ? 4 : 0);
      if (mWeight !== bWeight) return mWeight > bWeight ? m : best;
      const uDiff = (totalUtility[uci] || 0) - (totalUtility[bestUci] || 0);
      if (Math.abs(uDiff) > 0.0001) return uDiff > 0 ? m : best;
      return uci.localeCompare(bestUci) > 0 ? m : best;
    }, moves[0]);
    selectedUci = `${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`;
  } else if (government === 'reputation') {
    selectedMove = moves.reduce((best, m) => {
      const uci = `${m.from}${m.to}${m.promotion || ''}`;
      const bestUci = `${best.from}${best.to}${best.promotion || ''}`;
      const wDiff = (weightedSupport[uci] || 0) - (weightedSupport[bestUci] || 0);
      if (Math.abs(wDiff) > 0.001) return wDiff > 0 ? m : best;
      const uDiff = (totalUtility[uci] || 0) - (totalUtility[bestUci] || 0);
      if (Math.abs(uDiff) > 0.0001) return uDiff > 0 ? m : best;
      return uci.localeCompare(bestUci) > 0 ? m : best;
    }, moves[0]);
    selectedUci = `${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`;
  } else {
    // Democracy (Plurality)
    selectedMove = moves.reduce((best, m) => {
      const uci = `${m.from}${m.to}${m.promotion || ''}`;
      const bestUci = `${best.from}${best.to}${best.promotion || ''}`;
      const sDiff = (rawSupport[uci] || 0) - (rawSupport[bestUci] || 0);
      if (sDiff !== 0) return sDiff > 0 ? m : best;
      const uDiff = (totalUtility[uci] || 0) - (totalUtility[bestUci] || 0);
      if (Math.abs(uDiff) > 0.0001) return uDiff > 0 ? m : best;
      return uci.localeCompare(bestUci) > 0 ? m : best;
    }, moves[0]);
    selectedUci = `${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`;
  }

  // Update reputation for reputation-weighted government
  const benchmarkValues = Object.values(benchmark);
  const bestBench = Math.max(...benchmarkValues);
  const worstBench = Math.min(...benchmarkValues);
  const spread = Math.max(bestBench - worstBench, 0.001);

  const reputationUpdates: VoteData8['reputationUpdates'] = [];
  for (const { square, agent } of voters) {
    const favUci = ballots[agent.agentId];
    const favBench = benchmark[favUci] ?? 0;
    const relativeRegret = Math.max(0, Math.min(1, (bestBench - favBench) / spread));
    const trustBefore = agent.trust;
    const trustAfter = Math.round((0.85 * agent.trust + 0.15 * (1 - relativeRegret)) * 10000) / 10000;
    agent.trust = trustAfter;
    agent.voteWeight = Math.round((0.5 + trustAfter) * 1000) / 1000;

    reputationUpdates.push({
      agentId: agent.agentId,
      square,
      favouriteMove: favUci,
      relativeRegret: Math.round(relativeRegret * 1000) / 1000,
      trustBefore,
      trustAfter
    });
  }

  const supporters = voters
    .filter(v => ballots[v.agent.agentId] === selectedUci)
    .map(v => `${v.agent.agentId}@${v.square}`);

  const sideName = color === 'w' ? 'White' : 'Black';
  const govName = government.toUpperCase();
  const bulletin = `[8×8 ${govName}] ${sideName} selects ${selectedMove.san} (${selectedUci}) with ${rawSupport[selectedUci]} direct votes (utility: ${totalUtility[selectedUci]}). Supported by: ${supporters.slice(0, 8).join(', ')}${supporters.length > 8 ? ` +${supporters.length - 8} more` : ''}`;

  return {
    ply: board.history().length + 1,
    turn: color,
    government,
    voters: voterBallotItems,
    ballots,
    supportCounts: rawSupport,
    selectedMoveUci: selectedUci,
    selectedMoveSan: selectedMove.san,
    supporters,
    reputationUpdates,
    bulletin
  };
}
