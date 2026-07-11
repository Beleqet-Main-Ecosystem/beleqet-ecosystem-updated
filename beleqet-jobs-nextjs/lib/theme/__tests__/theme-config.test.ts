import { THEME_OPTIONS, resolveThemeLabel } from "../theme-config";

describe("THEME_OPTIONS", () => {
  it("has exactly 3 options", () => {
    expect(THEME_OPTIONS).toHaveLength(3);
  });

  it("includes light, dark and system values", () => {
    const values = THEME_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["light", "dark", "system"]);
  });

  it("each option has a labelKey, value and icon", () => {
    for (const opt of THEME_OPTIONS) {
      expect(opt.labelKey).toBeTruthy();
      expect(opt.value).toBeTruthy();
      expect(opt.icon).toBeDefined();
    }
  });
});

describe("resolveThemeLabel()", () => {
  it("returns 'Light' for theme.light", () => {
    expect(resolveThemeLabel("theme.light")).toBe("Light");
  });

  it("returns 'Dark' for theme.dark", () => {
    expect(resolveThemeLabel("theme.dark")).toBe("Dark");
  });

  it("returns 'System' for theme.system", () => {
    expect(resolveThemeLabel("theme.system")).toBe("System");
  });

  it("returns 'Select theme' for theme.select", () => {
    expect(resolveThemeLabel("theme.select")).toBe("Select theme");
  });

  it("falls back to the last segment for unknown keys", () => {
    expect(resolveThemeLabel("custom.fallback")).toBe("fallback");
  });

  it("returns the raw key when splitting produces nothing", () => {
    expect(resolveThemeLabel("")).toBe("");
  });
});
