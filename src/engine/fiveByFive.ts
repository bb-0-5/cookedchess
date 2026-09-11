import { Piece5, Move5, VoteData5, PieceKind, Side } from '../types';

export const FILES = 'ABCDE';
export const VALUES: Record<PieceKind, number> = {
  K: 100,
  Q: 9,
  R: 5,
  B: 3,
  N: 3,
  P: 1
};

export function squareName(row: number, col: number): string {
  return `${FILES[col]}${5 - row}`;
}

export function parseSquare(notation: string): [number, number] | null {
  if (notation.length < 2) return null;
  const col = FILES.indexOf(notation[0].toUpperCase());
  const rowNum = parseInt(notation[1], 10);
  if (col === -1 || isNaN(rowNum) || rowNum < 1 || rowNum > 5) return null;
  return [5 - rowNum, col];
}

export class Board5 {
  grid: (Piece5 | null)[][];
  turn: Side;
  history: Array<{ move: Move5; piece: Piece5; captured: Piece5 | null }>;

  constructor() {
    this.grid = Array(5).fill(null).map(() => Array(5).fill(null));
    this.turn = 'W';
    this.history = [];
    this.setup();
  }

  setup() {
    const order: PieceKind[] = ['R', 'N', 'B', 'Q', 'K'];
    for (let col = 0; col < 5; col++) {
      this.grid[4][col] = { side: 'W', kind: order[col] };
      this.grid[0][col] = { side: 'B', kind: order[col] };
      this.grid[3][col] = { side: 'W', kind: 'P' };
      this.grid[1][col] = { side: 'B', kind: 'P' };
    }
  }

  clone(): Board5 {
    const copy = new Board5();
    copy.grid = this.grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
    copy.turn = this.turn;
    copy.history = [...this.history];
    return copy;
  }

  at(row: number, col: number): Piece5 | null {
    if (row < 0 || row >= 5 || col < 0 || col >= 5) return null;
    return this.grid[row][col];
  }

  pieces(side: Side): Array<{ square: [number, number]; piece: Piece5 }> {
    const result: Array<{ square: [number, number]; piece: Piece5 }> = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const p = this.grid[r][c];
        if (p && p.side === side) {
          result.push({ square: [r, c], piece: p });
        }
      }
    }
    return result;
  }

  destinations(origin: [number, number], piece: Piece5): [number, number][] {
    const [row, col] = origin;
    const moves: [number, number][] = [];

    const inside = (r: number, c: number) => r >= 0 && r < 5 && c >= 0 && c < 5;

    const add = (r: number, c: number) => {
      if (inside(r, c)) {
        const target = this.at(r, c);
        if (!target || target.side !== piece.side) {
          moves.push([r, c]);
        }
      }
    };

    const slide = (directions: [number, number][]) => {
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inside(r, c)) {
          const target = this.at(r, c);
          if (!target) {
            moves.push([r, c]);
          } else {
            if (target.side !== piece.side) {
              moves.push([r, c]);
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
    };

    const straight: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const diagonal: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    if (piece.kind === 'P') {
      const dir = piece.side === 'W' ? -1 : 1;
      const forward: [number, number] = [row + dir, col];
      if (inside(forward[0], forward[1]) && !this.at(forward[0], forward[1])) {
        moves.push(forward);
      }
      for (const dc of [-1, 1]) {
        const capture: [number, number] = [row + dir, col + dc];
        if (inside(capture[0], capture[1])) {
          const target = this.at(capture[0], capture[1]);
          if (target && target.side !== piece.side) {
            moves.push(capture);
          }
        }
      }
    } else if (piece.kind === 'N') {
      const knightDeltas: [number, number][] = [
        [2, 1], [2, -1], [-2, 1], [-2, -1],
        [1, 2], [1, -2], [-1, 2], [-1, -2]
      ];
      for (const [dr, dc] of knightDeltas) {
        add(row + dr, col + dc);
      }
    } else if (piece.kind === 'K') {
      for (const [dr, dc] of [...straight, ...diagonal]) {
        add(row + dr, col + dc);
      }
    } else if (piece.kind === 'R') {
      slide(straight);
    } else if (piece.kind === 'B') {
      slide(diagonal);
    } else if (piece.kind === 'Q') {
      slide([...straight, ...diagonal]);
    }

    return moves;
  }

  legalMoves(side: Side = this.turn): Move5[] {
    const list: Move5[] = [];
    for (const { square, piece } of this.pieces(side)) {
      const dests = this.destinations(square, piece);
      for (const dest of dests) {
        list.push({
          origin: square,
          destination: dest,
          notation: `${squareName(square[0], square[1])}-${squareName(dest[0], dest[1])}`
        });
      }
    }
    return list;
  }

  push(move: Move5): { piece: Piece5; captured: Piece5 | null } {
    const piece = this.at(move.origin[0], move.origin[1])!;
    const captured = this.at(move.destination[0], move.destination[1]);

    this.grid[move.destination[0]][move.destination[1]] = piece;
    this.grid[move.origin[0]][move.origin[1]] = null;

    // Pawns promote to Queen on far rank
    if (piece.kind === 'P' && (move.destination[0] === 0 || move.destination[0] === 4)) {
      this.grid[move.destination[0]][move.destination[1]] = { side: piece.side, kind: 'Q' };
    }

    this.history.push({ move, piece, captured });
    this.turn = this.turn === 'W' ? 'B' : 'W';
    return { piece, captured };
  }

  isGameOver(): boolean {
    const whiteKing = this.pieces('W').some(p => p.piece.kind === 'K');
    const blackKing = this.pieces('B').some(p => p.piece.kind === 'K');
    if (!whiteKing || !blackKing) return true;
    return this.legalMoves().length === 0;
  }

  result(): string {
    const whiteKing = this.pieces('W').some(p => p.piece.kind === 'K');
    const blackKing = this.pieces('B').some(p => p.piece.kind === 'K');
    if (!whiteKing) return 'Black wins by capturing the White King.';
    if (!blackKing) return 'White wins by capturing the Black King.';
    return 'Stalemate — No legal moves available.';
  }
}

export function preferenceScore(
  board: Board5,
  move: Move5,
  voterSquare: [number, number],
  voter: Piece5
): number {
  const mover = board.at(move.origin[0], move.origin[1]);
  const target = board.at(move.destination[0], move.destination[1]);
  let score = 0;

  if (target) {
    const isMilitary = 'QRBN'.includes(voter.kind);
    score += VALUES[target.kind] * (isMilitary ? 2 : 1);
  }

  if (voterSquare[0] === move.origin[0] && voterSquare[1] === move.origin[1]) {
    score += 4; // personal agency
  }

  if (mover) {
    const advance = mover.side === 'W'
      ? move.origin[0] - move.destination[0]
      : move.destination[0] - move.origin[0];

    if (voter.kind === 'P') {
      score += advance * 2;
    }
    if (voter.kind === 'K') {
      score += target === null ? 1 : -2;
    }
  }

  const [destRow, destCol] = move.destination;
  if (destRow === 2 || destCol === 2) {
    score += 1;
  }

  return score;
}

export function conductVote5(board: Board5): VoteData5 | null {
  const moves = board.legalMoves();
  if (moves.length === 0) return null;

  const voters = board.pieces(board.turn);
  const ballots: Record<string, Move5> = {};
  const totals: Record<string, number> = {};
  const totalEnthusiasm: Record<string, number> = {};

  for (const move of moves) {
    totals[move.notation] = 0;
    totalEnthusiasm[move.notation] = 0;
  }

  for (const { square, piece } of voters) {
    const key = `${square[0]},${square[1]}`;
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = preferenceScore(board, move, square, piece);
      if (
        score > bestScore ||
        (score === bestScore && move.notation.localeCompare(bestMove.notation) > 0)
      ) {
        bestScore = score;
        bestMove = move;
      }
    }

    ballots[key] = bestMove;
    totals[bestMove.notation] = (totals[bestMove.notation] || 0) + 1;
  }

  for (const move of moves) {
    let sumScore = 0;
    for (const { square, piece } of voters) {
      sumScore += preferenceScore(board, move, square, piece);
    }
    totalEnthusiasm[move.notation] = sumScore;
  }

  // Plurality voting with total enthusiasm and notation tiebreaker
  let winner = moves[0];
  let winnerKey = [
    totals[winner.notation] || 0,
    totalEnthusiasm[winner.notation] || 0,
    winner.notation
  ];

  for (const move of moves) {
    const currentKey = [
      totals[move.notation] || 0,
      totalEnthusiasm[move.notation] || 0,
      move.notation
    ];
    if (
      currentKey[0] > winnerKey[0] ||
      (currentKey[0] === winnerKey[0] && currentKey[1] > winnerKey[1]) ||
      (currentKey[0] === winnerKey[0] && currentKey[1] === winnerKey[1] && move.notation.localeCompare(winner.notation) > 0)
    ) {
      winner = move;
      winnerKey = currentKey;
    }
  }

  const supporters: string[] = [];
  for (const { square, piece } of voters) {
    const key = `${square[0]},${square[1]}`;
    if (ballots[key].notation === winner.notation) {
      supporters.push(`${piece.kind}@${squareName(square[0], square[1])}`);
    }
  }

  const mover = board.at(winner.origin[0], winner.origin[1]);
  const captured = board.at(winner.destination[0], winner.destination[1]);
  const sideName = board.turn === 'W' ? 'White' : 'Black';
  const captureText = captured ? `, capturing ${captured.kind}` : '';

  const bulletin = `BREAKING NEWS — ${sideName} Parliament elects ${mover?.kind} ${winner.notation}${captureText} with ${totals[winner.notation]} of ${voters.length} first-preference votes. Supported by: ${supporters.join(', ')}`;

  return {
    voters,
    ballots,
    totals,
    totalEnthusiasm,
    winner,
    supporters,
    bulletin
  };
}
