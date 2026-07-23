# TODO - Salary module fixes

## Step 1 (git)

- Detect and resolve any merge conflicts with the target branch.

✅ Done: checked for conflict markers in `src/modules/salary` (none found). Git merge resolution may still be needed depending on branch state.

## Step 2 (salary.service.ts)

- Move `archivePreviousPredictions(dto)` to run **before** creating the new `salaryPrediction`.
- Add division-by-zero safeguard in `calculateSalaryGrowthRate`.

✅ Done.

## Step 3 (salary.processor.ts)

- Fix stagnant data by recalculating market values when updating stale predictions.
- Add division-by-zero safeguard in `computeGrowthRate`.

✅ Done.

## Step 4 (salary.controller.ts)

- Validate `limit` for `/history/...` endpoint so `take` never receives `NaN`.

✅ Done.

## Step 5 (verification)

- Run `npm run build` and relevant tests if available.

⚠️ Not fully verifiable via `tsc` because frontend TS deps are missing (react-hook-form/react-i18next) and not part of this backend fix.
