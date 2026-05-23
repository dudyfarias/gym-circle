"use client";

import { useMemo, type CSSProperties } from "react";
import { simulateHaptic } from "../social/haptics";
import {
  buildConsistencyRings,
  getConsistencyProgress,
} from "../social/streak";
import type { EnrichedUser } from "../social/types";

/**
 * AvatarConsistencyRings — Sprint 3.5.2.
 *
 * Assinatura visual do Gym Circle: foto do usuário centralizada com 3
 * círculos concêntricos representando consistência da semana, mês e ano.
 *
 * Layout (externo → interno):
 *   [ano | mês | semana | avatar]
 *
 * O componente inteiro é um botão único — tap abre o `MyCircleSheet`
 * (gamificação rica, Fase 3.5.3).
 *
 * Story ring (compat): quando `hasStory`, desenha um ring extra fora dos
 * 3 de consistência com gradient brand→month→year (story não vista) ou
 * cinza translúcido (vista). Não é interativo aqui — o caller que
 * compõe o componente pode adicionar entry-point separado pra story.
 *
 * Decisões de UX (vindas do user):
 * - Streak NÃO fica dentro dos rings (vira chip separado no perfil).
 * - Visual dark premium, sem glow exagerado.
 * - Stroke fino, animação leve, 60fps.
 * - Inspiração: Apple Activity Rings, Whoop, Instagram minimalista —
 *   sem copiar nenhum.
 */

type AvatarConsistencyRingsProps = {
  user: EnrichedUser;
  size?: number;
  hasStory?: boolean;
  storyViewed?: boolean;
  onTap?: () => void;
  /** Aria-label customizado (default usa nome + progressos). */
  ariaLabel?: string;
};

export function AvatarConsistencyRings({
  user,
  size = 180,
  hasStory = false,
  storyViewed = false,
  onTap,
  ariaLabel,
}: AvatarConsistencyRingsProps) {
  const consistencyInput = useMemo(
    () => ({
      workoutsThisWeek: user.workoutsThisWeek ?? 0,
      workoutsThisMonth: user.workoutsThisMonth ?? 0,
      // `activeDaysCount` é year-scoped no Supabase (`active_days_this_year`).
      workoutsThisYear: user.activeDaysCount ?? 0,
    }),
    [user.workoutsThisWeek, user.workoutsThisMonth, user.activeDaysCount],
  );
  const rings = useMemo(
    () => buildConsistencyRings(consistencyInput),
    [consistencyInput],
  );
  const progress = useMemo(
    () => getConsistencyProgress(consistencyInput),
    [consistencyInput],
  );

  const center = size / 2;
  const strokeWidth = Math.max(5, Math.round(size * 0.032));
  const ringGap = Math.max(3, Math.round(size * 0.022));
  const storyGap = Math.max(4, Math.round(size * 0.03));

  // Raio do ring mais interno (semana — index 2). Avatar fica dentro dele
  // com folga `avatarPadding`.
  const innerRingRadius =
    center - strokeWidth / 2 - (rings.length - 1) * (strokeWidth + ringGap);
  const avatarPadding = Math.max(6, Math.round(size * 0.04));
  const avatarDiameter = Math.max(
    32,
    Math.floor((innerRingRadius - strokeWidth - avatarPadding) * 2),
  );

  // Story ring (se ativo) fica FORA dos rings de consistência. Adicionamos
  // `storyGap` entre o ring externo (ano, index 0) e o story ring.
  const storyRadius = center - strokeWidth / 2;
  const consistencyOuterRadius = storyRadius - (hasStory ? strokeWidth + storyGap : 0);

  const computedAriaLabel =
    ariaLabel ??
    [
      `Consistência de ${user.name}`,
      `Semana ${Math.round(progress.week)} por cento`,
      `Mês ${Math.round(progress.month)} por cento`,
      `Ano ${Math.round(progress.year)} por cento`,
      hasStory ? (storyViewed ? "story visto" : "story novo") : null,
    ]
      .filter(Boolean)
      .join(", ");

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  function handleTap() {
    if (!onTap) return;
    simulateHaptic("like"); // tap nos rings = light haptic (Sprint 3.5)
    onTap();
  }

  return (
    <button
      aria-label={computedAriaLabel}
      className="gc-pressable relative shrink-0 rounded-full"
      onClick={handleTap}
      style={{ width: size, height: size }}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 overflow-visible"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {hasStory && !storyViewed ? (
          <defs>
            <linearGradient
              id={`gc-story-gradient-${user.id}`}
              x1="0%"
              x2="100%"
              y1="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="var(--gc-brand)" />
              <stop offset="55%" stopColor="var(--gc-consistency-month)" />
              <stop offset="100%" stopColor="var(--gc-consistency-year)" />
            </linearGradient>
          </defs>
        ) : null}

        {hasStory && !storyViewed ? (
          // Sprint 2: quando o story JÁ foi visto, NÃO desenhamos o ring
          // (decisão do user — "apagar o círculo em volta"). Antes
          // mostrava cinza translúcido. Bubble continua clicável pra
          // rever; ring colorido só significa "tem story novo".
          // Spacing entre consistency rings e borda permanece igual ao
          // estado "tem story novo" pra evitar layout shift entre
          // estados.
          <circle
            cx={center}
            cy={center}
            fill="none"
            r={storyRadius}
            stroke={`url(#gc-story-gradient-${user.id})`}
            strokeWidth={strokeWidth}
          />
        ) : null}

        {rings.map((ring, index) => {
          // index 0 = ring de fora (ano), index 2 = ring de dentro (semana)
          const radius =
            consistencyOuterRadius - index * (strokeWidth + ringGap);
          const value = Math.max(0, Math.min(ring.value, 100));
          const dashTarget = 100 - value;
          return (
            <g key={ring.id}>
              <circle
                cx={center}
                cy={center}
                fill="none"
                r={radius}
                // Sprint 3.6.2: track de 0.075 era invisível demais quando o
                // value era 0 (ring de Semana). User reportou só ver 2 dos 3
                // rings. Subimos pra 0.16 — ainda dark premium, mas garante
                // que os 3 tracks aparecem mesmo com value=0.
                stroke="rgba(140,251,255,0.16)"
                strokeWidth={strokeWidth}
              />
              <circle
                className="gc-activity-ring-value"
                cx={center}
                cy={center}
                fill="none"
                pathLength={100}
                r={radius}
                stroke={ring.color}
                strokeDasharray={100}
                strokeDashoffset={dashTarget}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
                style={
                  {
                    // `--gc-ring-target` é consumido pela `@keyframes
                    // gc-activity-fill` no globals.css — sem essa custom
                    // property a animação termina em `stroke-dashoffset: 0`
                    // (ring cheio independente do dado real). BUG visto na
                    // primeira versão do AvatarConsistencyRings (Sprint 3.5.2):
                    // todos os rings pareciam 100% mesmo com dados modestos.
                    "--gc-ring-target": dashTarget,
                    animationDelay: `${index * 110}ms`,
                    filter: ring.glow
                      ? `drop-shadow(0 0 5px ${ring.glow})`
                      : undefined,
                  } as CSSProperties
                }
                // Sem `transform=rotate(-90 ...)`: a classe CSS
                // `gc-activity-ring-value` já aplica
                // `transform: rotate(-90deg) + transform-origin: center +
                // transform-box: fill-box`. Aplicar de novo aqui duplica a
                // rotação e quebra o ponto inicial do progresso.
              />
            </g>
          );
        })}
      </svg>

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 overflow-hidden rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          width: avatarDiameter,
          height: avatarDiameter,
          // `aspect-ratio` + `overflow-hidden + rounded-full` forçam o crop
          // circular mesmo se o <img> nativo decidir respeitar proporção da
          // imagem (era o caso quando estava com `next/image` e a foto saiu
          // oval — bug Sprint 3.5.2).
          aspectRatio: "1 / 1",
        }}
      >
        {user.avatarUrl ? (
          // <img> nativo em vez de next/image: dimensões fixas, sem
          // wrapper extra do Next, sem regras de aspect-ratio intrínseco da
          // imagem. `object-cover` + `h-full w-full` no <img> dentro de
          // container quadrado garantem crop circular previsível.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={user.name}
            className="h-full w-full object-cover"
            draggable={false}
            src={user.avatarUrl}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center font-extrabold text-black"
            style={{
              background: `linear-gradient(135deg, ${user.accent ?? "var(--gc-brand)"}, rgba(255,255,255,0.86))`,
              boxShadow: `0 0 24px ${user.accent ?? "var(--gc-brand)"}38`,
              fontSize: Math.max(18, Math.round(avatarDiameter * 0.32)),
            }}
          >
            {initials}
          </div>
        )}
      </div>
    </button>
  );
}
