interface ScoreRingProps {
  score: number; // 0-100
  size?: number; // px
}

/**
 * Circular score gauge. Color band communicates match quality at a glance:
 * emerald (strong), amber (worth a look), slate (weak) — deliberately not
 * red, since a low-scoring freelancer isn't an "error," just a lower fit.
 */
export function ScoreRing({ score, size = 56 }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const band = clamped >= 75 ? 'strong' : clamped >= 50 ? 'moderate' : 'weak';
  const stroke = { strong: '#059669', moderate: '#d97706', weak: '#64748b' }[band];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-slate-800">{clamped}</span>
      </div>
    </div>
  );
}

interface SubScoreBarProps {
  label: string;
  score: number;
}

/** Thin horizontal bar for a single sub-score row (skill / location / experience). */
export function SubScoreBar({ label, score }: SubScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-400" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{clamped}</span>
    </div>
  );
}