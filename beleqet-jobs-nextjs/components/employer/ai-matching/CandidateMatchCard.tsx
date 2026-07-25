import { useState } from "react";
import type { RankedCandidate } from "./types";

interface CandidateMatchCardProps {
  readonly candidate: RankedCandidate;
}

const DECISION_COLORS: Record<string, string> = {
  STRONG_MATCH: "bg-green-100 text-green-800",
  POTENTIAL_MATCH: "bg-amber-100 text-amber-800",
  WEAK_MATCH: "bg-orange-100 text-orange-800",
  NOT_A_MATCH: "bg-red-100 text-red-800",
};

function Tag({ label, variant }: { label: string; variant: "match" | "gap" }) {
  const base = "inline-block rounded-full px-3 py-0.5 text-xs font-medium";
  const color =
    variant === "match"
      ? "bg-green-50 text-green-700"
      : "bg-red-50 text-red-700";
  return <span className={`${base} ${color}`}>{label}</span>;
}

const PREVIEW_LIMIT = 200;

export default function CandidateMatchCard({
  candidate,
}: CandidateMatchCardProps) {
  const scorePct = Math.round(candidate.score * 100);
  const decisionColor = DECISION_COLORS[candidate.decision] ?? "bg-gray-100 text-gray-700";
  const [expanded, setExpanded] = useState(false);
  const isLong = candidate.reasoningSnippet.length > PREVIEW_LIMIT;
  const displayed = expanded || !isLong
    ? candidate.reasoningSnippet
    : candidate.reasoningSnippet.slice(0, PREVIEW_LIMIT) + "…";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
            #{candidate.rank}
          </span>
          <span className="font-medium text-gray-900">
            {candidate.freelancerName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900">{scorePct}%</span>
          <span
            className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${decisionColor}`}
          >
            {candidate.decision.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Assessment */}
      <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-gray-700">
        <span className="block text-xs font-semibold uppercase tracking-wide text-blue-600">
          Assessment
        </span>
        <p className="mt-1 whitespace-pre-wrap">{displayed}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Skills Breakdown */}
      <div className="space-y-2">
        {candidate.matchedSkills.length > 0 && (
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Matched Skills
            </span>
            <div className="flex flex-wrap gap-1.5">
              {candidate.matchedSkills.map((s) => (
                <Tag key={s} label={s} variant="match" />
              ))}
            </div>
          </div>
        )}
        {candidate.skillGaps.length > 0 && (
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Skill Gaps
            </span>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skillGaps.map((s) => (
                <Tag key={s} label={s} variant="gap" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
