import { DASH_CHART, DASH_STATUS_COLORS, DASH_TOOLTIP } from '../chartTheme';

describe('Admin Stats chartTheme', () => {
  it('uses soft dark-mode chart accents (not neon pure colors)', () => {
    expect(DASH_CHART.blue).toContain('dash-chart-blue');
    expect(DASH_CHART.grid).toContain('dash-chart-grid');
    expect(DASH_TOOLTIP.background).toContain('dash-tooltip-bg');
    expect(DASH_STATUS_COLORS.COMPLETED).toBe('#81c784');
    expect(DASH_STATUS_COLORS.CANCELLED).toBe('#ef5350');
    expect(DASH_STATUS_COLORS.IN_PROGRESS).toBe('#ffb74d');
  });
});
