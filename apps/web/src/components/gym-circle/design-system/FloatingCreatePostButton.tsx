import { Camera } from "lucide-react";

type FloatingCreatePostButtonProps = {
  hidden?: boolean;
  label?: string;
  onClick?: () => void;
};

export function FloatingCreatePostButton({
  hidden = false,
  label = "Postar treino",
  onClick,
}: FloatingCreatePostButtonProps) {
  return (
    <button
      aria-label={label}
      aria-hidden={hidden}
      className="gc-floating-post-button absolute bottom-[calc(5.75rem+var(--gc-safe-bottom))] left-1/2 z-40 flex h-14 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black shadow-[0_18px_40px_rgba(0,0,0,0.42),0_0_30px_rgba(92,232,255,0.28)]"
      data-hidden={hidden}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Camera size={18} strokeWidth={2.8} />
      {label}
    </button>
  );
}
