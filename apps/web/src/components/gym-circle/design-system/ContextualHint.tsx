"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { simulateHaptic } from "../social/haptics";

/**
 * ContextualHint — Sprint 7C.1.
 *
 * Componente reusável pra "Contextual Motion Onboarding": dicas inline
 * que aparecem na primeira vez que o user encontra uma feature, e somem
 * pra sempre quando dispensadas.
 *
 * Persistência dupla:
 *   1. **localStorage** (fonte primária, instant) — `gc-hint-{id}`.
 *   2. **DB JSONB** (cross-device sync, best-effort) — via
 *      `markContextualHintSeen` action.
 *
 * Quando o user dismisse num device, o flag cruza pra outros devices no
 * próximo refresh do profile. Falha de rede aqui é silenciosa — local
 * já absorveu.
 *
 * Variantes visuais:
 *   - `banner` (default) — chip inline com background sutil, X no canto.
 *     Usado pra prompts maiores (ex: profile completion).
 *   - `tooltip` — bubble com seta, render absoluto. Usado pra apontar
 *     pra elementos específicos.
 *
 * Animação: fade-in + slide-up de 6px na entrada. Saída instantânea
 * (não distrair o user durante dismiss).
 */

export type ContextualHintVariant = "banner" | "tooltip";

type ContextualHintProps = {
  /** ID único do hint. Usado como key em localStorage + DB JSONB. */
  hintId: string;
  /** Hints já vistos pelo user (do EnrichedUser.contextualHintsSeen). */
  seenHints?: Record<string, string>;
  /** Action de sync DB. Falha não bloqueia UX. */
  markSeen?: (hintId: string) => Promise<void>;
  /** Conteúdo do hint. Em `tooltip` mode, costuma ser texto curto. */
  children: React.ReactNode;
  variant?: ContextualHintVariant;
  /** Classes adicionais pro container. */
  className?: string;
  /**
   * Quando true, ignora o seen state e força render. Útil pra teste
   * visual + pra hints que devem reaparecer toda vez que o context muda
   * (caller controla a lógica).
   */
  alwaysShow?: boolean;
};

export function ContextualHint({
  hintId,
  seenHints,
  markSeen,
  children,
  variant = "banner",
  className,
  alwaysShow = false,
}: ContextualHintProps) {
  // Resolve seen no boot: DB tem prioridade, localStorage como fallback.
  // Memo pra evitar re-render quando outros campos do user mudam.
  const initiallySeen = useMemo(() => {
    if (alwaysShow) return false;
    if (seenHints && hintId in seenHints) return true;
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(localStorageKey(hintId)) === "true";
    } catch {
      return false;
    }
  }, [alwaysShow, hintId, seenHints]);

  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger enter animation no próximo frame após mount. Isso permite que
  // o initial className sem `opacity-100` seja aplicado antes do transition.
  useEffect(() => {
    if (initiallySeen || dismissed) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [initiallySeen, dismissed]);

  const handleDismiss = useCallback(() => {
    simulateHaptic("brand");
    setDismissed(true);
    // localStorage primeiro (instant). DB depois (best-effort).
    try {
      window.localStorage.setItem(localStorageKey(hintId), "true");
    } catch {
      // localStorage cheio ou disabled — segue mesmo assim, próximo boot
      // pega do DB.
    }
    // Fire-and-forget. Erro vira warn console.
    markSeen?.(hintId).catch((err) => {
      console.warn(`[ContextualHint] markSeen failed for ${hintId}:`, err);
    });
  }, [hintId, markSeen]);

  if (initiallySeen || dismissed) return null;

  const enterClass = mounted
    ? "translate-y-0 opacity-100"
    : "translate-y-1.5 opacity-0";

  if (variant === "tooltip") {
    return (
      <div
        className={[
          "pointer-events-auto absolute z-[60] flex max-w-[260px] items-start gap-2 rounded-[14px] border border-[var(--gc-brand)]/24 bg-[#0a0b0c] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out",
          enterClass,
          className ?? "",
        ].join(" ")}
        role="status"
      >
        <span className="min-w-0 flex-1 text-[12px] font-bold leading-[1.3] text-white/86">
          {children}
        </span>
        <button
          aria-label="Dismiss"
          className="gc-pressable -mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-full text-white/56 hover:text-white"
          onClick={handleDismiss}
          type="button"
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      </div>
    );
  }

  // banner variant
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-[16px] border border-[var(--gc-brand)]/14 bg-[linear-gradient(180deg,rgba(48,213,255,0.06),rgba(255,255,255,0.01)_60%,transparent)] px-4 py-3 transition-all duration-300 ease-out",
        enterClass,
        className ?? "",
      ].join(" ")}
      role="status"
    >
      <div className="min-w-0 flex-1 text-[12.5px] font-bold leading-[1.4] text-white/86">
        {children}
      </div>
      <button
        aria-label="Dismiss"
        className="gc-pressable -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-white/56 hover:text-white"
        onClick={handleDismiss}
        type="button"
      >
        <X size={14} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/**
 * Hook auxiliar pra casos onde o caller precisa renderizar UI custom
 * (não usa ContextualHint diretamente) mas quer participar do mesmo
 * sistema de "seen once". Retorna o estado atual + dismiss handler.
 *
 * Útil pra animações orquestradas (ex: pulse de 3 segundos) que precisam
 * saber se já foram tocadas antes.
 */
export function useContextualHint(
  hintId: string,
  seenHints?: Record<string, string>,
  markSeen?: (hintId: string) => Promise<void>,
) {
  const [dismissed, setDismissed] = useState(false);

  const initiallySeen = useMemo(() => {
    if (seenHints && hintId in seenHints) return true;
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(localStorageKey(hintId)) === "true";
    } catch {
      return false;
    }
  }, [hintId, seenHints]);

  const seen = initiallySeen || dismissed;

  const dismiss = useCallback(() => {
    if (seen) return;
    setDismissed(true);
    try {
      window.localStorage.setItem(localStorageKey(hintId), "true");
    } catch {
      // ignored — DB sync seguinte ainda cobre o caso
    }
    markSeen?.(hintId).catch((err) => {
      console.warn(`[useContextualHint] markSeen failed for ${hintId}:`, err);
    });
  }, [hintId, markSeen, seen]);

  return { seen, dismiss };
}

function localStorageKey(hintId: string): string {
  return `gc-hint-${hintId}`;
}
