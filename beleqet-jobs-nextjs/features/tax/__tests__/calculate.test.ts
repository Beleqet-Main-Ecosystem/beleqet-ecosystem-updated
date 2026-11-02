import { calculateTax } from '../calculate';

describe('calculateTax', () => {
  it('charges nothing in the first band', () => {
    expect(calculateTax(600, false).tax).toBe(0);
  });

  it('taxes each band only on the part inside it', () => {
    // 1,050 at 10% + 350 at 15% = 105 + 52.5
    expect(calculateTax(2000, false).tax).toBeCloseTo(157.5);
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
