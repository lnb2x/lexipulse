# Data integrity changes

## Validation

`npm run check` collects tracked-style tests under `tests/`; local experiments
under `scratch/` are not part of the correctness gate. No scratch files are deleted.
UI tests wait for the actual screen/card/database result rather than elapsed time.
`npm run test:performance` runs the existing timing budgets with one worker;
correctness assertions still run in the normal suite. Run performance budgets
on an idle machine and report failures separately from correctness failures.

## Concurrent content writes

Content updates read and write in one IndexedDB transaction. Quizlet normalization
only applies fields unchanged since its snapshot; later reviews, notes and edits
win. Deleted cards are not recreated and a rename cannot replace another term.
No schema upgrade or historical replay is required.

## Imported identifiers

An ID occupied by another term is replaced with a fresh ID. Both cards and the
original history survive. Reimporting merges by term without creating duplicates.
Quizlet set references remain attached to the incoming card. No schema change.
