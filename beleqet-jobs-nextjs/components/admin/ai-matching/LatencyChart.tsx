import type { LatencyBreakdown } from "./types";

interface LatencyChartProps {
  readonly latency: LatencyBreakdown;
}

interface BarProps {
  readonly label: string;
  readonly valueMs: number;
  readonly maxMs: number;
  readonly color: string;
}

function Bar({ label, valueMs, maxMs, color }: BarProps) {
  const pct = maxMs > 0 ? (valueMs / maxMs) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-right text-xs font-bold uppercase text-muted">{label}</span>
      <div className="flex-1">
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span className="w-16 text-right text-sm font-black text-ink">
        {valueMs}ms
      </span>
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  embedding: "#3b82f6",
  vectorSearch: "#10b981",
  llmEvaluation: "#8b5cf6",
};

export default function LatencyChart({ latency }: LatencyChartProps) {
  const maxMs = Math.max(
    latency.embeddingMs,
    latency.vectorSearchMs,
    latency.llmEvaluationMs,
    1,
  );

  // If all are zero, show a placeholder
  const isEmpty =
    latency.embeddingMs === 0 &&
    latency.vectorSearchMs === 0 &&
    latency.llmEvaluationMs === 0;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">
        Pipeline Latency Breakdown
      </h3>
      {isEmpty ? (
        <p className="text-center text-sm text-gray-500">
          No latency data yet
        </p>
      ) : (
        <div className="space-y-3">
          <Bar
            label="Embedding"
            valueMs={latency.embeddingMs}
            maxMs={maxMs}
            color={STAGE_COLORS.embedding}
          />
          <Bar
            label="Vector Search"
            valueMs={latency.vectorSearchMs}
            maxMs={maxMs}
            color={STAGE_COLORS.vectorSearch}
          />
          <Bar
            label="LLM Evaluation"
            valueMs={latency.llmEvaluationMs}
            maxMs={maxMs}
            color={STAGE_COLORS.llmEvaluation}
          />
        </div>
      )}
    </div>
  );
}