import { Activity, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import type { AiMatchingMetrics } from "./types";

interface SummaryCardsProps {
  readonly metrics: AiMatchingMetrics;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  unit,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  readonly color: string;
  readonly unit?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase text-muted">{label}</p>
          <p className="text-xl font-black text-ink">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SummaryCards({ metrics }: SummaryCardsProps) {
  const fallbackColor = metrics.fallbackRate > 10 ? "#dc2626" : "#d97706";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Matches"
        value={metrics.totalMatches.toLocaleString()}
        icon={Activity}
        color="#3b82f6"
      />
      <StatCard
        label="Pipeline Success Rate"
        value={`${metrics.successRate}%`}
        icon={CheckCircle}
        color="#16a34a"
      />
      <StatCard
        label="LLM Fallback Rate"
        value={`${metrics.fallbackRate}%`}
        icon={AlertTriangle}
        color={fallbackColor}
      />
      <StatCard
        label="Avg Total Latency"
        value={metrics.averageLatencyMs.toLocaleString()}
        unit="ms"
        icon={Clock}
        color="#8b5cf6"
      />
    </div>
  );
}
