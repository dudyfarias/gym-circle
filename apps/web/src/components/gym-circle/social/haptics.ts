import type { FeedbackTone } from "./types";

const vibrationByTone: Record<FeedbackTone, number[]> = {
  brand: [8],
  success: [12, 24, 12],
  like: [8],
  comment: [8, 16],
  follow: [10, 20, 10],
};

export function simulateHaptic(tone: FeedbackTone = "brand") {
  if (typeof window === "undefined" || !("navigator" in window)) {
    return;
  }

  const vibrate = window.navigator.vibrate;

  if (typeof vibrate === "function") {
    vibrate.call(window.navigator, vibrationByTone[tone]);
  }
}
