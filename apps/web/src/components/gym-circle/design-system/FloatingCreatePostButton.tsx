import { Camera } from "lucide-react";

type FloatingCreatePostButtonProps = {
  label?: string;
  onClick?: () => void;
};

export function FloatingCreatePostButton({
  label = "Postar treino",
  onClick,
}: FloatingCreatePostButtonProps) {
  return (
    <button
      aria-label={label}
      className="gc-pressable fixed bottom-24 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black shadow-[0_18px_40px_rgba(0,0,0,0.42),0_0_30px_rgba(92,232,255,0.28)] lg:absolute"
      onClick={onClick}
      title={label}
      type="button"
    >
      <Camera size={18} strokeWidth={2.8} />
      {label}
    </button>
  );
}
