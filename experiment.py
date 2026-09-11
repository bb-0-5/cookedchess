"""Run reproducible Consensus Chess batches and save research-friendly logs.

This first experiment runner measures a *short-horizon counterfactual estimate*.
For each proposal, it forces that proposal and samples several stochastic parliamentary
continuations. A voter is scored by how close its favourite was to the best estimated
proposal at that decision. This is not a claim of ultimate chess truth.
"""

import argparse
import csv
import json
import random
from collections import defaultdict
from pathlib import Path
from statistics import fmean

from ai import choose_consensus_move, choose_stochastic_parliament_move
from board import Board, square_name
from pieces import VALUES


def side_name(side):
    return "White" if side == "W" else "Black"


def winner(board):
    white_king = any(piece.kind == "K" for _, piece in board.pieces("W"))
    black_king = any(piece.kind == "K" for _, piece in board.pieces("B"))
    if white_king and black_king:
        return None
    if white_king:
        return "W"
    if black_king:
        return "B"
    return None


def material_balance(board, focal_side):
    """Material from one side's viewpoint; a captured king dominates the score."""
    own = sum(VALUES[piece.kind] for _, piece in board.pieces(focal_side))
    other_side = "B" if focal_side == "W" else "W"
    enemy = sum(VALUES[piece.kind] for _, piece in board.pieces(other_side))
    return own - enemy


def rollout_value(board, forced_move, focal_side, seed, horizon):
    """Evaluate one proposal through one seeded stochastic parliamentary future."""
    sandbox = board.clone()
    sandbox.push(forced_move)
    rng = random.Random(seed)
    for _ in range(horizon):
        if sandbox.is_game_over():
            break
        move = choose_stochastic_parliament_move(sandbox, rng)
        if move is None:
            break
        sandbox.push(move)
    return material_balance(sandbox, focal_side)


def candidate_values(board, moves, focal_side, game_seed, ply, rollouts, horizon):
    """Estimate each candidate under the same test policy and a reproducible seed."""
    values = {}
    for move_index, move in enumerate(moves):
        samples = []
        for rollout_index in range(rollouts):
            rollout_seed = (
                game_seed * 10_000_000
                + ply * 100_000
                + move_index * 100
                + rollout_index
            )
            samples.append(rollout_value(board, move, focal_side, rollout_seed, horizon))
        values[move] = fmean(samples)
    return values


def random_opening(board, rng, opening_plies):
    for _ in range(opening_plies):
        if board.is_game_over():
            return
        moves = board.legal_moves()
        if not moves:
            return
        board.push(rng.choice(moves))


def run_game(game_number, seed, args):
    rng = random.Random(seed)
    board = Board()
    random_opening(board, rng, args.opening_plies)
    start_state = board.state_key()
    decisions = []

    for ply in range(args.max_plies):
        if board.is_game_over():
            break
        moves = board.legal_moves()
        choice = choose_consensus_move(board)
        if choice is None:
            break
        selected_move, vote = choice
        deciding_side = board.turn
        values = candidate_values(
            board, moves, deciding_side, seed, ply, args.rollouts, args.horizon
        )
        best_value = max(values.values())
        selected_value = values[selected_move]

        voters = []
        for square, piece in vote["voters"]:
            favourite = vote["ballots"][square]
            favourite_value = values[favourite]
            voters.append({
                "role": f"{piece.side}:{piece.kind}",
                "symbol": piece.symbol,
                "square": square_name(square),
                "favourite_move": favourite.notation(),
                "supports_selected": favourite == selected_move,
                "favourite_estimated_value": round(favourite_value, 4),
                "best_estimated_value": round(best_value, 4),
                "regret": round(best_value - favourite_value, 4),
            })

        decisions.append({
            "game": game_number,
            "seed": seed,
            "ply": ply + 1,
            "side": deciding_side,
            "state": board.state_key(),
            "legal_moves": [move.notation() for move in moves],
            "selected_move": selected_move.notation(),
            "selected_support": vote["totals"][selected_move],
            "eligible_voters": len(vote["voters"]),
            "candidate_estimated_values": {
                move.notation(): round(value, 4) for move, value in values.items()
            },
            "selected_estimated_value": round(selected_value, 4),
            "best_estimated_value": round(best_value, 4),
            "selected_regret": round(best_value - selected_value, 4),
            "voters": voters,
        })
        board.push(selected_move)

    game_winner = winner(board)
    result = side_name(game_winner) if game_winner else "Draw / move limit"
    ending_material = {"white": material_balance(board, "W"), "black": material_balance(board, "B")}
    for decision in decisions:
        decision["game_result"] = result
        decision["ending_material"] = ending_material
    return {
        "game": game_number,
        "seed": seed,
        "start_state": start_state,
        "plies": len(decisions),
        "result": result,
        "ending_material": ending_material,
    }, decisions


def build_summary(games, decisions, args):
    role_metrics = defaultdict(lambda: {"votes": 0, "regrets": [], "best": 0})
    for decision in decisions:
        for voter in decision["voters"]:
            metric = role_metrics[voter["role"]]
            metric["votes"] += 1
            metric["regrets"].append(voter["regret"])
            if voter["regret"] == 0:
                metric["best"] += 1

    return {
        "method": {
            "meaning_of_right": (
                "A voter is closer to right when its favourite has lower regret against "
                "the best estimated proposal in short stochastic parliamentary rollouts."
            ),
            "horizon_plies": args.horizon,
            "rollouts_per_candidate": args.rollouts,
            "important_limit": (
                "This is a short-horizon material estimate in a simplified 5x5 game, "
                "not an ultimate measure of chess truth or a learning system."
            ),
        },
        "games": len(games),
        "white_wins": sum(game["result"] == "White" for game in games),
        "black_wins": sum(game["result"] == "Black" for game in games),
        "draws_or_move_limits": sum(game["result"] == "Draw / move limit" for game in games),
        "decisions": len(decisions),
        "average_plies": round(fmean(game["plies"] for game in games), 2) if games else 0,
        "government": {
            "average_selected_regret": round(
                fmean(decision["selected_regret"] for decision in decisions), 4
            ) if decisions else 0,
            "selected_best_estimate_rate": round(
                sum(decision["selected_regret"] == 0 for decision in decisions) / len(decisions), 4
            ) if decisions else 0,
        },
        "voter_roles": {
            role: {
                "votes": metric["votes"],
                "average_regret": round(fmean(metric["regrets"]), 4),
                "best_estimate_rate": round(metric["best"] / metric["votes"], 4),
            }
            for role, metric in sorted(role_metrics.items())
        },
    }


def write_outputs(prefix, games, decisions, summary):
    prefix = Path(prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    decisions_path = prefix.with_name(prefix.name + "-decisions.jsonl")
    votes_path = prefix.with_name(prefix.name + "-votes.csv")
    summary_path = prefix.with_name(prefix.name + "-summary.json")

    with decisions_path.open("w", encoding="utf-8") as file:
        for decision in decisions:
            file.write(json.dumps(decision) + "\n")
    with votes_path.open("w", newline="", encoding="utf-8") as file:
        fields = [
            "game", "seed", "ply", "side", "voter_role", "voter_square", "favourite_move",
            "supports_selected", "favourite_estimated_value", "best_estimated_value", "regret",
            "selected_move", "selected_support", "eligible_voters", "game_result",
        ]
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for decision in decisions:
            for voter in decision["voters"]:
                writer.writerow({
                    "game": decision["game"], "seed": decision["seed"], "ply": decision["ply"],
                    "side": decision["side"], "voter_role": voter["role"],
                    "voter_square": voter["square"], "favourite_move": voter["favourite_move"],
                    "supports_selected": voter["supports_selected"],
                    "favourite_estimated_value": voter["favourite_estimated_value"],
                    "best_estimated_value": voter["best_estimated_value"], "regret": voter["regret"],
                    "selected_move": decision["selected_move"],
                    "selected_support": decision["selected_support"],
                    "eligible_voters": decision["eligible_voters"], "game_result": decision["game_result"],
                })
    with summary_path.open("w", encoding="utf-8") as file:
        json.dump({"summary": summary, "games": games}, file, indent=2)
    return decisions_path, votes_path, summary_path


def parse_args():
    parser = argparse.ArgumentParser(description="Run logged Consensus Chess experiments.")
    parser.add_argument("--games", type=int, default=5, help="Number of automatic games.")
    parser.add_argument("--seed", type=int, default=20260910, help="Base seed for reproducibility.")
    parser.add_argument("--opening-plies", type=int, default=2, help="Random legal moves before each game.")
    parser.add_argument("--max-plies", type=int, default=60, help="Game move limit before a draw.")
    parser.add_argument("--rollouts", type=int, default=3, help="Continuations sampled per candidate move.")
    parser.add_argument("--horizon", type=int, default=6, help="Moves ahead in each sampled continuation.")
    parser.add_argument("--out", default="data/experiment", help="Output prefix, without file extension.")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.games < 1 or args.rollouts < 1 or args.horizon < 1:
        raise SystemExit("--games, --rollouts, and --horizon must all be at least 1.")
    games = []
    decisions = []
    for game_number in range(1, args.games + 1):
        game, game_decisions = run_game(game_number, args.seed + game_number - 1, args)
        games.append(game)
        decisions.extend(game_decisions)
        print(f"Game {game_number}/{args.games}: {game['result']} after {game['plies']} decisions")
    summary = build_summary(games, decisions, args)
    decisions_path, votes_path, summary_path = write_outputs(args.out, games, decisions, summary)
    print("\nExperiment complete")
    print(json.dumps(summary, indent=2))
    print(f"\nDecision log: {decisions_path}")
    print(f"Votes for Excel: {votes_path}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
