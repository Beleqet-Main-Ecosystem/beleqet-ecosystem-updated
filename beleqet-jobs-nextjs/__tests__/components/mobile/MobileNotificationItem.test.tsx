/**
 * @file __tests__/components/mobile/MobileNotificationItem.test.tsx
 * @description Unit tests for the {@link MobileNotificationItem} component.
 *
 * Covers:
 * - Renders title and body text.
 * - Shows an unread indicator dot for unread items.
 * - Formats the relative timestamp correctly.
 * - Applies distinct styles for read vs unread states.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MobileNotificationItem from "@/components/mobile/MobileNotificationItem";
import type { NotificationItem } from "@/components/mobile/MobileNotificationItem";

const baseItem: NotificationItem = {
  id: "notif-1",
  title: "New job match",
  body: "A new position matching your skills has been posted.",
  read: false,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
};

describe("MobileNotificationItem", () => {
  it("renders the notification title", () => {
    render(<MobileNotificationItem item={baseItem} />);
    expect(screen.getByText("New job match")).toBeInTheDocument();
  });

  it("renders the notification body", () => {
    render(<MobileNotificationItem item={baseItem} />);
    expect(
      screen.getByText("A new position matching your skills has been posted."),
    ).toBeInTheDocument();
  });

  it("renders the relative timestamp", () => {
    render(<MobileNotificationItem item={baseItem} />);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("applies brandGreen dot for unread items", () => {
    const { container } = render(
      <MobileNotificationItem item={{ ...baseItem, read: false }} />,
    );
    const dot = container.querySelector(".bg-brandGreen");
    expect(dot).toBeInTheDocument();
  });

  it("applies muted dot for read items", () => {
    const { container } = render(
      <MobileNotificationItem item={{ ...baseItem, read: true }} />,
    );
    const dot = container.querySelector(".bg-border");
    expect(dot).toBeInTheDocument();
  });

  it("applies different background for unread items", () => {
    const { container } = render(
      <MobileNotificationItem item={{ ...baseItem, read: false }} />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-brandGreen/20");
  });

  it("applies standard background for read items", () => {
    const { container } = render(
      <MobileNotificationItem item={{ ...baseItem, read: true }} />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-primary/5");
  });

  it('displays "Just now" for very recent notifications', () => {
    const recentItem: NotificationItem = {
      ...baseItem,
      createdAt: new Date().toISOString(),
    };
    render(<MobileNotificationItem item={recentItem} />);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });
});