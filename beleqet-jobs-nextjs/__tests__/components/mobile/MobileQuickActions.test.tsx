/**
 * @file __tests__/components/mobile/MobileQuickActions.test.tsx
 * @description Unit tests for the {@link MobileQuickActions} component.
 *
 * Covers:
 * - Renders all action buttons.
 * - Each button links to the correct href.
 * - Icon and label are rendered together.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Search, FileText, User } from "lucide-react";
import MobileQuickActions from "@/components/mobile/MobileQuickActions";
import type { QuickAction } from "@/components/mobile/MobileQuickActions";

const sampleActions: QuickAction[] = [
  { label: "Find Jobs", href: "/jobs", icon: Search },
  { label: "My Applications", href: "/applications", icon: FileText },
  { label: "Edit Profile", href: "/profile", icon: User },
];

describe("MobileQuickActions", () => {
  it("renders a link for each action", () => {
    render(<MobileQuickActions actions={sampleActions} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(sampleActions.length);
  });

  it("renders each action label", () => {
    render(<MobileQuickActions actions={sampleActions} />);
    expect(screen.getByText("Find Jobs")).toBeInTheDocument();
    expect(screen.getByText("My Applications")).toBeInTheDocument();
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
  });

  it("links to the correct hrefs", () => {
    render(<MobileQuickActions actions={sampleActions} />);
    const jobsLink = screen.getByText("Find Jobs").closest("a");
    expect(jobsLink).toHaveAttribute("href", "/jobs");

    const appsLink = screen.getByText("My Applications").closest("a");
    expect(appsLink).toHaveAttribute("href", "/applications");

    const profileLink = screen.getByText("Edit Profile").closest("a");
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  it("renders in a 2-column grid on mobile (has grid class)", () => {
    const { container } = render(
      <MobileQuickActions actions={sampleActions} />,
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-2");
  });

  it("renders an empty grid when no actions provided", () => {
    const { container } = render(<MobileQuickActions actions={[]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(0);
  });
});