"use client";

import { useEffect } from "react";
import { lockPortrait } from "./native/OrientationService";

/**
 * AppBootEffects — Sprint 4.1.
 *
 * Container client-side pra side-effects e overlays globais que precisam
 * ficar próximos do root.
 *
 * Atualmente:
 *   - Lock de orientação portrait (`lockPortrait` do OrientationService).
 *   - Landscape overlay (CSS-driven via `.gc-landscape-overlay` em
 *     globals.css). Render em todas as rotas; visível só quando a media
 *     query `(orientation: landscape) and (pointer: coarse)` casa.
 *
 * Futuro (Sprint 4.2+): inicializar i18n com detecção de idioma.
 */
export function AppBootEffects() {
  useEffect(() => {
    // Fire-and-forget — lock retorna void mesmo em erro silencioso. Não
    // queremos bloquear o paint do app esperando o lock resolver.
    void lockPortrait();
  }, []);

  return (
    <div
      aria-hidden="true"
      // role="alert" + aria-live="polite" não cabem porque o overlay é
      // visual-only (não interfere em leitor de tela quando o user gira
      // de propósito). Display gerenciado 100% por CSS.
      className="gc-landscape-overlay"
    >
      <div className="max-w-[280px]">
        <div className="mb-4 grid size-14 place-items-center mx-auto rounded-full bg-white/[0.08]">
          <svg
            aria-hidden="true"
            fill="none"
            height="28"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="28"
          >
            <rect height="20" rx="2" ry="2" width="14" x="5" y="2" />
            <line x1="12" x2="12.01" y1="18" y2="18" />
          </svg>
        </div>
        <p className="text-[18px] font-black">Vire o celular</p>
        <p className="mt-2 text-[14px] font-bold text-white/56">
          O Gym Circle funciona em modo retrato. Coloque seu celular na
          vertical pra continuar.
        </p>
      </div>
    </div>
  );
}
