/**
 * Native keyboard detection via the Capacitor Keyboard plugin.
 *
 * Why this is its own defensive module:
 * Capacitor's `addListener` does NOT have a stable return shape. The native
 * iOS bridge (`window.Capacitor.Plugins.Keyboard`) returns the
 * `PluginListenerHandle` *synchronously*, while other runtimes return a
 * `Promise<PluginListenerHandle>`. Calling `.then()` on the synchronous
 * handle throws `TypeError: ....then is not a function` — and because that
 * throw is synchronous, a trailing `.catch()` never catches it. That crash
 * took down the whole authenticated app on login and caused an App Store
 * rejection (Guideline 2.1).
 *
 * `await` normalizes both shapes (awaiting a non-Promise just yields it), and
 * every step is wrapped so this keyboard-detection nicety can never crash the
 * render tree. If wiring fails, the visualViewport heuristic still covers
 * browser/PWA.
 */

type ListenerHandleLike = { remove?: () => unknown };

export type KeyboardPluginLike = {
  addListener: (
    event: "keyboardWillShow" | "keyboardWillHide",
    callback: () => void,
  ) => ListenerHandleLike | Promise<ListenerHandleLike>;
};

export function attachCapacitorKeyboardListeners(
  plugin: KeyboardPluginLike,
  onChange: (open: boolean) => void,
): () => void {
  let removeShow: (() => unknown) | undefined;
  let removeHide: (() => unknown) | undefined;
  let cancelled = false;

  void (async () => {
    try {
      const showHandle = await plugin.addListener("keyboardWillShow", () =>
        onChange(true),
      );
      if (cancelled) showHandle?.remove?.();
      else removeShow = showHandle?.remove;

      const hideHandle = await plugin.addListener("keyboardWillHide", () =>
        onChange(false),
      );
      if (cancelled) hideHandle?.remove?.();
      else removeHide = hideHandle?.remove;
    } catch {
      // Plugin missing or misbehaving — non-fatal, visualViewport covers web.
    }
  })();

  return () => {
    cancelled = true;
    try {
      removeShow?.();
    } catch {
      // ignore
    }
    try {
      removeHide?.();
    } catch {
      // ignore
    }
  };
}
