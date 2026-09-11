"""Board state and simple move handling."""

from dataclasses import dataclass
from pieces import Piece, destinations


FILES = "ABCDE"


@dataclass(frozen=True)
class Move:
    origin: tuple
    destination: tuple

    def notation(self):
        return square_name(self.origin) + "-" + square_name(self.destination)


def square_name(square):
    row, col = square
    return f"{FILES[col]}{5 - row}"


class Board:
    def __init__(self):
        self.grid = [[None for _ in range(5)] for _ in range(5)]
        self.turn = "W"
        self.history = []
        self._setup()

    def _setup(self):
        # Compact 5x5 army: rook, knight, bishop, queen, king plus five pawns.
        for col, kind in enumerate("RNBQK"):
            self.grid[4][col] = Piece("W", kind)
            self.grid[0][col] = Piece("B", kind)
            self.grid[3][col] = Piece("W", "P")
            self.grid[1][col] = Piece("B", "P")

    def at(self, square):
        row, col = square
        return self.grid[row][col]

    def pieces(self, side):
        for row in range(5):
            for col in range(5):
                piece = self.grid[row][col]
                if piece is not None and piece.side == side:
                    yield (row, col), piece

    def legal_moves(self, side=None):
        side = side or self.turn
        return [Move(origin, target) for origin, piece in self.pieces(side)
                for target in destinations(self, origin, piece)]

    def clone(self):
        """Return an independent board state for a hypothetical continuation."""
        copy = Board.__new__(Board)
        copy.grid = [row[:] for row in self.grid]
        copy.turn = self.turn
        copy.history = self.history[:]
        return copy

    def state_key(self):
        """A compact, reproducible representation for the experiment log."""
        rows = []
        for row in self.grid:
            rows.append("".join(piece.symbol if piece else "." for piece in row))
        return "/".join(rows) + " " + self.turn

    def push(self, move):
        piece = self.at(move.origin)
        captured = self.at(move.destination)
        self.grid[move.destination[0]][move.destination[1]] = piece
        self.grid[move.origin[0]][move.origin[1]] = None
        # Pawns become queens on reaching the far rank.
        if piece.kind == "P" and move.destination[0] in (0, 4):
            self.grid[move.destination[0]][move.destination[1]] = Piece(piece.side, "Q")
        self.history.append((move, piece, captured))
        self.turn = "B" if self.turn == "W" else "W"

    def is_game_over(self):
        kings = [piece for _, piece in self.pieces("W") if piece.kind == "K"]
        kings += [piece for _, piece in self.pieces("B") if piece.kind == "K"]
        return len(kings) < 2 or not self.legal_moves()

    def result(self):
        white_king = any(p.kind == "K" for _, p in self.pieces("W"))
        black_king = any(p.kind == "K" for _, p in self.pieces("B"))
        if not white_king:
            return "Black wins by capturing the White King."
        if not black_king:
            return "White wins by capturing the Black King."
        return "Stalemate."

    def render(self):
        lines = ["    A  B  C  D  E"]
        for row in range(5):
            cells = " ".join((self.grid[row][col].symbol if self.grid[row][col] else ".") for col in range(5))
            lines.append(f" {5 - row}  {cells}  {5 - row}")
        lines.append("    A  B  C  D  E")
        return "\n".join(lines)
