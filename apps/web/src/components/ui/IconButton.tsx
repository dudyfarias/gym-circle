import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  active?: boolean;
};

export function IconButton({
  children,
  label,
  active = false,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={[
        "gc-pressable grid size-12 place-items-center rounded-full border",
        active
          ? "border-white/10 bg-white text-black"
          : "border-white/8 bg-white/[0.055] text-white",
        className,
      ].join(" ")}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
