"use client";

import { useCallback, useEffect, useState } from "react";
import i18next from "i18next";
import { DEFAULT_LOCALE, type SupportedLocale } from "./config";
import { getCurrentLocale, setLocale as serviceSetLocale } from "./LocaleService";

/**
 * useLocale — Sprint 4.2.
 *
 * Hook React reativo pro locale ativo. Subscreve no `languageChanged` event
 * do i18next pra refletir mudanças vindo de QUALQUER lugar (Settings sheet,
 * boot init, código futuro). Consumer chama `setLocale("en")` e o app
 * inteiro re-renderiza.
 *
 * Padrão preferido vs. `useTranslation().i18n.language`:
 * - `useTranslation` é pra componentes que precisam do `t()` function.
 * - `useLocale` é pra UI que SÓ precisa saber/setar o idioma (ex: picker).
 * - Ambos são reativos via `languageChanged`.
 *
 * SSR-safe: useState init com getCurrentLocale() que retorna DEFAULT_LOCALE
 * fora do browser. useEffect resync após mount.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    getCurrentLocale(),
  );

  useEffect(() => {
    // Re-sync no mount (caso o boot init tenha mudado o locale após o
    // server-render).
    setLocaleState(getCurrentLocale());

    function handleLanguageChange(lang: string) {
      if (lang === "pt-BR" || lang === "en") {
        setLocaleState(lang);
      } else {
        setLocaleState(DEFAULT_LOCALE);
      }
    }

    i18next.on("languageChanged", handleLanguageChange);
    return () => {
      i18next.off("languageChanged", handleLanguageChange);
    };
  }, []);

  const setLocale = useCallback(async (next: SupportedLocale) => {
    await serviceSetLocale(next);
  }, []);

  return { locale, setLocale };
}
