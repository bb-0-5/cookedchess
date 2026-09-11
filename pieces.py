"""Piece definitions and movement generation for the 5x5 board."""

from dataclasses import dataclass


PIECE_SYMBOLS = {
    ("W", "K"): "K", ("W", "Q"): "Q", ("W", "R"): "R", ("W", "B"): "B",
    ("W", "N"): "N", ("W", "P"): "P", ("B", "K"): "k", ("B", "Q"): "q",
    ("B", "R"): "r", ("B", "B"): "b", ("B", "N"): "n", ("B", "P"): "p",
}
VALUES = {"K": 100, "Q": 9, "R": 5, "B": 3, "N": 3, "P": 1}


@dataclass(frozen=True)
class Piece:
    side: str  # W or B
    kind: str  # K, Q, R, B, N, P

    @property
    def symbol(self):
        return PIECE_SYMBOLS[(self.side, self.kind)]


def _inside(row, col):
    return 0 <= row < 5 and 0 <= col < 5


def destinations(board, origin, piece):
    """Return pseudo-legal destinations. Check rules are intentionally omitted."""
    row, col = origin
    moves = []

    def add(r, c):
        if _inside(r, c):
            target = board.at((r, c))
            if target is None or target.side != piece.side:
                moves.append((r, c))

    def slide(directions):
        for dr, dc in directions:
            r, c = row + dr, col + dc
            while _inside(r, c):
                target = board.at((r, c))
                if target is None:
                    moves.append((r, c))
                else:
                    if target.side != piece.side:
                        moves.append((r, c))
                    break
                r, c = r + dr, c + dc

    straight = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    diagonal = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    if piece.kind == "P":
        direction = -1 if piece.side == "W" else 1
        forward = (row + direction, col)
        if _inside(*forward) and board.at(forward) is None:
            moves.append(forward)
        for dc in (-1, 1):
            capture = (row + direction, col + dc)
            if _inside(*capture):
                target = board.at(capture)
                if target is not None and target.side != piece.side:
                    moves.append(capture)
    elif piece.kind == "N":
        for dr, dc in [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]:
            add(row + dr, col + dc)
    elif piece.kind == "K":
        for dr, dc in straight + diagonal:
            add(row + dr, col + dc)
    elif piece.kind == "R":
        slide(straight)
    elif piece.kind == "B":
        slide(diagonal)
    elif piece.kind == "Q":
        slide(straight + diagonal)
    return moves
