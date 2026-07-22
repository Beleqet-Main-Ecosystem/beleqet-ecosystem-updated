"use client";

import { FormEvent, useState } from "react";
import {
  Calculator,
  Coins,
  Globe,
  Loader2,
  Percent,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { CurrencyUtil } from "@/lib/currency";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type CountryCode = "ET" | "US";
type Currency = "ETB" | "USD";

interface TaxResult {
  grossIncome: number;
  taxAmount: number;
  netIncome: number;
  currency: Currency;
  countryCode: CountryCode;
  effectiveTaxRate: number;
}

const COUNTRY_CURRENCY: Record<CountryCode, Currency> = {
  ET: "ETB",
  US: "USD",
};

export default function TaxCalculatorPage() {
  const { locale, t } = useTranslation();
  const formatLocale = locale === "am" ? "am-ET" : "en-US";

  const [grossInput, setGrossInput] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("ET");
  const [currency, setCurrency] = useState<Currency>("ETB");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TaxResult | null>(null);

  const parsedDecimal = grossInput.trim() === "" ? NaN : Number(grossInput);
  const previewSmallest =
    !Number.isNaN(parsedDecimal) && parsedDecimal >= 0
      ? CurrencyUtil.toSmallestUnit(parsedDecimal)
      : null;

  function handleCountryChange(next: CountryCode) {
    setCountryCode(next);
    setCurrency(COUNTRY_CURRENCY[next]);
    setResult(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const amount = Number(grossInput);
    if (Number.isNaN(amount) || amount < 0) {
      setError(t("taxCalculator.errorInvalidAmount"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/tax-calculator/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grossIncome: CurrencyUtil.toSmallestUnit(amount),
          currency,
          countryCode,
        }),
      });

      const data = (await response.json()) as TaxResult & {
        message?: string | string[];
        errorCode?: string;
      };

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || t("taxCalculator.errorGeneric");
        throw new Error(message);
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("taxCalculator.errorGeneric"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-pageBg">
      <section className="bg-primary py-16 text-white lg:py-20">
        <div className="container-page">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            {t("taxCalculator.badge")}
          </p>
          <h1 className="max-w-3xl text-[clamp(2.2rem,6vw,4.5rem)] font-black leading-[.95] tracking-[-.04em]">
            {t("taxCalculator.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70">
            {t("taxCalculator.subtitle")}
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_1fr] lg:py-16">
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-primary/10 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-cardHover sm:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brandGreen/10 text-brandGreen">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight text-primary">
                {t("taxCalculator.formTitle")}
              </h2>
              <p className="text-sm text-muted">{t("taxCalculator.annualNote")}</p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-bold text-primary">
                <Wallet className="h-4 w-4 text-brandGreen" />
                {t("taxCalculator.grossIncomeLabel")}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={grossInput}
                onChange={(event) => {
                  setGrossInput(event.target.value);
                  setResult(null);
                  setError("");
                }}
                placeholder="0.00"
                className="control w-full"
              />
              <p className="mt-1.5 text-xs text-muted">
                {t("taxCalculator.grossIncomeHint")}
              </p>
              {previewSmallest !== null && (
                <p className="mt-1 text-xs font-medium text-brandGreen transition-opacity duration-300">
                  {t("taxCalculator.smallestUnits")}: {previewSmallest}{" "}
                  {t("taxCalculator.units")}
                </p>
              )}
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-bold text-primary">
                <Globe className="h-4 w-4 text-brandGreen" />
                {t("taxCalculator.countryLabel")}
              </span>
              <select
                value={countryCode}
                onChange={(event) =>
                  handleCountryChange(event.target.value as CountryCode)
                }
                className="control w-full cursor-pointer"
              >
                <option value="ET">{t("taxCalculator.countryET")}</option>
                <option value="US">{t("taxCalculator.countryUS")}</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-bold text-primary">
                <Coins className="h-4 w-4 text-brandGreen" />
                {t("taxCalculator.currencyLabel")}
              </span>
              <select
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value as Currency);
                  setResult(null);
                  setError("");
                }}
                className="control w-full cursor-pointer"
              >
                <option value="ETB">ETB</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          {error && (
            <p className="mt-5 rounded-xl border border-redAccent/20 bg-redAccent/5 px-4 py-3 text-sm font-medium text-redAccent transition-all duration-300 animate-in fade-in slide-in-from-top-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || grossInput.trim() === ""}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brandGreen px-6 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:bg-darkGreen disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("taxCalculator.calculating")}
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                {t("taxCalculator.calculateButton")}
              </>
            )}
          </button>
        </form>

        <div
          className={`rounded-[28px] border border-primary/10 bg-white p-6 shadow-card transition-all duration-500 sm:p-8 ${
            result
              ? "translate-y-0 opacity-100 hover:-translate-y-1 hover:shadow-cardHover"
              : "opacity-90"
          }`}
        >
          <h2 className="text-xl font-black tracking-tight text-primary">
            {t("taxCalculator.resultsTitle")}
          </h2>

          {!result && !loading && (
            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/15 bg-pageBg px-6 py-14 text-center transition-all duration-300">
              <Calculator className="mb-4 h-10 w-10 text-muted/40" />
              <p className="max-w-xs text-sm leading-6 text-muted">
                {t("taxCalculator.resultsEmpty")}
              </p>
            </div>
          )}

          {loading && (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 py-14 animate-in fade-in duration-300">
              <Loader2 className="h-9 w-9 animate-spin text-brandGreen" />
              <p className="text-sm font-medium text-muted">
                {t("taxCalculator.calculating")}
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ResultRow
                icon={Wallet}
                label={t("taxCalculator.grossIncome")}
                value={CurrencyUtil.format(
                  result.grossIncome,
                  result.currency,
                  formatLocale,
                )}
              />
              <ResultRow
                icon={TrendingDown}
                label={t("taxCalculator.taxAmount")}
                value={CurrencyUtil.format(
                  result.taxAmount,
                  result.currency,
                  formatLocale,
                )}
                accent="text-redAccent"
              />
              <ResultRow
                icon={Wallet}
                label={t("taxCalculator.netIncome")}
                value={CurrencyUtil.format(
                  result.netIncome,
                  result.currency,
                  formatLocale,
                )}
                accent="text-brandGreen"
                highlight
              />
              <ResultRow
                icon={Percent}
                label={t("taxCalculator.effectiveRate")}
                value={`${(result.effectiveTaxRate * 100).toFixed(2)}%`}
                accent="text-primary"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  icon: Icon,
  label,
  value,
  accent = "text-primary",
  highlight = false,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-all duration-300 ${
        highlight
          ? "border-brandGreen/20 bg-brandGreen/5"
          : "border-primary/10 bg-pageBg"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brandGreen shadow-card">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-muted">{label}</span>
      </div>
      <span className={`text-base font-black ${accent}`}>{value}</span>
    </div>
  );
}
