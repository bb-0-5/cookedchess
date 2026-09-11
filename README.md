# Consensus Chess

A terminal prototype of a compact 5×5 chess variant where every surviving piece is a parliamentarian: it votes on the side's next legal move, and the move with the most votes is played.

## Run it on Windows

1. Install Python from [python.org/downloads](https://www.python.org/downloads/windows/). During installation, tick **Add Python to PATH**.
2. Open PowerShell in this folder.
3. Check the install with `py --version`.
4. Start the game with `py main.py`.

No extra packages are needed. Press Enter each White turn to convene Parliament; Black plays automatically. Type `help`, `board`, or `quit` when White is prompted.

## Run an experiment

This automatically plays games and produces data. Start with a small run:

```powershell
python experiment.py --games 5 --opening-plies 2 --rollouts 3 --horizon 6 --out data/first-test
```

It creates three files:

- `data/first-test-votes.csv` — one row per voter, ready to open in Excel.
- `data/first-test-decisions.jsonl` — full proposal and vote records.
- `data/first-test-summary.json` — batch results and role-level metrics.

`regret` is the difference between the voter's favourite and the best proposal in short simulated continuations. Lower is better; zero means the voter picked an estimated-best proposal. This is deliberately not presented as permanent truth: it depends on the selected horizon, number of rollouts, and current simplified rules.

## Standard 8x8 governance experiment

The 5×5 prototype is useful for seeing politics. `governance_chess.py` is the separate 8×8 experiment where checkmate and draws are real standard-chess outcomes.

Install its one rule-engine dependency once:

```powershell
python -m pip install -r requirements.txt
```

Run one small match:

```powershell
python governance_chess.py --white democracy --black dictatorship --games 2 --seed 42 --out data/democracy-v-dictatorship
```

Run every government against every government (start with one game per pairing):

```powershell
python governance_chess.py --round-robin --games 1 --opening-plies 2 --seed 42 --out data/round-robin
```

Available governments are `democracy` (one piece, one vote), `monarchy` (the King gets four extra votes), `dictatorship` (the King selects the move), `utilitarian` (highest total declared utility), and `reputation` (votes are weighted by past accuracy).

In the reputation government, each piece starts with a normal vote. Its political vote weight then moves between 0.5 and 1.5 based on an exponentially-smoothed version of its normalized benchmark regret. This changes political influence only; a Queen never becomes less valuable *on the board* because it made bad forecasts.

## Learning under government constraints

`learning_governance_chess.py` is the actual learning experiment. All governments begin with the same blank action-value models and the same piece personalities. Each government then self-plays under its own constitution, so it learns only from the outcomes that constitution creates. At checkpoints, learning freezes for held-out self-play; after training, every learned government plays every other learned government on the same held-out seeds.

Start with a short run:

```powershell
python learning_governance_chess.py --episodes 10 --eval-every 5 --eval-games 2 --cross-games 1 --out data/learning-smoke
```

For a first real run, use:

```powershell
python learning_governance_chess.py --episodes 100 --eval-every 10 --eval-games 4 --cross-games 2 --opening-plies 2 --max-plies 100 --seed 42 --out data/learning-100
```

The important files are:

- `learning-100-progress.csv` — open in Excel. Filter `phase` to `frozen_self_play` to watch learning over time.
- `learning-100-crossplay.json` — games between frozen, trained governments.
- `learning-100-summary.json` — cross-government win/draw/loss summary.
- `learning-100-models.json` — saved learning state.

To continue the same societies for another 100 games, without wiping what they learned:

```powershell
python learning_governance_chess.py --episodes 100 --start-episode 101 --resume data/learning-100-models.json --eval-every 10 --eval-games 4 --cross-games 2 --opening-plies 2 --max-plies 100 --seed 42 --out data/learning-200
```

`average_prediction_error` shows whether pieces are becoming better at forecasting their own eventual rewards. `average_constitutional_regret` shows how much a government's selected move diverged from its citizens' learned preferred moves. Win/draw/loss remains a separate external outcome.

The learner treats an unchanged draw as a small negative outcome rather than paying every surviving piece for avoiding risk. Material is scored as change from the opening position. Start a **fresh** run after changing reward settings; do not resume models trained under an older reward system.

The learner also receives immediate feedback: captures and checks reward the moving side, while creating a repeated position carries an immediate penalty. This makes the source of a bad loop visible before the final draw ends the game.

After every learning run, open this one file to find the current results:

```powershell
notepad .\data\LATEST_RUN.txt
```

## Current prototype rules

- Board: 5×5, with the usual major pieces and five pawns per side.
- Standard piece movement is supported; pawns promote on the back rank.
- A king may be captured; check and checkmate are deliberately postponed for this first prototype.
- Each living piece selects a favourite legal move using simple preferences. The most-supported proposal wins; this is plurality voting, not strict majority rule.
- The experiment runner uses random legal opening moves and sampled parliamentary continuations to estimate short-horizon effects of proposals.

## Good next upgrades

- Let the human nominate a few candidate moves before voting.
- Add government modes: democracy, monarchy, dictatorship, and utilitarianism.
- Add special political roles such as the Spy, Usurper, Coward, and Chaos Agent.
- Add true check/checkmate validation and a graphical interface.
