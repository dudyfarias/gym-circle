import { describe, expect, it } from "vitest";
import { attachCapacitorKeyboardListeners } from "./keyboardDetection";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("attachCapacitorKeyboardListeners", () => {
  it("does not throw when addListener returns a synchronous handle", () => {
    // Reproduces the App Store rejection (Guideline 2.1): the native
    // Capacitor iOS bridge returns the PluginListenerHandle synchronously,
    // not a Promise. The old `.addListener(...).then(...)` code threw
    // `TypeError: ....then is not a function` and crashed the app on login.
    const plugin = {
      addListener: () => ({ remove: () => {} }),
    };
    expect(() =>
      attachCapacitorKeyboardListeners(plugin, () => {}),
    ).not.toThrow();
  });

  it("does not throw when addListener returns a Promise", () => {
    const plugin = {
      addListener: () => Promise.resolve({ remove: () => {} }),
    };
    expect(() =>
      attachCapacitorKeyboardListeners(plugin, () => {}),
    ).not.toThrow();
  });

  it("does not throw when addListener itself throws synchronously", () => {
    const plugin = {
      addListener: () => {
        throw new Error("plugin not registered");
      },
    };
    expect(() =>
      attachCapacitorKeyboardListeners(plugin, () => {}),
    ).not.toThrow();
  });

  it("forwards keyboardWillShow / keyboardWillHide to onChange", async () => {
    const handlers: Record<string, () => void> = {};
    const plugin = {
      addListener: (
        event: "keyboardWillShow" | "keyboardWillHide",
        callback: () => void,
      ) => {
        handlers[event] = callback;
        return { remove: () => {} };
      },
    };
    let open: boolean | undefined;
    attachCapacitorKeyboardListeners(plugin, (next) => {
      open = next;
    });
    await tick();

    handlers.keyboardWillShow?.();
    expect(open).toBe(true);
    handlers.keyboardWillHide?.();
    expect(open).toBe(false);
  });

  it("removes both listeners on cleanup", async () => {
    let removed = 0;
    const plugin = {
      addListener: () => ({
        remove: () => {
          removed += 1;
        },
      }),
    };
    const cleanup = attachCapacitorKeyboardListeners(plugin, () => {});
    await tick();
    cleanup();
    expect(removed).toBe(2);
  });
});
