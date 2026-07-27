import {
  applyOrderIndices,
  reorderItems,
  sortByOrderIndex,
} from "@/portfolio/utils/reorder";
import {
  createEmptyPortfolio,
  switchTemplate,
  parsePortfolioData,
} from "@/portfolio/utils/portfolio-state";
import {
  emptyLocalized,
  readLocalized,
  setLocalized,
} from "@/portfolio/utils/localized";
import { INDUSTRY_TAXONOMY } from "@/portfolio/constants/industries";

describe("reorderItems", () => {
  it("moves an item from one index to another", () => {
    const items = ["a", "b", "c", "d"];
    expect(reorderItems(items, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("returns the same array for invalid indices", () => {
    const items = ["a", "b"];
    expect(reorderItems(items, -1, 0)).toEqual(items);
    expect(reorderItems(items, 0, 0)).toEqual(items);
  });
});

describe("applyOrderIndices", () => {
  it("assigns sequential orderIndex values", () => {
    const items = [
      { id: "1", orderIndex: 5 },
      { id: "2", orderIndex: 1 },
    ];
    expect(applyOrderIndices(items)).toEqual([
      { id: "1", orderIndex: 0 },
      { id: "2", orderIndex: 1 },
    ]);
  });
});

describe("sortByOrderIndex", () => {
  it("sorts ascending by orderIndex", () => {
    const items = [
      { id: "b", orderIndex: 2 },
      { id: "a", orderIndex: 0 },
    ];
    expect(sortByOrderIndex(items).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("switchTemplate", () => {
  it("changes templateId without mutating content fields", () => {
    const base = createEmptyPortfolio();
    base.profile.fullName = "Test User";
    base.summary = emptyLocalized("Summary");
    const next = switchTemplate(base, "creative");
    expect(next.templateId).toBe("creative");
    expect(next.profile.fullName).toBe("Test User");
    expect(next.summary.en).toBe("Summary");
  });
});

describe("parsePortfolioData", () => {
  it("accepts valid v1 payloads", () => {
    const data = createEmptyPortfolio();
    expect(parsePortfolioData(data)?.version).toBe(1);
  });

  it("rejects invalid payloads", () => {
    expect(parsePortfolioData(null)).toBeNull();
    expect(parsePortfolioData({ version: 2 })).toBeNull();
  });
});

describe("localized helpers", () => {
  it("reads locale with English fallback", () => {
    const text = { en: "Hello", am: "" };
    expect(readLocalized(text, "am")).toBe("Hello");
    expect(readLocalized(setLocalized(text, "am", "ሰላም"), "am")).toBe("ሰላም");
  });
});

describe("industry taxonomy", () => {
  it("includes expected industry tags", () => {
    expect(INDUSTRY_TAXONOMY).toContain("technology");
    expect(INDUSTRY_TAXONOMY).toContain("fresh_graduate");
  });
});

describe("createEmptyPortfolio", () => {
  it("provides default section order and modern template", () => {
    const data = createEmptyPortfolio();
    expect(data.templateId).toBe("modern");
    expect(data.sectionOrder.length).toBeGreaterThan(5);
    expect(data.version).toBe(1);
  });
});
