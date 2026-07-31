"use client";

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useEffect, useRef } from "react";

export type AndroidBackHandler = () => boolean | Promise<boolean>;

const handlers = new Map<number, AndroidBackHandler>();
let nextHandlerId = 1;
let listenerPromise: Promise<PluginListenerHandle> | null = null;

export async function runAndroidBackHandlers(
  activeHandlers: AndroidBackHandler[],
): Promise<boolean> {
  for (let index = activeHandlers.length - 1; index >= 0; index -= 1) {
    if (await activeHandlers[index]?.()) return true;
  }
  return false;
}

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function ensureNativeListener() {
  if (!isNativeAndroid() || listenerPromise) return;

  listenerPromise = import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("backButton", async ({ canGoBack }) => {
        const handled = await runAndroidBackHandlers([
          ...handlers.values(),
        ]);
        if (handled) return;

        if (canGoBack && typeof window !== "undefined") {
          window.history.back();
          return;
        }

        await App.minimizeApp();
      }),
    )
    .catch((error) => {
      listenerPromise = null;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AndroidBackButton] listener unavailable", error);
      }
      throw error;
    });
}

export function registerAndroidBackHandler(handler: AndroidBackHandler) {
  if (!isNativeAndroid()) return () => undefined;

  const id = nextHandlerId;
  nextHandlerId += 1;
  handlers.set(id, handler);
  ensureNativeListener();

  return () => {
    handlers.delete(id);
  };
}

export function useAndroidBackButton(
  handler: AndroidBackHandler,
  enabled = true,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    return registerAndroidBackHandler(() => handlerRef.current());
  }, [enabled]);
}
