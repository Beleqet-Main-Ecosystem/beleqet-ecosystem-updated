/**
 * @file StarRating.test.tsx
 * Jest unit tests for components/StarRating.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StarRating from "@/components/StarRating";

describe("StarRating — readonly mode", () => {
  test("renders correct number of stars (default 5)", () => {
    render(<StarRating value={3} readonly />);
    // aria img wraps all stars
    const group = screen.getByRole("img");
    expect(group).toHaveAttribute("aria-label", "3.0 out of 5 stars");
  });

  test("aria-label reflects fractional value", () => {
    render(<StarRating value={4.5} readonly />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "4.5 out of 5 stars");
  });

  test("renders with custom max", () => {
    render(<StarRating value={2} max={10} readonly />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "2.0 out of 10 stars");
  });

  test("accepts custom className", () => {
    const { container } = render(<StarRating value={3} readonly className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("StarRating — interactive mode", () => {
  test("renders a radiogroup with correct number of buttons", () => {
    const onChange = jest.fn();
    render(<StarRating value={0} onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  test("each star button has an accessible aria-label", () => {
    render(<StarRating value={0} onChange={jest.fn()} />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio, i) => {
      expect(radio).toHaveAttribute("aria-label", `${i + 1} star${i + 1 !== 1 ? "s" : ""}`);
    });
  });

  test("clicking a star calls onChange with correct value", () => {
    const onChange = jest.fn();
    render(<StarRating value={0} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("radio")[2]); // 3rd star = rating 3
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test("clicking each star calls onChange with that star's value", () => {
    const onChange = jest.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio, i) => {
      fireEvent.click(radio);
      expect(onChange).toHaveBeenCalledWith(i + 1);
    });
  });

  test("aria-checked is true on the currently selected star", () => {
    render(<StarRating value={3} onChange={jest.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });

  test("ArrowRight key increments the rating", () => {
    const onChange = jest.fn();
    render(<StarRating value={2} onChange={onChange} />);
    const star2 = screen.getAllByRole("radio")[1]; // 0-indexed
    fireEvent.keyDown(star2, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test("ArrowLeft key decrements the rating", () => {
    const onChange = jest.fn();
    render(<StarRating value={3} onChange={onChange} />);
    const star3 = screen.getAllByRole("radio")[2];
    fireEvent.keyDown(star3, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  test("ArrowRight does not exceed max", () => {
    const onChange = jest.fn();
    render(<StarRating value={5} onChange={onChange} max={5} />);
    const star5 = screen.getAllByRole("radio")[4];
    fireEvent.keyDown(star5, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(5); // stays at max
  });

  test("ArrowLeft does not go below 1", () => {
    const onChange = jest.fn();
    render(<StarRating value={1} onChange={onChange} />);
    const star1 = screen.getAllByRole("radio")[0];
    fireEvent.keyDown(star1, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(1); // stays at 1
  });
});
