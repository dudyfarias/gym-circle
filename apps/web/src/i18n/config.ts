"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import enResources from "./locales/en.json";
import ptBrResources from "./locales/pt-BR.json";

/**
 * i18n config — Sprint 4.2.
 *
 * Setup do i18next + react-i18next pra suportar pt-BR e en.
 *
 * Estratégia:
 * - Resources estáticos (JSON imported) — bundle simples, sem async load.
 *   Pra 2 idiomas o overhead em bundle é trivial (~10kb total).
 * - Single namespace "common" pra começar. Quando crescer, splitar em
 *   namespaces (`auth`, `feed`, `profile`...) sem mudar a API do `t()`.
 * - Não usamos `i18next-browser-languagedetector` aqui pra evitar
 *   conflito com nosso fluxo customizado (Capacitor Device → localStorage →
 *   navigator.language). Ver `LocaleService.ts` pra detecção real.
 * - Init com `lng: 'pt-BR'` como fallback inicial. O `LocaleService`
 *   atualiza via `i18next.changeLanguage` no boot quando detecta a
 *   preferência salva ou device.
 *
 * Tip: o `react-i18next` v17 usa Suspense por default. Como nossos
 * resources são síncronos, `react: { useSuspense: false }` evita splash
 * desnecessário.
 */

export const SUPPORTED_LOCALES = ["pt-BR", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "pt-BR";

const initialized = { current: false };

export function getI18nInstance() {
  if (initialized.current) return i18next;
  void i18next.use(initReactI18next).init({
    resources: {
      "pt-BR": { common: ptBrResources },
      en: { common: enResources },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: "common",
    interpolation: {
      // React já escapa por default — desabilita escape interno pra
      // evitar dupla escape em strings com `<` ou `&`.
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
    // Pra debug local — ativa com NEXT_PUBLIC_I18N_DEBUG=true
    debug: process.env.NEXT_PUBLIC_I18N_DEBUG === "true",
  });
  initialized.current = true;
  return i18next;
}
