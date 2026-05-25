"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { lockPortrait } from "./native/OrientationService";

/**
 * AppBootEffects — Sprint 4.1 + 4.7 hotfix.
 *
 * Container client-side pra side-effects e overlays globais.
 *
 * Atualmente:
 *   - Lock de orientação portrait (`lockPortrait` do OrientationService).
 *   - Landscape overlay (CSS-driven via `.gc-landscape-overlay` em
 *     globals.css).
 *
 * Sprint 4.7 hotfix: a inicialização do i18n (singleton + locale detect)
 * foi MOVIDA pro `<I18nClientProvider>` no root layout, pra garantir que
 * roda ANTES de qualquer client component render. Antes era aqui, mas
 * tinha race condition: outros componentes podiam render com `useTranslation`
 * antes do `getI18nInstance()` top-level rodar (timing depende da ordem
 * de evaluation de módulos no Turbopack).
 */
export function AppBootEffects() {
  // Sprint 4.2: react-i18next hook conecta o overlay aos resources i18n.
  // O `useTranslation` re-renderiza quando `languageChanged` dispara,
  // então a mensagem segue o idioma escolhido sem precisar refresh.
  const { t } = useTranslation();

  useEffect(() => {
    // Fire-and-forget — lock retorna void mesmo em erro silencioso. Não
    // queremos bloquear o paint do app esperando o lock resolver.
    void lockPortrait();
    // i18n init agora rola no I18nClientProvider (Sprint 4.7 hotfix).
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
        <p className="text-[18px] font-black">{t("orientation.rotateTitle")}</p>
        <p className="mt-2 text-[14px] font-bold text-white/56">
          {t("orientation.rotateBody")}
        </p>
      </div>
    </div>
  );
}
