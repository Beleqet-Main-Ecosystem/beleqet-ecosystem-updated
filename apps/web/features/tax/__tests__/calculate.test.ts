import { calculateTax } from '../calculate';

describe('calculateTax', () => {
  it('charges nothing up to 2,000', () => {
    expect(calculateTax(2000, false).tax).toBe(0);
  });

  it('taxes each band only on the part inside it', () => {
    // 2,000 at 15% + 1,000 at 20% = 300 + 200
    expect(calculateTax(5000, false).tax).toBeCloseTo(500);
  });

  // The published shortcut: income x top rate - deduction.
  it.each([
    [3000, 0.15, 300],
    [6000, 0.2, 500],
    [9000, 0.25, 850],
    [12000, 0.3, 1350],
    [20000, 0.35, 2050],
  ])('matches the official deduction table at %i ETB', (gross, rate, deduction) => {
    expect(calculateTax(gross, false).tax).toBeCloseTo(gross * rate - deduction);
  });

  it('takes 7% pension only when it is on', () => {
    expect(calculateTax(10000, true).pension).toBeCloseTo(700);
    expect(calculateTax(10000, false).pension).toBe(0);
  });

  it('reaches the top band for a high salary', () => {
    const result = calculateTax(25000, true);
    expect(result.top?.rate).toBe(0.35);
    expect(result.net).toBeCloseTo(25000 - result.tax - 1750);
  });

  it('handles an empty salary', () => {
    const result = calculateTax(0, true);
    expect(result).toMatchObject({ tax: 0, pension: 0, net: 0, top: null });
  });
});
