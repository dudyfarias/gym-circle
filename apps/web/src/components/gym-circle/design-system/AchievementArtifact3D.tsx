"use client";

import type { Achievement } from "../social/achievements";
import {
  getAchievementVisual,
  type AchievementVisualShape,
  type AchievementVisualTone,
} from "../social/achievementVisual";

/**
 * AchievementArtifact3D — Sprint 15.
 *
 * Artefato pseudo-3D em CSS puro (estilo medalhas do Apple Fitness "Prêmios").
 * Port do componente criado pelo Codex na branch release (commit 44517fa),
 * re-tipado pro modelo `Achievement` do main via adapter `getAchievementVisual`
 * (o modelo daqui não tem campo `visual`; o adapter deriva shape/tom/monograma
 * de kind/tier/rarity/difficulty).
 *
 * Diferenças vs release:
 * - `glow` (default true): o halo blur-xl é um filter caro — strips e grids
 *   com dezenas de artefatos passam `glow={false}` (só hero/destaque/detail
 *   mantêm o brilho).
 * - `float` (default false): aplica a animação `gc-achievement-artifact-float`
 *   (flutuação suave 5.5s) — usar só no destaque e no detail overlay.
 */
type AchievementArtifact3DProps = {
  achievement: Pick<Achievement, "earned" | "label"> & Partial<Achievement>;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  glow?: boolean;
  float?: boolean;
};

const sizeClass = {
  sm: "size-14 text-[13px]",
  md: "size-20 text-[18px]",
  lg: "size-44 text-[42px]",
};

const shellClass: Record<AchievementVisualTone, string> = {
  // Sprint 19 — palette de raridade.
  stone: "from-[#E5E7EB] via-[#9CA3AF] to-[#4B5563] shadow-[0_16px_40px_rgba(156,163,175,0.16)]",
  emerald: "from-[#A7F3D0] via-[#34D399] to-[#047857] shadow-[0_18px_46px_rgba(52,211,153,0.26)]",
  sapphire: "from-[#BFDBFE] via-[#3B82F6] to-[#1E3A8A] shadow-[0_18px_46px_rgba(59,130,246,0.28)]",
  amethyst: "from-[#E9D5FF] via-[#A855F7] to-[#6B21A8] shadow-[0_18px_52px_rgba(168,85,247,0.30)]",
  amber: "from-[#FDE68A] via-[#F59E0B] to-[#B45309] shadow-[0_20px_56px_rgba(245,158,11,0.34)]",
  dark: "from-[#4B5563] via-[#111827] to-[#050505] shadow-[0_18px_46px_rgba(0,0,0,0.35)]",
  // Tons legados (Sprint 15) — não mais usados pelo mapa, mantidos por segurança.
  cyan: "from-[#8CFBFF] via-[#30D5FF] to-[#0066FF] shadow-[0_18px_46px_rgba(48,213,255,0.28)]",
  blue: "from-[#8CFBFF] via-[#009DFF] to-[#0036A8] shadow-[0_18px_46px_rgba(0,102,255,0.24)]",
  bronze: "from-[#F4C28B] via-[#B87536] to-[#4D260F] shadow-[0_18px_46px_rgba(184,117,54,0.22)]",
  silver: "from-[#F7FBFF] via-[#AEB8C9] to-[#596173] shadow-[0_18px_46px_rgba(174,184,201,0.2)]",
  gold: "from-[#FFF1A6] via-[#F5B83B] to-[#8A4B00] shadow-[0_18px_46px_rgba(245,184,59,0.24)]",
  crystal: "from-[#F8FFFF] via-[#8CFBFF] to-[#6B7CFF] shadow-[0_20px_62px_rgba(140,251,255,0.32)]",
};

/**
 * Sprint 19 — halo de glow tintado por tier. Comum (stone) quase sem brilho
 * ("sem cor/sem brilho"); raridades maiores brilham na sua cor.
 */
const glowClass: Record<AchievementVisualTone, string> = {
  stone: "bg-white/[0.05] opacity-30",
  emerald: "bg-[#34D399]/24 opacity-100",
  sapphire: "bg-[#3B82F6]/24 opacity-100",
  amethyst: "bg-[#A855F7]/28 opacity-100",
  amber: "bg-[#F59E0B]/30 opacity-100",
  dark: "bg-white/[0.04] opacity-30",
  cyan: "bg-[var(--gc-brand)]/24 opacity-100",
  blue: "bg-[#009DFF]/24 opacity-100",
  bronze: "bg-[#B87536]/22 opacity-100",
  silver: "bg-[#AEB8C9]/22 opacity-100",
  gold: "bg-[#F5B83B]/24 opacity-100",
  crystal: "bg-[#8CFBFF]/26 opacity-100",
};

// Sprint 22 — forma = raridade. Disco→quadrado→hexágono→escudo→estrela.
// Hex/escudo/estrela usam clip-path (espaços viram "_" no valor arbitrário do
// Tailwind); o clip aplica-se ao shell e recorta os overlays de brilho juntos.
const shapeClass: Record<AchievementVisualShape, string> = {
  disc: "rounded-full",
  square: "rounded-[22%]",
  hex: "[clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]",
  shield: "[clip-path:polygon(10%_6%,90%_6%,90%_50%,50%_100%,10%_50%)]",
  star: "[clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]",
};

export function AchievementArtifact3D({
  achievement,
  size = "md",
  muted = false,
  glow = true,
  float = false,
}: AchievementArtifact3DProps) {
  const visual = getAchievementVisual(achievement as Achievement);
  const locked = muted || !achievement.earned;

  return (
    <div
      aria-label={achievement.label}
      className={[
        "relative grid shrink-0 place-items-center [perspective:620px]",
        sizeClass[size],
        float ? "gc-achievement-artifact-float" : "",
      ].join(" ")}
    >
      {glow ? (
        <div
          className={[
            "absolute inset-[-10%] rounded-full blur-xl transition-opacity duration-300",
            locked ? "bg-white/[0.04] opacity-35" : glowClass[visual.tone],
          ].join(" ")}
        />
      ) : null}
      <div
        className={[
          "relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br transition duration-300 [transform:rotateX(18deg)_rotateY(-16deg)_translateZ(0)]",
          shellClass[visual.tone],
          shapeClass[visual.shape],
          locked ? "grayscale opacity-45 shadow-none" : "opacity-100",
        ].join(" ")}
      >
        <div className="absolute inset-[7%] rounded-[inherit] bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.92),rgba(255,255,255,0.22)_18%,rgba(255,255,255,0)_46%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0)_34%,rgba(0,0,0,0.28)_100%)]" />
        <div className="absolute bottom-0 left-[10%] right-[10%] h-[22%] rounded-t-full bg-black/18 blur-[2px]" />
        <span
          className={[
            "relative z-10 font-black tracking-[-0.02em] text-black/78 drop-shadow-[0_1px_0_rgba(255,255,255,0.28)]",
            locked ? "text-white/34" : "",
          ].join(" ")}
        >
          {visual.monogram}
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
