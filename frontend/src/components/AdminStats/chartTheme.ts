/** Dark-mode chart colors for Admin Stats only (CSS vars remapped under .admin-stats-dashboard). */
export const DASH_CHART = {
  grid: 'var(--dash-chart-grid)',
  tick: 'var(--dash-text-2)',
  blue: 'var(--dash-chart-blue)',
  orange: 'var(--dash-chart-orange)',
  green: 'var(--dash-chart-green)',
  cyan: 'var(--dash-chart-cyan)',
  danger: 'var(--dash-danger)',
  muted: 'var(--dash-text-3)',
} as const;

export const DASH_TOOLTIP = {
  background: 'var(--dash-tooltip-bg)',
  border: '1px solid var(--dash-border)',
  borderRadius: 10,
  fontSize: 13,
  color: 'var(--dash-text)',
} as const;

/** Soft status palette that stays readable on dark card surfaces. */
export const DASH_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9e9e9e',
  FUNDED: '#4fc3f7',
  OPEN: '#64b5f6',
  IN_PROGRESS: '#ffb74d',
  COMPLETED: '#81c784',
  CANCELLED: '#ef5350',
};

export const DASH_ROLE_COLORS = ['#64b5f6', '#81c784', '#ffb74d', '#4fc3f7', '#ef5350'];
export const DASH_ESCROW_COLORS = ['#81c784', '#64b5f6', '#ffb74d', '#ef5350'];
