import { describe, expect, it, vi } from "vitest";
import { runAndroidBackHandlers } from "./useAndroidBackButton";

describe("runAndroidBackHandlers", () => {
  it("runs the most recently registered handler first", async () => {
    const first = vi.fn(() => true);
    const latest = vi.fn(() => true);

    await expect(runAndroidBackHandlers([first, latest])).resolves.toBe(true);
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("falls through until a handler accepts the back action", async () => {
    const first = vi.fn(() => true);
    const latest = vi.fn(() => false);

    await expect(runAndroidBackHandlers([first, latest])).resolves.toBe(true);
    expect(latest).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });

  it("reports an unhandled action when the stack is empty", async () => {
    await expect(runAndroidBackHandlers([])).resolves.toBe(false);
  });
});
