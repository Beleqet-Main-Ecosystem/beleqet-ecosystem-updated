"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";

/** Props accepted by the `StarRating` component. */
export interface StarRatingProps {
  /** Current rating value (1–5). Fractional values render partial fills in readonly mode. */
  value: number;
  /** Total number of stars to display. Defaults to `5`. */
  max?: number;
  /** Called with the new integer rating when the user clicks or keyboards a star. */
  onChange?: (rating: number) => void;
  /** When `true` the widget is display-only. Inferred from `onChange` if omitted. */
  readonly?: boolean;
  /** Visual size of each star icon. */
  size?: "sm" | "md" | "lg";
  /** Accessible label for the group element. */
  label?: string;
  /** Additional CSS classes applied to the wrapper element. */
  className?: string;
}

const SIZE_MAP: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

/**
 * Accessible star-rating widget with interactive and readonly modes.
 *
 * **Interactive mode** (when `onChange` is provided):
 * - Rendered as a `radiogroup` with each star as a `radio` button.
 * - Keyboard: Arrow keys change the value; Tab moves focus in/out.
 * - Hover highlights the candidate rating before selection.
 *
 * **Readonly mode** (when `onChange` is omitted or `readonly` is `true`):
 * - Rendered as a single `img` role element.
 * - Supports fractional values with partial star fills.
 *
 * WCAG AA: filled stars use `#d8ff3e` on a dark background; unfilled stars
 * use `var(--color-border)` which maintains sufficient contrast in both themes.
 *
 * @param props - See `StarRatingProps`.
 *
 * @example
 * // Interactive
 * <StarRating value={rating} onChange={setRating} size="lg" />
 *
 * @example
 * // Readonly with fractional value
 * <StarRating value={4.5} readonly size="sm" />
 */
export default function StarRating({
  value,
  max = 5,
  onChange,
  readonly = !onChange,
  size = "md",
  label = "Star rating",
  className = "",
}: StarRatingProps) {
  const id = useId();
  const [hovered, setHovered] = useState<number>(0);
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const iconClass = SIZE_MAP[size];

  // Interactive mode — radiogroup
  if (!readonly && onChange) {
    const active = hovered || value;
    return (
      <div role="radiogroup" aria-label={label} className={`inline-flex items-center gap-0.5 ${className}`}>
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            id={`${id}-star-${star}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(star + 1, max)); }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(star - 1, 1)); }
            }}
            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen transition-transform duration-100 active:scale-90 cursor-pointer"
          >
            <Star
              className={`${iconClass} transition-colors duration-100 ${star <= active ? "fill-[#d8ff3e] text-[#b8c800]" : "fill-transparent text-[var(--color-border)]"}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    );
  }

  // Readonly mode — single img role with partial-fill support
  return (
    <div role="img" aria-label={`${value.toFixed(1)} out of ${max} stars`} className={`inline-flex items-center gap-0.5 ${className}`}>
      {stars.map((star) => {
        const filled = value >= star;
        const partial = !filled && value > star - 1;
        const fillPct = partial ? Math.round((value - (star - 1)) * 100) : 0;
        return (
          <span key={star} className="relative inline-flex" aria-hidden="true">
            <Star className={`${iconClass} fill-transparent text-[var(--color-border)]`} />
            {(filled || partial) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: filled ? "100%" : `${fillPct}%` }}>
                <Star className={`${iconClass} fill-[#d8ff3e] text-[#b8c800]`} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
