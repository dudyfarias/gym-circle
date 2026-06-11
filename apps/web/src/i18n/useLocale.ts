"use client";

import { useCallback, useSyncExternalStore } from "react";
import i18next from "i18next";
import { DEFAULT_LOCALE, type SupportedLocale } from "./config";
import { getCurrentLocale, setLocale as serviceSetLocale } from "./LocaleService";

/**
 * useLocale — Sprint 4.2 (reescrito na Sprint 16).
 *
 * Hook React reativo pro locale ativo. i18next é um external store, então
 * o padrão canônico é `useSyncExternalStore`: subscreve no
 * `languageChanged` e usa `getCurrentLocale` como snapshot (já normaliza
 * idiomas não suportados pro DEFAULT e é SSR-safe — server snapshot =
 * DEFAULT_LOCALE). Além de matar o setState síncrono no effect (lint
 * react-hooks/set-state-in-effect), fecha a janela entre o render e o
 * subscribe em que uma troca de locale era perdida até o próximo evento.
 *
 * Padrão preferido vs. `useTranslation().i18n.language`:
 * - `useTranslation` é pra componentes que precisam do `t()` function.
 * - `useLocale` é pra UI que SÓ precisa saber/setar o idioma (ex: picker).
 * - Ambos são reativos via `languageChanged`.
 */
function subscribeToLanguageChange(onChange: () => void) {
  i18next.on("languageChanged", onChange);
  return () => {
    i18next.off("languageChanged", onChange);
  };
}

function serverSnapshot(): SupportedLocale {
  return DEFAULT_LOCALE;
}

export function useLocale() {
  const locale = useSyncExternalStore<SupportedLocale>(
    subscribeToLanguageChange,
    getCurrentLocale,
    serverSnapshot,
  );

  const setLocale = useCallback(async (next: SupportedLocale) => {
    await serviceSetLocale(next);
  }, []);

  return { locale, setLocale };
}
