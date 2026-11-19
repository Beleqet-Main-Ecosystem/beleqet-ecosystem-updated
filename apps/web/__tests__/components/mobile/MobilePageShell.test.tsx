/**
 * @file __tests__/components/mobile/MobilePageShell.test.tsx
 * @description Unit tests for the {@link MobilePageShell} component.
 *
 * Covers:
 * - Renders the title text in the header.
 * - Renders the subtitle when provided.
 * - Renders the badge text when provided.
 * - Wraps children inside the content area.
 * - Applies gradient classes based on the accent prop.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MobilePageShell from "@/components/mobile/MobilePageShell";
import type { ShellAccent } from "@/components/mobile/MobilePageShell";

describe("MobilePageShell", () => {
  it("renders the title in the header section", () => {
    render(
      <MobilePageShell title="Welcome back, John" accent="brandGreen">
        <p>Content here</p>
      </MobilePageShell>,
    );
    expect(screen.getByText("Welcome back, John")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(
      <MobilePageShell
        title="Dashboard"
        subtitle="Your career overview"
        accent="brandGreen"
      >
        <p>Content</p>
      </MobilePageShell>,
    );
    expect(screen.getByText("Your career overview")).toBeInTheDocument();
  });

  it("does not render subtitle when omitted", () => {
    render(
      <MobilePageShell title="Dashboard" accent="brandGreen">
        <p>Content</p>
      </MobilePageShell>,
    );
    expect(screen.queryByText("Your career overview")).not.toBeInTheDocument();
  });

  it("renders the badge text when provided", () => {
    render(
      <MobilePageShell
        title="Dashboard"
        badge="Career dashboard"
        accent="brandGreen"
      >
        <p>Content</p>
      </MobilePageShell>,
    );
    expect(screen.getByText("Career dashboard")).toBeInTheDocument();
  });

  it("renders children inside the content area", () => {
    render(
      <MobilePageShell title="Test" accent="brandGreen">
        <p data-testid="child-content">Hello World</p>
      </MobilePageShell>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("applies brandGreen gradient by default", () => {
    const { container } = render(
      <MobilePageShell title="Test">
        <p>Content</p>
      </MobilePageShell>,
    );
    const section = container.querySelector("section");
    expect(section?.className).toContain("from-brandGreen");
    expect(section?.className).toContain("to-darkGreen");
  });

  it("applies primary gradient when accent='primary'", () => {
    const { container } = render(
      <MobilePageShell title="Test" accent="primary">
        <p>Content</p>
      </MobilePageShell>,
    );
    const section = container.querySelector("section");
    expect(section?.className).toContain("from-primary");
    expect(section?.className).toContain("to-primary2");
  });

  it("adds bottom padding for mobile bottom nav", () => {
    const { container } = render(
      <MobilePageShell title="Test">
        <p>Content</p>
      </MobilePageShell>,
    );
    const contentDiv = container.querySelector(".pb-28");
    expect(contentDiv).toBeInTheDocument();
  });
});