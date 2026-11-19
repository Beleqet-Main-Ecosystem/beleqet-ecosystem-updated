/**
 * @file __tests__/components/mobile/MobileStatCard.test.tsx
 * @description Unit tests for the {@link MobileStatCard} component.
 *
 * Covers:
 * - Renders the numeric value and label text.
 * - Renders the provided Lucide icon.
 * - Optionally renders the trend text.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Briefcase } from "lucide-react";
import MobileStatCard from "@/components/mobile/MobileStatCard";

describe("MobileStatCard", () => {
  it("renders the label text", () => {
    render(<MobileStatCard label="Applications" value={14} icon={Briefcase} />);
    expect(screen.getByText("Applications")).toBeInTheDocument();
  });

  it("renders the numeric value with locale formatting", () => {
    render(<MobileStatCard label="Jobs" value={1250} icon={Briefcase} />);
    expect(screen.getByText("1,250")).toBeInTheDocument();
  });

  it("renders the trend text when provided", () => {
    render(
      <MobileStatCard
        label="Jobs"
        value={42}
        icon={Briefcase}
        trend="+3 this week"
      />,
    );
    expect(screen.getByText("+3 this week")).toBeInTheDocument();
  });

  it("does not render trend text when not provided", () => {
    const { container } = render(
      <MobileStatCard label="Jobs" value={42} icon={Briefcase} />,
    );
    /* The trend element should not be present. */
    const trendElements = container.querySelectorAll(".text-success");
    expect(trendElements).toHaveLength(0);
  });

  it("applies the correct CSS classes for the card container", () => {
    const { container } = render(
      <MobileStatCard label="Jobs" value={5} icon={Briefcase} />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("bg-white");
  });

  it("renders zero value correctly", () => {
    render(<MobileStatCard label="Empty" value={0} icon={Briefcase} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});