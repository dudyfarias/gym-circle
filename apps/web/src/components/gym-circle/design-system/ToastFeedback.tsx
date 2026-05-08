import { Check, Heart, MessageCircle, Plus, Sparkles } from "lucide-react";
import type { FeedbackMessage } from "../social/types";

type ToastFeedbackProps = {
  feedback: FeedbackMessage | null;
};

const iconByTone = {
  brand: Sparkles,
  success: Check,
  like: Heart,
  comment: MessageCircle,
  follow: Plus,
};

export function ToastFeedback({ feedback }: ToastFeedbackProps) {
  if (!feedback) {
    return null;
  }

  const Icon = iconByTone[feedback.tone];

  return (
    <div className="pointer-events-none absolute left-4 right-4 top-5 z-[60]">
      <div className="gc-toast mx-auto flex max-w-[360px] items-center gap-3 rounded-full border border-white/[0.1] bg-black/78 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.52),0_0_30px_rgba(92,232,255,0.16)] backdrop-blur-2xl">
        <span
          className={[
            "grid size-9 place-items-center rounded-full",
            feedback.tone === "like"
              ? "bg-[var(--gc-consistency-month)]/12 text-[var(--gc-consistency-month)]"
              : "bg-[var(--gc-brand)] text-black",
          ].join(" ")}
        >
          <Icon size={17} fill="none" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-black text-white">
            {feedback.title}
          </span>
          {feedback.detail ? (
            <span className="block truncate text-[12px] font-bold text-white/48">
              {feedback.detail}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
