/**
 * Monthly employment income tax bands, matching the tax-calculator module.
 * This is the pre-2025 schedule. Replace it once the current bands are confirmed
 * (docs/redesign-issues.md, C9); the page tells people to check until then.
 */
export const BANDS: readonly [from: number, to: number, rate: number][] = [
  [0, 600, 0],
  [600, 1650, 0.1],
  [1650, 3200, 0.15],
  [3200, 5250, 0.2],
  [5250, 7800, 0.25],
  [7800, 10900, 0.3],
  [10900, Infinity, 0.35],
];

export const EMPLOYEE_PENSION = 0.07;
export const EMPLOYER_PENSION = 0.11;

export function calculateTax(gross: number, withPension: boolean) {
  const rows = BANDS.map(([from, to, rate]) => {
    const slice = Math.max(0, Math.min(gross, to) - from);
    return { from, to, rate, slice, tax: slice * rate };
  });
  const tax = rows.reduce((sum, row) => sum + row.tax, 0);
  const pension = withPension ? gross * EMPLOYEE_PENSION : 0;
  const top = rows.filter((row) => row.slice > 0).pop() ?? null;
  return { rows, tax, pension, net: gross - tax - pension, top };
}
