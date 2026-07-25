import { describe, it, expect, vi } from "vitest";
import { CurrencyUtil } from "@/lib/currency";

type CountryCode = "ET" | "US";
type Currency = "ETB" | "USD";

const COUNTRY_CURRENCY: Record<CountryCode, Currency> = {
  ET: "ETB",
  US: "USD",
};

function parseGrossInput(grossInput: string): number | null {
  const parsed = grossInput.trim() === "" ? NaN : Number(grossInput);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function previewSmallestUnits(grossInput: string): number | null {
  const parsed = parseGrossInput(grossInput);
  if (parsed === null) {
    return null;
  }
  return CurrencyUtil.toSmallestUnit(parsed);
}

function buildCalculatePayload(
  grossInput: string,
  countryCode: CountryCode,
  currency: Currency,
) {
  const amount = parseGrossInput(grossInput);
  if (amount === null) {
    return null;
  }
  return {
    grossIncome: CurrencyUtil.toSmallestUnit(amount),
    currency,
    countryCode,
  };
}

describe("Tax calculator client utilities", () => {
  describe("country → currency mapping", () => {
    it("maps ET to ETB", () => {
      expect(COUNTRY_CURRENCY.ET).toBe("ETB");
    });

    it("maps US to USD", () => {
      expect(COUNTRY_CURRENCY.US).toBe("USD");
    });

    it("syncs currency when country changes", () => {
      let country: CountryCode = "ET";
      let currency: Currency = COUNTRY_CURRENCY[country];

      country = "US";
      currency = COUNTRY_CURRENCY[country];
      expect(currency).toBe("USD");

      country = "ET";
      currency = COUNTRY_CURRENCY[country];
      expect(currency).toBe("ETB");
    });
  });

  describe("CurrencyUtil float ↔ smallest unit", () => {
    it("converts decimal ETB input to Santim", () => {
      expect(CurrencyUtil.toSmallestUnit(120_000)).toBe(12_000_000);
      expect(CurrencyUtil.toSmallestUnit(120_000.5)).toBe(12_000_050);
      expect(CurrencyUtil.toSmallestUnit(0.01)).toBe(1);
    });

    it("converts decimal USD input to cents", () => {
      expect(CurrencyUtil.toSmallestUnit(50_000)).toBe(5_000_000);
      expect(CurrencyUtil.toSmallestUnit(11_925.0)).toBe(1_192_500);
      expect(CurrencyUtil.toSmallestUnit(0.99)).toBe(99);
    });

    it("rounds floating-point edges via Math.round", () => {
      expect(CurrencyUtil.toSmallestUnit(1.004)).toBe(100);
      expect(CurrencyUtil.toSmallestUnit(1.006)).toBe(101);
      expect(CurrencyUtil.toSmallestUnit(10.999)).toBe(1_100);
    });

    it("round-trips decimal → smallest → decimal", () => {
      const samples = [0, 0.01, 1, 99.99, 7_200, 120_000.5, 1_000_000];

      for (const decimal of samples) {
        const smallest = CurrencyUtil.toSmallestUnit(decimal);
        expect(Number.isInteger(smallest)).toBe(true);
        expect(CurrencyUtil.toDecimal(smallest)).toBeCloseTo(
          Math.round(decimal * 100) / 100,
          2,
        );
      }
    });

    it("throws on invalid toSmallestUnit input", () => {
      expect(() => CurrencyUtil.toSmallestUnit(NaN)).toThrow(
        /must be a number/i,
      );
      expect(() => CurrencyUtil.toSmallestUnit("100" as unknown as number)).toThrow(
        /must be a number/i,
      );
    });

    it("throws on non-integer toDecimal input", () => {
      expect(() => CurrencyUtil.toDecimal(10.5)).toThrow(/integer/i);
      expect(() => CurrencyUtil.toDecimal(NaN)).toThrow(/integer/i);
    });
  });

  describe("tax preview input parsing", () => {
    it("returns null for empty or invalid input", () => {
      expect(previewSmallestUnits("")).toBeNull();
      expect(previewSmallestUnits("   ")).toBeNull();
      expect(previewSmallestUnits("abc")).toBeNull();
      expect(previewSmallestUnits("-100")).toBeNull();
    });

    it("previews zero income as 0 smallest units", () => {
      expect(previewSmallestUnits("0")).toBe(0);
      expect(previewSmallestUnits("0.00")).toBe(0);
    });

    it("previews ET annual income matching UI payload units", () => {
      expect(previewSmallestUnits("7200")).toBe(720_000);
      expect(previewSmallestUnits("120000")).toBe(12_000_000);
      expect(previewSmallestUnits("120000.00")).toBe(12_000_000);
    });

    it("previews US annual income matching UI payload units", () => {
      expect(previewSmallestUnits("11925")).toBe(1_192_500);
      expect(previewSmallestUnits("50000.50")).toBe(5_000_050);
    });
  });

  describe("calculate payload mapping", () => {
    it("builds ETB / ET payload from decimal input", () => {
      expect(buildCalculatePayload("120000", "ET", "ETB")).toEqual({
        grossIncome: 12_000_000,
        currency: "ETB",
        countryCode: "ET",
      });
    });

    it("builds USD / US payload from decimal input", () => {
      expect(buildCalculatePayload("50000", "US", "USD")).toEqual({
        grossIncome: 5_000_000,
        currency: "USD",
        countryCode: "US",
      });
    });

    it("returns null when input cannot be submitted", () => {
      expect(buildCalculatePayload("", "ET", "ETB")).toBeNull();
      expect(buildCalculatePayload("-1", "US", "USD")).toBeNull();
      expect(buildCalculatePayload("not-a-number", "ET", "ETB")).toBeNull();
    });
  });

  describe("CurrencyUtil.format UI display", () => {
    it("formats ETB Santim for en-US display", () => {
      const formatted = CurrencyUtil.format(12_000_000, "ETB", "en-US");
      expect(formatted).toContain("120,000.00");
      expect(formatted.toUpperCase()).toContain("ETB");
    });

    it("formats USD cents for en-US display", () => {
      const formatted = CurrencyUtil.format(5_000_000, "USD", "en-US");
      expect(formatted).toContain("50,000.00");
    });

    it("formats result rows consistently with API integer fields", () => {
      const apiResult = {
        grossIncome: 12_000_000,
        taxAmount: 2_454_000,
        netIncome: 9_546_000,
        currency: "ETB" as const,
        effectiveTaxRate: 0.2045,
      };

      expect(CurrencyUtil.format(apiResult.grossIncome, apiResult.currency)).toContain(
        "120,000.00",
      );
      expect(CurrencyUtil.format(apiResult.taxAmount, apiResult.currency)).toContain(
        "24,540.00",
      );
      expect(CurrencyUtil.format(apiResult.netIncome, apiResult.currency)).toContain(
        "95,460.00",
      );
      expect((apiResult.effectiveTaxRate * 100).toFixed(2)).toBe("20.45");
      expect(apiResult.grossIncome - apiResult.taxAmount).toBe(apiResult.netIncome);
    });

    it("defaults currency to ETB when omitted", () => {
      const formatted = CurrencyUtil.format(100);
      expect(formatted.toUpperCase()).toContain("ETB");
    });
  });

  describe("spy / isolation", () => {
    it("calls toSmallestUnit when building a preview", () => {
      const spy = vi.spyOn(CurrencyUtil, "toSmallestUnit");

      previewSmallestUnits("100.25");

      expect(spy).toHaveBeenCalledWith(100.25);
      expect(spy).toHaveReturnedWith(10_025);

      spy.mockRestore();
    });

    it("calls format when rendering monetary UI values", () => {
      const spy = vi.spyOn(CurrencyUtil, "format");

      CurrencyUtil.format(1_000, "USD", "en-US");

      expect(spy).toHaveBeenCalledWith(1_000, "USD", "en-US");
      spy.mockRestore();
    });
  });
});
