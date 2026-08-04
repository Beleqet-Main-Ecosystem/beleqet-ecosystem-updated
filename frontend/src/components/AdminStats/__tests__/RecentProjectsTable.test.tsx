/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecentProjectsTable } from '@/components/AdminStats/RecentProjectsTable';
import type { ProjectBreakdownResponse } from '@/types';

function makeData(count: number): ProjectBreakdownResponse {
  return {
    generatedAt: new Date().toISOString(),
    currency: 'ETB',
    amountUnit: 'minor',
    range: { preset: '30d', from: '2026-07-01', to: '2026-08-01', tz: 'UTC' },
    statusSummary: [{ status: 'OPEN', count }],
    recentProjects: Array.from({ length: count }, (_, i) => ({
      id: `job-${i + 1}`,
      title: `Project ${i + 1}`,
      status: 'OPEN',
      ownerFirstName: 'Ada',
      budgetMin: 1000,
      budgetMax: 2000,
      currency: 'ETB',
      createdAt: '2026-08-01T00:00:00.000Z',
    })),
    employmentJobsSummary: [],
    contractsSummary: [],
  };
}

describe('RecentProjectsTable', () => {
  it('shows at most 8 rows and paginates to the rest', () => {
    const onExport = jest.fn();
    render(<RecentProjectsTable data={makeData(21)} onExport={onExport} />);

    expect(screen.getByText(/Showing 1–8 of 21/i)).toBeInTheDocument();
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 8')).toBeInTheDocument();
    expect(screen.queryByText('Project 9')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/Showing 9–16 of 21/i)).toBeInTheDocument();
    expect(screen.getByText('Project 9')).toBeInTheDocument();
    expect(screen.queryByText('Project 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/Showing 17–21 of 21/i)).toBeInTheDocument();
    expect(screen.getByText('Project 21')).toBeInTheDocument();
  });

  it('exports via spreadsheet control, not a trash icon', () => {
    const onExport = jest.fn();
    const { container } = render(<RecentProjectsTable data={makeData(3)} onExport={onExport} />);

    fireEvent.click(screen.getByRole('button', { name: /export recent projects csv/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lucide-trash-2')).toBeNull();
    expect(container.querySelector('.lucide-trash')).toBeNull();
  });
});
