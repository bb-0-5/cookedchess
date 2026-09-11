"""Standard 8x8 chess for comparing forms of government.

The chess rules come from python-chess. The political layer chooses legal moves:
democracy, monarchy, dictatorship, utilitarianism, or reputation-weighted voting.
"""

import argparse
import csv
import json
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import fmean

import chess


PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}
GOVERNMENTS = ("democracy", "monarchy", "dictatorship", "utilitarian", "reputation")


@dataclass
class Agent:
    agent_id: str
    color: bool
    start_piece: int
    survival: float
    material: float
    activity: float
    trust: float = 0.5

    @property
    def vote_weight(self):
        """Political weight used only by the reputation government (0.5 to 1.5)."""
        return 0.5 + self.trust


def color_name(color):
    return "White" if color == chess.WHITE else "Black"


def piece_tag(piece_type):
    return chess.piece_symbol(piece_type).upper()


def make_agents(board, seed):
    """Create stable, slightly different personalities for the pieces in one game."""
    rng = random.Random(seed + 91_117)
    counters = Counter()
    agents = {}
    positions = {}
    base_profiles = {
        chess.PAWN: (1.15, 0.75, 1.25),
        chess.KNIGHT: (0.95, 1.00, 1.25),
        chess.BISHOP: (0.95, 1.10, 1.10),
        chess.ROOK: (1.10, 1.25, 0.85),
        chess.QUEEN: (1.30, 1.50, 1.10),
        chess.KING: (1.80, 0.75, 0.40),
    }
    for square, piece in sorted(board.piece_map().items()):
        prefix = "W" if piece.color == chess.WHITE else "B"
        key = prefix + piece_tag(piece.piece_type)
        counters[key] += 1
        agent_id = f"{key}{counters[key]}"
        profile = base_profiles[piece.piece_type]
        jitter = lambda value: round(value * rng.uniform(0.86, 1.14), 3)
        agents[agent_id] = Agent(
            agent_id=agent_id,
            color=piece.color,
            start_piece=piece.piece_type,
            survival=jitter(profile[0]),
            material=jitter(profile[1]),
            activity=jitter(profile[2]),
        )
        positions[square] = agent_id
    return agents, positions


def apply_move(board, positions, move):
    """Push a chess move while preserving the political identity of each piece."""
    mover_color = board.turn
    moved_agent = positions.pop(move.from_square)
    positions.pop(move.to_square, None)
    if board.is_en_passant(move):
        captured_square = move.to_square - 8 if mover_color == chess.WHITE else move.to_square + 8
        positions.pop(captured_square, None)
    if board.is_castling(move):
        rank = 0 if mover_color == chess.WHITE else 7
        if chess.square_file(move.to_square) > chess.square_file(move.from_square):
            rook_from, rook_to = chess.square(7, rank), chess.square(5, rank)
        else:
            rook_from, rook_to = chess.square(0, rank), chess.square(3, rank)
        rook_agent = positions.pop(rook_from, None)
        if rook_agent is not None:
            positions[rook_to] = rook_agent
    board.push(move)
    positions[move.to_square] = moved_agent


def objective_value(after, focal_color):
    """A small neutral benchmark for regret, separate from every agent's wishes."""
    if after.is_checkmate():
        winner = not after.turn
        return 10_000 if winner == focal_color else -10_000
    if after.is_stalemate() or after.is_insufficient_material():
        return 0
    material = 0
    for piece in after.piece_map().values():
        value = PIECE_VALUES[piece.piece_type]
        material += value if piece.color == focal_color else -value
    # After a move, board.turn is the opposing side. Giving check is a modest bonus.
    check_bonus = 0.35 if after.turn != focal_color and after.is_check() else 0
    return material + check_bonus


def agent_utility(board, after, move, voter_square, voter, positions):
    """One piece's subjective preference for a legal proposal."""
    mover_id = positions[move.from_square]
    moving_piece = board.piece_at(move.from_square)
    captured_piece = board.piece_at(move.to_square)
    if board.is_en_passant(move):
        captured_piece = chess.Piece(chess.PAWN, not board.turn)

    score = 0.0
    if captured_piece is not None:
        score += PIECE_VALUES[captured_piece.piece_type] * voter.material
    if mover_id == voter.agent_id:
        score += 1.4 * voter.activity
        if moving_piece.piece_type == chess.PAWN:
            advance = chess.square_rank(move.to_square) - chess.square_rank(move.from_square)
            if voter.color == chess.BLACK:
                advance *= -1
            score += max(0, advance) * 0.35 * voter.activity

    personal_square = move.to_square if mover_id == voter.agent_id else voter_square
    personal_piece = after.piece_at(personal_square)
    if personal_piece and after.is_attacked_by(not voter.color, personal_square):
        score -= PIECE_VALUES[personal_piece.piece_type] * 0.28 * voter.survival

    if after.turn != voter.color and after.is_check():
        score += 0.5 * voter.activity
    return round(score, 5)


def vote_on_position(board, agents, positions):
    """Return all subjective ballots plus a one-ply neutral benchmark for each move."""
    moves = list(board.legal_moves)
    color = board.turn
    voters = [(square, agents[agent_id]) for square, agent_id in positions.items()
              if agents[agent_id].color == color]
    afters = {}
    benchmark = {}
    for move in moves:
        after = board.copy(stack=False)
        after.push(move)
        afters[move] = after
        benchmark[move] = objective_value(after, color)

    utilities = {}
    ballots = {}
    for square, voter in voters:
        row = {
            move: agent_utility(board, afters[move], move, square, voter, positions)
            for move in moves
        }
        utilities[voter.agent_id] = row
        ballots[voter.agent_id] = max(moves, key=lambda move: (row[move], move.uci()))
    return moves, voters, utilities, ballots, benchmark


def select_move(government, board, moves, voters, utilities, ballots):
    """Apply a constitution to the same set of individual preferences."""
    raw_support = Counter(ballots.values())
    total_utility = {move: sum(utilities[voter.agent_id][move] for _, voter in voters) for move in moves}
    king = next((voter for _, voter in voters if voter.start_piece == chess.KING), None)

    if government == "dictatorship" and king is not None:
        selected = ballots[king.agent_id]
    elif government == "utilitarian":
        selected = max(moves, key=lambda move: (total_utility[move], raw_support[move], move.uci()))
    elif government == "monarchy" and king is not None:
        monarch_support = {
            move: raw_support[move] + (4 if ballots[king.agent_id] == move else 0)
            for move in moves
        }
        selected = max(moves, key=lambda move: (monarch_support[move], total_utility[move], move.uci()))
    elif government == "reputation":
        weighted_support = {
            move: sum(voter.vote_weight for _, voter in voters if ballots[voter.agent_id] == move)
            for move in moves
        }
        selected = max(moves, key=lambda move: (weighted_support[move], total_utility[move], move.uci()))
    else:  # democracy: plurality; the log makes this explicit.
        selected = max(moves, key=lambda move: (raw_support[move], total_utility[move], move.uci()))
    return selected, raw_support, total_utility


def update_reputation(voters, ballots, benchmark, agents):
    """Past normalized regret slowly changes political credibility for later decisions."""
    best = max(benchmark.values())
    worst = min(benchmark.values())
    spread = max(best - worst, 0.001)
    records = []
    for square, voter in voters:
        favourite = ballots[voter.agent_id]
        relative_regret = max(0, min(1, (best - benchmark[favourite]) / spread))
        trust_before = voter.trust
        # A moving average prevents one lucky or unlucky turn from ruling the state.
        voter.trust = round(0.85 * voter.trust + 0.15 * (1 - relative_regret), 5)
        records.append({
            "agent_id": voter.agent_id,
            "square": chess.square_name(square),
            "favourite_move": favourite.uci(),
            "relative_regret": round(relative_regret, 5),
            "trust_before": trust_before,
            "trust_after": voter.trust,
        })
    return records


def random_opening(board, positions, rng, plies):
    for _ in range(plies):
        if board.is_game_over(claim_draw=True):
            return
        move = rng.choice(list(board.legal_moves))
        apply_move(board, positions, move)


def run_game(white_government, black_government, seed, args):
    board = chess.Board()
    agents, positions = make_agents(board, seed)
    random_opening(board, positions, random.Random(seed), args.opening_plies)
    opening_fen = board.fen()
    voter_rows = []
    plies = 0

    while not board.is_game_over(claim_draw=True) and plies < args.max_plies:
        government = white_government if board.turn == chess.WHITE else black_government
        side = board.turn
        moves, voters, utilities, ballots, benchmark = vote_on_position(board, agents, positions)
        selected, raw_support, total_utility = select_move(
            government, board, moves, voters, utilities, ballots
        )
        best_benchmark = max(benchmark.values())
        worst_benchmark = min(benchmark.values())
        spread = max(best_benchmark - worst_benchmark, 0.001)
        reputation_records = {}
        if government == "reputation":
            reputation_records = {
                record["agent_id"]: record
                for record in update_reputation(voters, ballots, benchmark, agents)
            }

        for square, voter in voters:
            favourite = ballots[voter.agent_id]
            relative_regret = max(0, min(1, (best_benchmark - benchmark[favourite]) / spread))
            reputation = reputation_records.get(voter.agent_id)
            voter_rows.append({
                "seed": seed,
                "ply": plies + 1,
                "side": color_name(side),
                "government": government,
                "agent_id": voter.agent_id,
                "agent_square": chess.square_name(square),
                "favourite_move": favourite.uci(),
                "supports_selected": favourite == selected,
                "selected_move": selected.uci(),
                "raw_support_for_selected": raw_support[selected],
                "eligible_voters": len(voters),
                "subjective_utility_of_selected": utilities[voter.agent_id][selected],
                "benchmark_of_favourite": benchmark[favourite],
                "best_benchmark": best_benchmark,
                "relative_regret": round(relative_regret, 5),
                "vote_weight_before": round(voter.vote_weight if reputation is None else 0.5 + reputation["trust_before"], 5),
                "vote_weight_after": round(voter.vote_weight, 5),
            })
        apply_move(board, positions, selected)
        plies += 1

    outcome = board.outcome(claim_draw=True)
    if outcome is None:
        result = "Draw / move limit"
        winner = None
    elif outcome.winner is None:
        result = "Draw"
        winner = None
    else:
        winner = color_name(outcome.winner)
        result = winner
    for row in voter_rows:
        row["game_result"] = result
    return {
        "white_government": white_government,
        "black_government": black_government,
        "seed": seed,
        "opening_fen": opening_fen,
        "plies": plies,
        "result": result,
        "termination": outcome.termination.name if outcome else "MOVE_LIMIT",
    }, voter_rows


def matchups(args):
    if args.round_robin:
        return [(white, black) for white in GOVERNMENTS for black in GOVERNMENTS]
    return [(args.white, args.black)]


def build_summary(games, voter_rows):
    government_stats = defaultdict(lambda: {"games": 0, "wins": 0, "losses": 0, "draws": 0})
    for game in games:
        for color, government in (("White", game["white_government"]), ("Black", game["black_government"])):
            stats = government_stats[government]
            stats["games"] += 1
            if game["result"] in ("Draw", "Draw / move limit"):
                stats["draws"] += 1
            elif game["result"] == color:
                stats["wins"] += 1
            else:
                stats["losses"] += 1
    regret_by_government = defaultdict(list)
    for row in voter_rows:
        regret_by_government[row["government"]].append(row["relative_regret"])
    return {
        "games": len(games),
        "average_plies": round(fmean(game["plies"] for game in games), 2) if games else 0,
        "governments": {
            government: {
                **stats,
                "win_rate": round(stats["wins"] / stats["games"], 4) if stats["games"] else 0,
                "average_relative_regret": round(fmean(regret_by_government[government]), 4)
                if regret_by_government[government] else 0,
            }
            for government, stats in sorted(government_stats.items())
        },
        "interpretation": (
            "Win rate measures chess outcomes. Average relative regret measures how often "
            "a government's voters preferred a move below the one-ply neutral benchmark. "
            "These are separate objectives, not one automatic definition of optimal."
        ),
    }


def write_outputs(prefix, games, voter_rows, summary):
    prefix = Path(prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    votes_path = prefix.with_name(prefix.name + "-votes.csv")
    games_path = prefix.with_name(prefix.name + "-games.json")
    summary_path = prefix.with_name(prefix.name + "-summary.json")
    with votes_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(voter_rows[0].keys()) if voter_rows else [])
        if voter_rows:
            writer.writeheader()
            writer.writerows(voter_rows)
    with games_path.open("w", encoding="utf-8") as file:
        json.dump(games, file, indent=2)
    with summary_path.open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)
    return votes_path, games_path, summary_path


def parse_args():
    parser = argparse.ArgumentParser(description="Compare political systems in standard chess.")
    parser.add_argument("--white", choices=GOVERNMENTS, default="democracy")
    parser.add_argument("--black", choices=GOVERNMENTS, default="dictatorship")
    parser.add_argument("--round-robin", action="store_true", help="Run every government pairing.")
    parser.add_argument("--games", type=int, default=2, help="Games per pairing.")
    parser.add_argument("--seed", type=int, default=20260910)
    parser.add_argument("--opening-plies", type=int, default=0, help="Random legal opening moves.")
    parser.add_argument("--max-plies", type=int, default=160)
    parser.add_argument("--out", default="data/governance-8x8")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.games < 1:
        raise SystemExit("--games must be at least 1.")
    games = []
    voter_rows = []
    for white_government, black_government in matchups(args):
        for game_index in range(args.games):
            seed = args.seed + game_index
            game, rows = run_game(white_government, black_government, seed, args)
            games.append(game)
            voter_rows.extend(rows)
            print(
                f"{white_government} (White) vs {black_government} (Black), "
                f"seed {seed}: {game['result']} in {game['plies']} plies"
            )
    summary = build_summary(games, voter_rows)
    votes_path, games_path, summary_path = write_outputs(args.out, games, voter_rows, summary)
    print("\n" + json.dumps(summary, indent=2))
    print(f"\nVotes for Excel: {votes_path}")
    print(f"Game records: {games_path}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
