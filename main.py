"""Consensus Chess: a tiny 5x5 chess experiment run from the terminal."""

from ai import choose_consensus_move, describe_vote
from board import Board


def print_help():
    print("Commands: Enter = let White Parliament play | board | help | quit")


def main():
    board = Board()
    print("\n=== CONSENSUS CHESS ===")
    print("White and Black pieces vote on moves. The most-supported proposal wins.\n")
    print_help()

    while not board.is_game_over():
        print("\n" + board.render())
        side_name = "White" if board.turn == "W" else "Black"

        # Black is automatic; White pauses so the player can watch or quit.
        if board.turn == "W":
            command = input("\nWhite Parliament awaits your command: ").strip().lower()
            if command in {"quit", "q", "exit"}:
                print("The session of Parliament is adjourned.")
                return
            if command == "help":
                print_help()
                continue
            if command == "board":
                continue

        choice = choose_consensus_move(board)
        if choice is None:
            print(f"{side_name} has no legal moves.")
            break
        move, vote = choice
        print("\n" + describe_vote(board, move, vote))
        board.push(move)

    print("\n" + board.render())
    print("\nGAME OVER: " + board.result())


if __name__ == "__main__":
    main()
