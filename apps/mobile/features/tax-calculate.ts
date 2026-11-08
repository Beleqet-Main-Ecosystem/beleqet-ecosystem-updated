/**
 * Monthly employment income tax bands (the 2025 schedule). A copy of the website's
 * features/tax/calculate.ts; keep the two the same.
 */
export const BANDS: readonly [from: number, to: number, rate: number][] = [
  [0, 2000, 0],
  [2000, 4000, 0.15],
  [4000, 7000, 0.2],
  [7000, 10000, 0.25],
  [10000, 14000, 0.3],
  [14000, Infinity, 0.35],
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
