import { AlertCircle, PlusCircle, User, FileText, Wrench, Link } from "lucide-react";
import type { ProfileInsights } from "./types";

interface ActionableInsightsProps {
  readonly insights: ProfileInsights;
}

function completenessColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function ActionableInsights({
  insights,
}: ActionableInsightsProps) {
  return (
    <div className="space-y-6">
      {/* Profile Completeness */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Profile Completeness
        </h3>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${completenessColor(insights.profileCompleteness)}`}
                style={{ width: `${insights.profileCompleteness}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-bold text-gray-700">
            {insights.profileCompleteness}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400" />
            Headline
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            Bio
          </span>
          <span className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-gray-400" />
            3+ Skills
          </span>
          <span className="flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5 text-gray-400" />
            Links
          </span>
        </div>
      </div>

      {/* Suggested Improvements */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <AlertCircle className="h-4 w-4" />
          Suggested Improvements
        </h3>
        <ul className="space-y-2">
          {insights.suggestedImprovements.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trending Skills in Market */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <PlusCircle className="h-4 w-4" />
          Trending Skills in Market
        </h3>
        <p className="mb-3 text-xs text-gray-400">
          These skills are highly searched by employers. Consider adding them to
          your profile.
        </p>
        <div className="flex flex-wrap gap-2">
          {insights.trendingSkillsInMarket.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              <PlusCircle className="h-3 w-3" />
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
