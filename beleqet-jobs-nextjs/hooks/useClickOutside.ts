import { useEffect, type RefObject } from "react";

/**
 * Calls `handler` when a click/tap occurs outside `ref`, or when the Escape
 * key is pressed.  Useful for closing dropdowns, modals, and popovers.
 *
 * Adheres to the **Single Responsibility Principle** by isolating all
 * click-outside and Escape-key logic into a single, testable hook.
 *
 * @param ref    - A React ref attached to the element to watch.
 * @param handler - Callback invoked on outside click or Escape key.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useClickOutside(ref, () => setOpen(false));
 * ```
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
): void {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handler();
      }
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, handler]);
}
