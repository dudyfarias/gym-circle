import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

type EmptyStateProps = {
  title: string;
  detail: string;
  action?: ReactNode;
};

export function EmptyState({ title, detail, action }: EmptyStateProps) {
  return (
    <div className="gc-glass-strong rounded-[32px] p-6 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)] shadow-[0_0_28px_rgba(92,232,255,0.18)]">
        <Sparkles size={22} />
      </div>
      <h3 className="text-[20px] font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-[260px] text-[14px] font-bold leading-5 text-zinc-400">
        {detail}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
