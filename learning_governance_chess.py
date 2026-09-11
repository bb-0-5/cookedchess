"""Learned-governance experiment for standard 8x8 chess.

Every government begins with identical, blank action-value models. During self-play,
each piece learns to predict its personal final reward from the moves its government
actually enacted. The constitution decides whose predictions can control the move.
After training, learning freezes and all governments play the same held-out seeds.

This is deliberately a small feature-based learner, not a grandmaster engine. It
generalizes through board features rather than memorizing raw board positions.
"""

import argparse
import csv
import json
import random
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from itertools import product
from pathlib import Path
from statistics import fmean

import chess  # <-- This was missing

# Define the governments ONCE with the new uninvented systems included:
GOVERNMENTS = ("democracy", "monarchy", "dictatorship", "utilitarian", "reputation", "technocracy", "anarchy")

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}

FEATURE_COUNT = 7

@dataclass
class Agent:
    """One persistent political actor across every game in its society."""

    agent_id: str
    color: bool
    start_piece: int
    survival: float
    material: float
    activity: float
    team_loyalty: float
    weights: list[float] = field(default_factory=lambda: [0.0] * FEATURE_COUNT)
    trust: float = 0.5

    @property
    def vote_weight(self):
        # Political influence only. Chess-material value never changes.
        return 0.5 + self.trust

    def predict(self, features, prior):
        return sum(weight * value for weight, value in zip(self.weights, features)) + prior

    def learn(self, features, prediction, reward, learning_rate):
        error = reward - prediction
        self.weights = [
            max(-4.0, min(4.0, weight + learning_rate * error * value))
            for weight, value in zip(self.weights, features)
        ]
        # Reputation measures forecast calibration, not a piece's board value.
        calibration = max(0.0, 1.0 - abs(error) / 4.0)
        self.trust = max(0.0, min(1.0, 0.97 * self.trust + 0.03 * calibration))
        return error


@dataclass
class Society:
    government: str
    agents: dict[str, Agent]
    starting_positions: dict[int, str]


def color_name(color):
    return "White" if color == chess.WHITE else "Black"


def piece_tag(piece_type):
    return chess.piece_symbol(piece_type).upper()


def create_society(government, seed):
    """All governments receive the exact same initial personalities and blank models."""
    board = chess.Board()
    rng = random.Random(seed + 91_117)
    counters = Counter()
    agents = {}
    positions = {}
    base_profiles = {
        chess.PAWN: (1.15, 0.75, 1.25, 0.95),
        chess.KNIGHT: (0.95, 1.00, 1.25, 1.05),
        chess.BISHOP: (0.95, 1.10, 1.10, 1.05),
        chess.ROOK: (1.10, 1.25, 0.85, 1.10),
        chess.QUEEN: (1.30, 1.50, 1.10, 1.15),
        chess.KING: (1.80, 0.75, 0.40, 1.55),
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
            team_loyalty=jitter(profile[3]),
        )
        positions[square] = agent_id
    return Society(government, agents, positions)


def apply_move(board, positions, move):
    """Play a legal move while preserving every piece's political identity."""
    mover_color = board.turn
    mover_id = positions.pop(move.from_square)
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
        rook_id = positions.pop(rook_from, None)
        if rook_id is not None:
            positions[rook_to] = rook_id
    board.push(move)
    positions[move.to_square] = mover_id


def material_balance(board, color):
    total = 0
    for piece in board.piece_map().values():
        if piece.piece_type == chess.KING:
            continue
        value = PIECE_VALUES[piece.piece_type]
        total += value if piece.color == color else -value
    return total / 39.0


def move_features(board, after, move, voter_square, voter, positions):
    """Small normalized signals used by the learner instead of raw-board memory."""
    mover_id = positions[move.from_square]
    moving_piece = board.piece_at(move.from_square)
    captured_piece = board.piece_at(move.to_square)
    if board.is_en_passant(move):
        captured_piece = chess.Piece(chess.PAWN, not board.turn)
    capture = 0.0 if captured_piece is None else PIECE_VALUES[captured_piece.piece_type] / 9.0
    personal_square = move.to_square if mover_id == voter.agent_id else voter_square
    personal_piece = after.piece_at(personal_square)
    danger = int(
        personal_piece is not None and after.is_attacked_by(not voter.color, personal_square)
    )
    file_distance = abs(chess.square_file(move.to_square) - 3.5)
    rank_distance = abs(chess.square_rank(move.to_square) - 3.5)
    centrality = 1.0 - (file_distance + rank_distance) / 7.0
    pawn_advance = 0.0
    if moving_piece.piece_type == chess.PAWN and mover_id == voter.agent_id:
        pawn_advance = chess.square_rank(move.to_square) - chess.square_rank(move.from_square)
        if voter.color == chess.BLACK:
            pawn_advance *= -1
        pawn_advance /= 2.0
    gives_check = int(after.turn != voter.color and after.is_check())
    return [
        1.0,
        material_balance(after, voter.color),
        capture,
        float(mover_id == voter.agent_id),
        -float(danger),
        centrality,
        pawn_advance + 0.5 * gives_check,
    ]


def personal_prior(board, after, move, voter_square, voter, positions):
    """Personality before data: enough diversity to explore, small enough to be learned over."""
    features = move_features(board, after, move, voter_square, voter, positions)
    capture = features[2] * 9.0
    moved_self = features[3]
    danger = -features[4]
    return (
        0.12 * capture * voter.material
        + 0.16 * moved_self * voter.activity
        - 0.22 * danger * voter.survival
        + 0.06 * features[5] * voter.activity
        + 0.10 * features[6] * voter.activity
    )


def collect_opinions(board, agents, positions, rng, epsilon):
    """Each active piece estimates every legal move and submits one (possibly exploratory) ballot."""
    moves = list(board.legal_moves)
    voters = [(square, agents[agent_id]) for square, agent_id in positions.items()
              if agents[agent_id].color == board.turn]
    afters = {}
    for move in moves:
        after = board.copy(stack=False)
        after.push(move)
        afters[move] = after
    scores = {}
    features = {}
    ballots = {}
    for square, voter in voters:
        row = {}
        row_features = {}
        for move in moves:
            vector = move_features(board, afters[move], move, square, voter, positions)
            prior = personal_prior(board, afters[move], move, square, voter, positions)
            row_features[move] = vector
            row[move] = voter.predict(vector, prior)
        scores[voter.agent_id] = row
        features[voter.agent_id] = row_features
        if epsilon > 0 and rng.random() < epsilon:
            ballots[voter.agent_id] = rng.choice(moves)
        else:
            ballots[voter.agent_id] = max(moves, key=lambda move: (row[move], move.uci()))
    return moves, voters, scores, features, ballots


def choose_under_government(government, moves, voters, scores, ballots):
    """Constitutions constrain aggregation; they never alter legal chess moves."""
    raw_support = Counter(ballots.values())
    total_value = {
        move: sum(scores[voter.agent_id][move] for _, voter in voters)
        for move in moves
    }
    king = next((voter for _, voter in voters if voter.start_piece == chess.KING), None)
    
    if government == "dictatorship" and king is not None:
        selected = ballots[king.agent_id]
    elif government == "utilitarian":
        selected = max(moves, key=lambda move: (total_value[move], raw_support[move], move.uci()))
    elif government == "monarchy" and king is not None:
        support = {
            move: raw_support[move] + (4 if ballots[king.agent_id] == move else 0)
            for move in moves
        }
        selected = max(moves, key=lambda move: (support[move], total_value[move], move.uci()))
    elif government == "reputation":
        support = {
            move: sum(voter.vote_weight for _, voter in voters if ballots[voter.agent_id] == move)
            for move in moves
        }
        selected = max(moves, key=lambda move: (support[move], total_value[move], move.uci()))
    
    # NEW: Rule by the most accurate forecasters
    elif government == "technocracy":
        elite = sorted(voters, key=lambda v: v[1].trust, reverse=True)[:3]
        support = Counter({
            move: sum(1 for _, voter in elite if ballots[voter.agent_id] == move)
            for move in moves
        })
        selected = max(moves, key=lambda move: (support[move], total_value[move], move.uci()))
        
    # NEW: No consensus. The piece with the highest selfish urgency acts unilaterally.
    elif government == "anarchy":
        best_move = None
        highest_score = -float('inf')
        for _, voter in voters:
            for move in moves:
                if scores[voter.agent_id][move] > highest_score:
                    highest_score = scores[voter.agent_id][move]
                    best_move = move
        selected = best_move or moves[0]
        
    else: # democracy
        selected = max(moves, key=lambda move: (raw_support[move], total_value[move], move.uci()))
        
    return selected, raw_support


def random_opening(board, positions, rng, plies):
    for _ in range(plies):
        if board.is_game_over(claim_draw=True):
            return
        apply_move(board, positions, rng.choice(list(board.legal_moves)))


def final_rewards(board, positions, agents, winner, starting_material, draw_penalty):
    """Give the learner a reason to seek progress, not safe repetition.

    Survival is a reward only in decisive games. In a draw, every piece receives a
    small penalty and only material gained or lost since the opening can offset it.
    """
    rewards = {}
    living = set(positions.values())
    for agent_id, agent in agents.items():
        outcome = 0.0 if winner is None else (1.0 if winner == agent.color else -1.0)
        survival = 1.0 if agent_id in living else -1.0
        material_progress = material_balance(board, agent.color) - starting_material[agent.color]
        if winner is None:
            # An unchanged, peaceful loop is not a successful learning outcome.
            reward = -draw_penalty + 0.70 * agent.material * material_progress
        else:
            reward = (
                3.00 * agent.team_loyalty * outcome
                + 0.70 * agent.material * material_progress
                + 0.18 * agent.survival * survival
            )
        rewards[agent_id] = max(-3.5, min(3.5, reward))
    return rewards


def step_rewards(agents, moving_color, captured_piece, gave_check, repeated_position, args):
    """Immediate teaching signals so a draw ten moves later is not the only feedback."""
    captured_value = 0.0 if captured_piece is None else PIECE_VALUES[captured_piece.piece_type] / 9.0
    rewards = {}
    for agent_id, agent in agents.items():
        same_side = agent.color == moving_color
        capture_signal = args.capture_reward * captured_value * agent.material
        check_signal = args.check_reward * agent.activity if gave_check else 0.0
        if same_side:
            rewards[agent_id] = capture_signal + check_signal - args.move_cost
            if repeated_position:
                rewards[agent_id] -= args.repeat_penalty
        else:
            rewards[agent_id] = -capture_signal - check_signal
    return rewards


def learn_from_episode(steps, terminal_rewards, agents, learning_rate, discount, learn):
    """Assign voters the discounted consequences of decisions from that point onward."""
    returns = terminal_rewards.copy()
    errors = []
    for step in reversed(steps):
        for agent_id, reward in step["rewards"].items():
            returns[agent_id] = reward + discount * returns[agent_id]
        for experience in step["experiences"]:
            agent_id = experience["agent_id"]
            target = returns[agent_id]
            errors.append(abs(target - experience["prediction"]))
            if learn:
                agents[agent_id].learn(
                    experience["features"], experience["prediction"], target, learning_rate
                )
    return errors


def run_game(white_society, black_society, seed, args, learn, epsilon):
    """Run one game; training is optional so the same function is used for evaluation."""
    board = chess.Board()
    agents = {agent_id: agent for agent_id, agent in white_society.agents.items() if agent.color == chess.WHITE}
    agents.update({agent_id: agent for agent_id, agent in black_society.agents.items() if agent.color == chess.BLACK})
    positions = {square: agent_id for square, agent_id in white_society.starting_positions.items() if agents[agent_id].color == chess.WHITE}
    positions.update({square: agent_id for square, agent_id in black_society.starting_positions.items() if agents[agent_id].color == chess.BLACK})
    rng = random.Random(seed)
    random_opening(board, positions, rng, args.opening_plies)
    opening_fen = board.fen()
    starting_material = {
        chess.WHITE: material_balance(board, chess.WHITE),
        chess.BLACK: material_balance(board, chess.BLACK),
    }
    steps = []
    constitutional_regrets = []
    plies = 0
    
    class_activity = Counter()
    game_discontent_log = []
    
    # === 1. INITIALIZE STATE VISITATION TRACKER HERE ===
    state_history = defaultdict(int)

    while not board.is_game_over(claim_draw=True) and plies < args.max_plies:
        society = white_society if board.turn == chess.WHITE else black_society
        moves, voters, scores, features, ballots = collect_opinions(board, agents, positions, rng, epsilon)
        selected, raw_support = choose_under_government(
            society.government, moves, voters, scores, ballots
        )
        moving_color = board.turn
        captured_piece = board.piece_at(selected.to_square)
        if board.is_en_passant(selected):
            captured_piece = chess.Piece(chess.PAWN, not board.turn)
            
        moving_piece = board.piece_at(selected.from_square)
        if moving_piece:
            class_activity[moving_piece.piece_type] += 1
            
        alienated_voters = sum(1 for square, voter in voters if raw_support[ballots[voter.agent_id]] == 1)
        step_discontent = alienated_voters / len(voters) if voters else 0
        
        # === 2. APPLY MOVE FIRST ===
        apply_move(board, positions, selected)
        
        # === 3. TRACK STATE & ADD REPETITION PENALTY TO DISCONTENT ===
        # Strip clock info so structurally identical board positions match
        fen_parts = board.fen().split()
        state_key = " ".join(fen_parts[:4])
        state_history[state_key] += 1
        visits = state_history[state_key]
        
        visitation_penalty = 0.0
        if visits >= 2:
            visitation_penalty = (visits - 1) * 0.25  # Scale penalty weight as needed
            
        # Add the repetition penalty directly into this step's discontent metric
        total_step_discontent = step_discontent + visitation_penalty
        game_discontent_log.append(total_step_discontent)
        # ==========================================================

        step_experiences = []
        for square, voter in voters:
            best_score = max(scores[voter.agent_id].values())
            constitutional_regrets.append(best_score - scores[voter.agent_id][selected])
            step_experiences.append({
                "agent_id": voter.agent_id,
                "features": features[voter.agent_id][selected],
                "prediction": scores[voter.agent_id][selected],
                "government": society.government,
                "supported_selected": ballots[voter.agent_id] == selected,
                "selected_support": raw_support[selected],
                "eligible_voters": len(voters),
            })
            
        steps.append({
            "experiences": step_experiences,
            "rewards": step_rewards(
                agents, moving_color, captured_piece, board.is_check(), board.is_repetition(2), args
            ),
        })
        plies += 1

    outcome = board.outcome(claim_draw=True)
    winner = outcome.winner if outcome else None
    result = "Draw / move limit" if outcome is None else ("Draw" if winner is None else color_name(winner))
    rewards = final_rewards(board, positions, agents, winner, starting_material, args.draw_penalty)
    prediction_errors = learn_from_episode(steps, rewards, agents, args.learning_rate, args.discount, learn)
    
    return {
        "seed": seed,
        "white_government": white_society.government,
        "black_government": black_society.government,
        "opening_fen": opening_fen,
        "plies": plies,
        "result": result,
        "termination": outcome.termination.name if outcome else "MOVE_LIMIT",
        "average_prediction_error": fmean(prediction_errors) if prediction_errors else 0.0,
        "average_constitutional_regret": fmean(constitutional_regrets) if constitutional_regrets else 0.0,
        "average_discontent": fmean(game_discontent_log) if game_discontent_log else 0.0,
    }

    outcome = board.outcome(claim_draw=True)
    winner = outcome.winner if outcome else None
    result = "Draw / move limit" if outcome is None else ("Draw" if winner is None else color_name(winner))
    rewards = final_rewards(board, positions, agents, winner, starting_material, args.draw_penalty)
    prediction_errors = learn_from_episode(
        steps, rewards, agents, args.learning_rate, args.discount, learn
    )
    return {
        "seed": seed,
        "white_government": white_society.government,
        "black_government": black_society.government,
        "opening_fen": opening_fen,
        "plies": plies,
        "result": result,
        "termination": outcome.termination.name if outcome else "MOVE_LIMIT",
        "average_prediction_error": fmean(prediction_errors) if prediction_errors else 0.0,
        "average_constitutional_regret": fmean(constitutional_regrets) if constitutional_regrets else 0.0,
    }


def epsilon_for(episode, args):
    if args.episodes <= 1:
        return args.epsilon_end
    progress = (episode - args.start_episode) / max(1, args.episodes - 1)
    progress = max(0.0, min(1.0, progress))
    return args.epsilon_start + (args.epsilon_end - args.epsilon_start) * progress


def aggregate(games):
    return {
        "games": len(games),
        "white_wins": sum(game["result"] == "White" for game in games),
        "black_wins": sum(game["result"] == "Black" for game in games),
        "draws": sum(game["result"] in ("Draw", "Draw / move limit") for game in games),
        "average_plies": round(fmean(game["plies"] for game in games), 2) if games else 0,
        "average_prediction_error": round(fmean(game["average_prediction_error"] for game in games), 4) if games else 0,
        "average_constitutional_regret": round(fmean(game["average_constitutional_regret"] for game in games), 4) if games else 0,
        # NEW: Log discontent
        "average_discontent": round(fmean(game["average_discontent"] for game in games), 4) if games else 0,
    }


def evaluate_self_play(society, episode, args):
    games = []
    for offset in range(args.eval_games):
        seed = args.seed + 1_000_000 + episode * 100 + offset
        games.append(run_game(society, society, seed, args, learn=False, epsilon=0.0))
    return aggregate(games)


def cross_play(societies, args):
    records = []
    for white_name, black_name in product(societies, societies):
        for offset in range(args.cross_games):
            seed = args.seed + 2_000_000 + offset
            records.append(run_game(
                societies[white_name], societies[black_name], seed, args, learn=False, epsilon=0.0
            ))
    return records


def cross_summary(records):
    stats = defaultdict(lambda: {"games": 0, "wins": 0, "losses": 0, "draws": 0})
    for record in records:
        for color, government in (("White", record["white_government"]), ("Black", record["black_government"])):
            item = stats[government]
            item["games"] += 1
            if record["result"] in ("Draw", "Draw / move limit"):
                item["draws"] += 1
            elif record["result"] == color:
                item["wins"] += 1
            else:
                item["losses"] += 1
    return {
        government: {
            **item,
            "win_rate": round(item["wins"] / item["games"], 4) if item["games"] else 0,
        }
        for government, item in sorted(stats.items())
    }


def save_models(path, societies):
    payload = {
        government: {
            agent_id: {
                "weights": agent.weights,
                "trust": agent.trust,
            }
            for agent_id, agent in society.agents.items()
        }
        for government, society in societies.items()
    }
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def load_models(path, societies):
    with Path(path).open(encoding="utf-8") as file:
        payload = json.load(file)
    for government, agents in payload.items():
        if government not in societies:
            continue
        for agent_id, values in agents.items():
            if agent_id in societies[government].agents:
                agent = societies[government].agents[agent_id]
                agent.weights = values["weights"]
                agent.trust = values["trust"]


def output_paths(prefix):
    prefix = Path(prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    return {
        "progress": prefix.with_name(prefix.name + "-progress.csv"),
        "crossplay": prefix.with_name(prefix.name + "-crossplay.json"),
        "summary": prefix.with_name(prefix.name + "-summary.json"),
        "models": prefix.with_name(prefix.name + "-models.json"),
        "latest": prefix.parent / "LATEST_RUN.txt",
    }


def write_outputs(paths, progress, cross_records, summary, societies):
    with paths["progress"].open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(progress[0].keys()) if progress else [])
        if progress:
            writer.writeheader()
            writer.writerows(progress)
    with paths["crossplay"].open("w", encoding="utf-8") as file:
        json.dump(cross_records, file, indent=2)
    with paths["summary"].open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)
    save_models(paths["models"], societies)
    with paths["latest"].open("w", encoding="utf-8") as file:
        file.write("Latest Consensus Chess learning run\n\n")
        file.write(f"Summary: {paths['summary'].name}\n")
        file.write(f"Progress for Excel: {paths['progress'].name}\n")
        file.write(f"Cross-play games: {paths['crossplay'].name}\n")
        file.write(f"Saved models: {paths['models'].name}\n")


def parse_args():
    parser = argparse.ArgumentParser(description="Train and compare learned chess governments.")
    parser.add_argument("--governments", nargs="+", choices=GOVERNMENTS, default=list(GOVERNMENTS))
    parser.add_argument("--episodes", type=int, default=50, help="Self-play games per government.")
    parser.add_argument("--start-episode", type=int, default=1, help="Use 101 when continuing a 100-game run.")
    parser.add_argument("--resume", help="Path to an earlier -models.json file.")
    parser.add_argument("--eval-every", type=int, default=10, help="Evaluate frozen self-play after this many episodes.")
    parser.add_argument("--eval-games", type=int, default=3, help="Held-out games per government at each checkpoint.")
    parser.add_argument("--cross-games", type=int, default=2, help="Held-out games per ordered government pairing.")
    parser.add_argument("--opening-plies", type=int, default=2, help="Random legal opening moves for varied training states.")
    parser.add_argument("--max-plies", type=int, default=100, help="Draw a game after this many half-moves.")
    parser.add_argument("--learning-rate", type=float, default=0.035)
    parser.add_argument("--epsilon-start", type=float, default=0.25, help="Early probability of an exploratory ballot.")
    parser.add_argument("--epsilon-end", type=float, default=0.03, help="Late probability of an exploratory ballot.")
    parser.add_argument(
        "--draw-penalty", type=float, default=0.20,
        help="Negative reward applied to a draw before material progress is considered.",
    )
    parser.add_argument("--capture-reward", type=float, default=0.35)
    parser.add_argument("--check-reward", type=float, default=0.06)
    parser.add_argument("--repeat-penalty", type=float, default=0.25)
    parser.add_argument("--move-cost", type=float, default=0.005)
    parser.add_argument("--discount", type=float, default=0.98)
    parser.add_argument("--seed", type=int, default=20260910)
    parser.add_argument("--out", default="data/learning-governance")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.episodes < 1 or args.eval_every < 1 or args.eval_games < 1 or args.cross_games < 1:
        raise SystemExit("Episode and evaluation counts must be at least 1.")
    societies = {government: create_society(government, args.seed) for government in args.governments}
    if args.resume:
        load_models(args.resume, societies)
    progress = []
    for episode in range(args.start_episode, args.start_episode + args.episodes):
        epsilon = epsilon_for(episode, args)
        for government, society in societies.items():
            # Every society sees the same seed at the same episode, but lives with its own choices.
            game = run_game(society, society, args.seed + episode, args, learn=True, epsilon=epsilon)
            progress.append({
                "phase": "train",
                "episode": episode,
                "government": government,
                "epsilon": round(epsilon, 4),
                **aggregate([game]),
            })
        if episode % args.eval_every == 0 or episode == args.start_episode + args.episodes - 1:
            for government, society in societies.items():
                evaluation = evaluate_self_play(society, episode, args)
                progress.append({
                    "phase": "frozen_self_play",
                    "episode": episode,
                    "government": government,
                    "epsilon": 0.0,
                    **evaluation,
                })
            print(f"Checkpoint after episode {episode}: frozen evaluation recorded.")

    cross_records = cross_play(societies, args)
    summary = {
        "training": {
            "episodes_per_government": args.episodes,
            "first_episode": args.start_episode,
            "last_episode": args.start_episode + args.episodes - 1,
            "same_starting_models": True,
            "same_training_seed_per_episode": True,
            "learning": "Each piece updates its own feature-based action-value model from final game rewards.",
            "reputation": "Vote weights follow a moving average of prediction calibration, never chess material value.",
            "draw_penalty": args.draw_penalty,
            "reward_change": (
                "Draws have a negative reward; material is measured from the opening position; "
                "survival rewards apply only when a game has a winner; captures and checks provide "
                "immediate feedback; repeating a position is penalized immediately."
            ),
            "repeat_penalty": args.repeat_penalty,
        },
        "cross_play": cross_summary(cross_records),
        "reading_results": (
            "Use frozen_self_play rows in the progress CSV to see prediction error and constitutional "
            "regret change during training. Use cross_play only after learning is frozen to compare wins."
        ),
    }
    paths = output_paths(args.out)
    write_outputs(paths, progress, cross_records, summary, societies)
    print("\nTraining complete")
    print(json.dumps(summary, indent=2))
    print(f"\nProgress for Excel: {paths['progress']}")
    print(f"Cross-play games: {paths['crossplay']}")
    print(f"Summary: {paths['summary']}")
    print(f"Models to resume: {paths['models']}")


if __name__ == "__main__":
    main()
