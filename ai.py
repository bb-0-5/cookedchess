"""The Parliament: every surviving piece gets one vote on a candidate move."""

from collections import Counter
from pieces import VALUES


def preference_score(board, move, voter_square, voter):
    """How much one voter likes one proposal in the current toy model."""
    mover = board.at(move.origin)
    target = board.at(move.destination)
    score = 0
    # Everyone likes taking valuable enemy pieces, but military pieces differ in zeal.
    if target:
        score += VALUES[target.kind] * (2 if voter.kind in "QRBN" else 1)
    # The moving piece is biased toward moves that give it agency.
    if voter_square == move.origin:
        score += 4
    # Pawns are expansionists; kings prefer safety and distance from the action.
    advance = (move.origin[0] - move.destination[0]) if mover.side == "W" else (move.destination[0] - move.origin[0])
    if voter.kind == "P":
        score += advance * 2
    if voter.kind == "K":
        score += 1 if target is None else -2
    # Central squares are presented as strategic by the royal press.
    destination_row, destination_col = move.destination
    if destination_row in (2,) or destination_col in (2,):
        score += 1
    return score


def conduct_vote(board, moves=None):
    """Collect first-preference ballots without choosing a winning proposal."""
    moves = moves or board.legal_moves()
    voters = list(board.pieces(board.turn))
    ballots = {}
    for square, voter in voters:
        ballots[square] = max(
            moves,
            key=lambda move: (preference_score(board, move, square, voter), move.notation()),
        )
    return {"voters": voters, "ballots": ballots, "totals": Counter(ballots.values())}


def choose_consensus_move(board):
    moves = board.legal_moves()
    if not moves:
        return None
    vote = conduct_vote(board, moves)
    # This is plurality voting, not a strict majority system. Ties go to total enthusiasm.
    winner = max(
        moves,
        key=lambda move: (
            vote["totals"][move],
            sum(preference_score(board, move, s, p) for s, p in vote["voters"]),
            move.notation(),
        ),
    )
    return winner, vote


def choose_stochastic_parliament_move(board, rng):
    """Choose a move probabilistically by support for use in test continuations."""
    moves = board.legal_moves()
    if not moves:
        return None
    vote = conduct_vote(board, moves)
    weights = [vote["totals"][move] + 1 for move in moves]
    return rng.choices(moves, weights=weights, k=1)[0]


def describe_vote(board, move, vote):
    mover = board.at(move.origin)
    captured = board.at(move.destination)
    supporters = [piece.symbol + "@" + _square(square) for square, piece in board.pieces(board.turn)
                  if vote["ballots"].get(square) == move]
    capture = f", capturing {captured.symbol}" if captured else ""
    return (f"BREAKING NEWS — {('White' if board.turn == 'W' else 'Black')} Parliament selects "
            f"{mover.symbol} {move.notation()}{capture} with "
            f"{vote['totals'][move]} of {len(vote['ballots'])} first-preference votes.\n"
            f"Supporters: {', '.join(supporters)}")


def _square(square):
    from board import square_name
    return square_name(square)
