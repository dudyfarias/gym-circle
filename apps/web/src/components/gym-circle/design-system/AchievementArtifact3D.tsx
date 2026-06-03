"use client";

import type { AchievementV2 } from "../social/gamification";

type AchievementArtifact3DProps = {
  achievement: Pick<AchievementV2, "earned" | "label" | "visual" | "rarity">;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
};

const sizeClass = {
  sm: "size-14 text-[13px]",
  md: "size-20 text-[18px]",
  lg: "size-44 text-[42px]",
};

const shellClass = {
  cyan: "from-[#8CFBFF] via-[#30D5FF] to-[#0066FF] shadow-[0_18px_46px_rgba(48,213,255,0.28)]",
  blue: "from-[#8CFBFF] via-[#009DFF] to-[#0036A8] shadow-[0_18px_46px_rgba(0,102,255,0.24)]",
  bronze: "from-[#F4C28B] via-[#B87536] to-[#4D260F] shadow-[0_18px_46px_rgba(184,117,54,0.22)]",
  silver: "from-[#F7FBFF] via-[#AEB8C9] to-[#596173] shadow-[0_18px_46px_rgba(174,184,201,0.2)]",
  gold: "from-[#FFF1A6] via-[#F5B83B] to-[#8A4B00] shadow-[0_18px_46px_rgba(245,184,59,0.24)]",
  crystal: "from-[#F8FFFF] via-[#8CFBFF] to-[#6B7CFF] shadow-[0_20px_62px_rgba(140,251,255,0.32)]",
  dark: "from-[#4B5563] via-[#111827] to-[#050505] shadow-[0_18px_46px_rgba(0,0,0,0.35)]",
};

const shapeClass = {
  badge3d: "rounded-[28%]",
  medal3d: "rounded-full",
  trophy3d: "rounded-[34%_34%_42%_42%]",
  relic3d: "rounded-[34%] rotate-45",
};

export function AchievementArtifact3D({
  achievement,
  size = "md",
  muted = false,
}: AchievementArtifact3DProps) {
  const locked = muted || !achievement.earned;
  const isRelic = achievement.visual.kind === "relic3d";

  return (
    <div
      aria-label={achievement.label}
      className={[
        "relative grid shrink-0 place-items-center [perspective:620px]",
        sizeClass[size],
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-[-10%] rounded-full blur-xl transition-opacity duration-300",
          locked ? "bg-white/[0.04] opacity-35" : "bg-[var(--gc-brand)]/24 opacity-100",
        ].join(" ")}
      />
      <div
        className={[
          "relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br transition duration-300 [transform:rotateX(18deg)_rotateY(-16deg)_translateZ(0)]",
          shellClass[achievement.visual.tone],
          shapeClass[achievement.visual.kind],
          locked ? "grayscale opacity-45 shadow-none" : "opacity-100",
          isRelic ? "scale-[0.82]" : "",
        ].join(" ")}
      >
        <div className="absolute inset-[7%] rounded-[inherit] bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.92),rgba(255,255,255,0.22)_18%,rgba(255,255,255,0)_46%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0)_34%,rgba(0,0,0,0.28)_100%)]" />
        <div className="absolute bottom-0 left-[10%] right-[10%] h-[22%] rounded-t-full bg-black/18 blur-[2px]" />
        {achievement.visual.kind === "trophy3d" ? (
          <>
            <div className="absolute left-[-12%] top-[28%] h-[28%] w-[26%] rounded-full border-[5px] border-white/22" />
            <div className="absolute right-[-12%] top-[28%] h-[28%] w-[26%] rounded-full border-[5px] border-white/22" />
          </>
        ) : null}
        <span
          className={[
            "relative z-10 font-black tracking-[-0.02em] text-black/78 drop-shadow-[0_1px_0_rgba(255,255,255,0.28)]",
            isRelic ? "-rotate-45" : "",
            locked ? "text-white/34" : "",
          ].join(" ")}
        >
          {achievement.visual.monogram}
        </span>
      </div>
      {locked ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-[32%] w-[42%] rounded-b-[10px] rounded-t-[5px] border border-white/18 bg-black/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
        </div>
      ) : null}
    </div>
  );
}
