export type Side = 'W' | 'B';
export type PieceKind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export type GovernmentType = 'democracy' | 'monarchy' | 'dictatorship' | 'utilitarian' | 'reputation';

export interface Piece5 {
  side: Side;
  kind: PieceKind;
}

export interface Move5 {
  origin: [number, number]; // [row, col]
  destination: [number, number];
  notation: string;
}

export interface VoteData5 {
  voters: Array<{ square: [number, number]; piece: Piece5 }>;
  ballots: Record<string, Move5>; // squareKey -> Move5
  totals: Record<string, number>; // moveNotation -> count
  totalEnthusiasm: Record<string, number>; // moveNotation -> sum of preference scores
  winner: Move5;
  supporters: string[];
  bulletin: string;
}

export interface Agent8 {
  agentId: string;
  color: 'w' | 'b';
  startPiece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  currentPiece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  survival: number;
  material: number;
  activity: number;
  trust: number;
  voteWeight: number; // 0.5 + trust
}

export interface MoveEvaluation8 {
  moveUci: string;
  san: string;
  from: string;
  to: string;
  moverPiece: string;
  capturedPiece?: string;
  totalUtility: number;
  rawSupport: number;
  weightedSupport: number;
  benchmarkObjective: number;
}

export interface VoteData8 {
  ply: number;
  turn: 'w' | 'b';
  government: GovernmentType;
  voters: Array<{ square: string; agent: Agent8; ballotUci: string; utility: number }>;
  ballots: Record<string, string>; // agentId -> moveUci
  supportCounts: Record<string, number>; // moveUci -> votes
  selectedMoveUci: string;
  selectedMoveSan: string;
  supporters: string[];
  reputationUpdates: Array<{
    agentId: string;
    square: string;
    favouriteMove: string;
    relativeRegret: number;
    trustBefore: number;
    trustAfter: number;
  }>;
  bulletin: string;
}

export interface HansardLogItem {
  id: string;
  turnNumber: number;
  side: 'Cyan' | 'Magenta';
  mode: '5x5' | '8x8';
  government?: GovernmentType;
  moveNotation: string;
  votersCount: number;
  winningVotes: number;
  supporters: string[];
  headline: string;
  summary: string;
}
