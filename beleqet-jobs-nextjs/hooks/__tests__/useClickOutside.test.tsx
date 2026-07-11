import { render } from "@testing-library/react";
import { useRef } from "react";
import { useClickOutside } from "../useClickOutside";

function TestComponent({ onOutside }: { onOutside: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onOutside);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        inside
      </div>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls handler when clicking outside the ref element", () => {
    const handler = jest.fn();
    render(<TestComponent onOutside={handler} />);

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does NOT call handler when clicking inside the ref element", () => {
    const handler = jest.fn();
    const { getByTestId } = render(<TestComponent onOutside={handler} />);

    getByTestId("inside").dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when Escape is pressed", () => {
    const handler = jest.fn();
    render(<TestComponent onOutside={handler} />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does NOT call handler for other keys", () => {
    const handler = jest.fn();
    render(<TestComponent onOutside={handler} />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
