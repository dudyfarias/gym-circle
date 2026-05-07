import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  elevated?: boolean;
};

export function GlassCard({
  children,
  className = "",
  elevated = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={[
        elevated ? "gc-glass" : "gc-ios-sheet",
        "rounded-[28px]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
