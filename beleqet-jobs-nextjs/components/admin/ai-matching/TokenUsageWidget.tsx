import { useMemo } from "react";
import type { TokenUsage } from "./types";

interface TokenUsageWidgetProps {
  readonly tokenUsage: TokenUsage;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

export default function TokenUsageWidget({ tokenUsage }: TokenUsageWidgetProps) {
  const maxDaily = useMemo(
    () => Math.max(...tokenUsage.dailyHistory.map((d) => d.totalTokens), 1),
    [tokenUsage.dailyHistory],
  );

  const allTimeEfficiency = tokenUsage.total.matchCount > 0
    ? Math.round(tokenUsage.total.totalTokens / tokenUsage.total.matchCount)
    : 0;

  const recentHistory = tokenUsage.dailyHistory.slice(-7);
  const recentMatches = recentHistory.reduce((s, d) => s + d.matchCount, 0);
  const recentTokens = recentHistory.reduce((s, d) => s + d.totalTokens, 0);
  const recentEfficiency = recentMatches > 0 ? Math.round(recentTokens / recentMatches) : 0;

  // Trend: compare last 7 days to the 7 days before that (days 8-14 ago)
  // If we don't have 14 days, fall back to comparing last 7 vs all-time
  const baselineHistory = tokenUsage.dailyHistory.length >= 14
    ? tokenUsage.dailyHistory.slice(-14, -7)
    : tokenUsage.dailyHistory;
  const baselineMatches = baselineHistory.reduce((s, d) => s + d.matchCount, 0);
  const baselineTokens = baselineHistory.reduce((s, d) => s + d.totalTokens, 0);
  const baselineEfficiency =
    baselineMatches > 0
      ? Math.round(baselineTokens / baselineMatches)
      : allTimeEfficiency; // fallback to all-time if no baseline data

  const trend =
    baselineEfficiency > 0
      ? Math.round(((recentEfficiency - baselineEfficiency) / baselineEfficiency) * 100)
      : 0;

  // Yesterday is the second-to-last element in dailyHistory (if exists)
  const yesterday = tokenUsage.dailyHistory.length >= 2
    ? tokenUsage.dailyHistory[tokenUsage.dailyHistory.length - 2]
    : { totalTokens: 0, estimatedCostUsd: 0, matchCount: 0 };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">
        Token Usage
      </h3>

      {/* Period breakdown */}
      <div className="space-y-2">
        <PeriodRow label="Today" detail={tokenUsage.today} />
        <PeriodRow label="Yesterday" detail={yesterday} />
        <PeriodRow label="This week" detail={tokenUsage.thisWeek} />
        <PeriodRow label="This month" detail={tokenUsage.thisMonth} />
        <PeriodRow label="This year" detail={tokenUsage.thisYear} />
        <PeriodRow label="All-time" detail={tokenUsage.total} />
      </div>

      {/* Daily bar chart */}
      {tokenUsage.dailyHistory.length > 0 && (
        <div className="mt-5">
          <span className="mb-2 block text-xs font-bold uppercase text-muted">
            Daily Usage (last 30 days)
          </span>
          <div className="flex items-end gap-[3px] h-20">
            {tokenUsage.dailyHistory.map((day) => {
              const pct = (day.totalTokens / maxDaily) * 100;
              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="w-full rounded-t-sm bg-blue-500 transition-all hover:bg-blue-600"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={`${day.date}: ${fmt(day.totalTokens)} tokens`}
                  />
                  <span className="mt-1 text-[8px] text-gray-400">
                    {dayLabel(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Efficiency */}
      {allTimeEfficiency > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-muted">
          <span className="font-medium">Avg tokens per match</span>
          <span className="font-bold text-ink">
            {fmt(allTimeEfficiency)}
            {trend !== 0 && (
              <span className={`ml-1 ${trend <= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend <= 0 ? "↓" : "↑"}{Math.abs(trend)}%
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function PeriodRow({
  label,
  detail,
}: {
  readonly label: string;
  readonly detail: { readonly totalTokens: number; readonly estimatedCostUsd: number; readonly matchCount: number };
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">
        {fmt(detail.totalTokens)} tokens
        {detail.estimatedCostUsd > 0 && (
          <span className="ml-1 text-muted">
            (${detail.estimatedCostUsd.toFixed(2)})
          </span>
        )}
        {detail.matchCount > 0 && (
          <span className="ml-1 text-muted">
            — {fmt(detail.matchCount)} match{detail.matchCount !== 1 ? "es" : ""}
          </span>
        )}
      </span>
    </div>
  );
}