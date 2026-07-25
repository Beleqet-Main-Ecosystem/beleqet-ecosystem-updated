import Link from "next/link";
import { FileText, Wrench, Link as LinkIcon } from "lucide-react";

interface OptimizationScoreWidgetProps {
  readonly score: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const NAV_ITEMS = [
  { href: "/profile#about", label: "Headline & Bio", icon: FileText },
  { href: "/profile#skills", label: "Skills", icon: Wrench },
  { href: "/profile#links", label: "Portfolio Links", icon: LinkIcon },
] as const;

export default function OptimizationScoreWidget({
  score,
}: OptimizationScoreWidgetProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const color = scoreRingColor(clamped);
  const textColor = scoreColor(clamped);

  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Optimization Score
      </h3>

      <div className="relative flex items-center justify-center">
        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute text-3xl font-bold ${textColor}`}>
          {clamped}
        </span>
      </div>

      <p className="mt-4 text-center text-sm text-gray-500">
        {clamped >= 80
          ? "Your profile is highly visible to employers."
          : clamped >= 50
            ? "Your profile has good visibility — some improvements recommended."
            : "Your profile needs optimization for better visibility to employers."}
      </p>

      <div className="mt-5 w-full space-y-2 border-t border-gray-100 pt-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-brandGreen"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
