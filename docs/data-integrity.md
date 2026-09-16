# Data integrity changes

## Validation

`npm run check` collects tracked-style tests under `tests/`; local experiments
under `scratch/` are not part of the correctness gate. No scratch files are deleted.
UI tests wait for the actual screen/card/database result rather than elapsed time.
`npm run test:performance` runs the existing timing budgets with one worker;
correctness assertions still run in the normal suite. Run performance budgets
on an idle machine and report failures separately from correctness failures.
