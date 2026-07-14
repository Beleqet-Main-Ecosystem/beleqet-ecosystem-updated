"use client";

import { useCurrencyContext } from "@/components/CurrencyProvider";
import type { CurrencyCode } from "@/hooks/useCurrency";
import { DollarSign } from "lucide-react";

/**
 * Dropdown that switches the active display currency for the whole application.
 *
 * Reads and writes through `useCurrencyContext` so every component that
 * consumes the context re-renders immediately — no page refresh required.
 * The selection is also persisted to `localStorage` by the provider.
 *
 * @example
 * // Place inside a CurrencyProvider subtree
 * <CurrencySelector />
 */
export default function CurrencySelector() {
  const { currency, currencies, setCurrency } = useCurrencyContext();

  return (
    <div className="relative inline-flex items-center">
      <DollarSign
        className="pointer-events-none absolute left-2 h-4 w-4 text-[var(--color-text-muted)]"
        aria-hidden="true"
      />
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        aria-label="Select currency"
        className={[
          "h-9 appearance-none rounded-xl pl-7 pr-3 text-sm font-semibold",
          "border border-[var(--color-border)]",
          "bg-[var(--color-bg-surface)] text-[var(--color-text)]",
          "transition-colors duration-200 cursor-pointer",
          "hover:border-brandGreen focus:outline-none focus:ring-2 focus:ring-brandGreen/40",
        ].join(" ")}
      >
        {currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}
