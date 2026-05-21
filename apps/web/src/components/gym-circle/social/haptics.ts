import type { FeedbackTone } from "./types";
import { HapticsService, type HapticLevel } from "../native/HapticsService";

const hapticByTone: Record<FeedbackTone, HapticLevel> = {
  brand: "selection",
  success: "success",
  like: "light",
  comment: "light",
  follow: "medium",
};

export function simulateHaptic(tone: FeedbackTone = "brand") {
  void HapticsService.play(hapticByTone[tone]);
}
