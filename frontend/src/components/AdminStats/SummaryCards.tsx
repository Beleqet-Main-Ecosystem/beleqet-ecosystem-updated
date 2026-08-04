'use client';

import type { StatCardData } from '@/types';

interface SummaryCardsProps {
  cards: StatCardData[];
}

/**
 * Top-row KPI cards — one metric each, scannable at a glance.
 */
export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="stats-grid stats-grid-six">
      {cards.map((card) => (
        <article key={card.label} className="stat-card surface-card">
          <div className="stat-card-top">
            <div
              className="stat-card-icon"
              style={{
                background: card.color,
                color: card.iconColor ?? 'var(--text-primary)',
              }}
            >
              {card.icon}
            </div>
            {card.delta && (
              <span className={`stat-delta stat-delta-${card.delta.tone}`}>{card.delta.text}</span>
            )}
          </div>
          <div className="stat-card-label">{card.label}</div>
          <div className="stat-card-value">{card.value}</div>
          {card.hint && <div className="stat-card-hint">{card.hint}</div>}
        </article>
      ))}
    </div>
  );
}
