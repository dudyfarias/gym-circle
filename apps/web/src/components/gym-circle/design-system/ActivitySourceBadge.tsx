import { Activity, Apple, Import } from "lucide-react";

type ActivitySourceBadgeProps = {
  kind: "gym_circle" | "apple_watch" | "apple_health" | "external_app" | "imported";
  labels: Record<ActivitySourceBadgeProps["kind"], string>;
  externalLabel?: string | null;
};

export function ActivitySourceBadge({
  kind,
  labels,
  externalLabel,
}: ActivitySourceBadgeProps) {
  const Icon = kind === "gym_circle" ? Activity : kind.startsWith("apple") ? Apple : Import;
  const label = kind === "external_app" && externalLabel ? externalLabel : labels[kind];
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/35 px-2.5 py-1 text-[10px] font-black text-white/62 backdrop-blur-md">
      <Icon aria-hidden="true" size={12} strokeWidth={2.5} />
      <span className="truncate">{label}</span>
    </span>
  );
}
