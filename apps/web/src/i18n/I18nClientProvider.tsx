"use client";

import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { getI18nInstance } from "./config";
import { initializeLocale } from "./LocaleService";

/**
 * I18nClientProvider — Sprint 4.7 hotfix.
 *
 * Bug original (reportado por Eduardo 2026-05-25): trocar idioma no Settings
 * sheet faz a UI dele mudar, mas TopBar/feed/profile/etc continuam em PT-BR
 * mesmo após reload completo do app.
 *
 * Diagnóstico provável: sem `<I18nextProvider>` no root, o `useTranslation`
 * hook em cada componente cai no fallback `getI18n()` global. Se Turbopack
 * code-splita módulos ou se a ordem de init não está garantida ANTES dos
 * primeiros renders, alguns componentes podem subscriber numa instância e
 * outros em outra (ou em uma instância sem `initReactI18next` aplicado).
 *
 * Fix em 3 camadas (defense in depth):
 *
 * 1. Top-level `getI18nInstance()` neste módulo garante init ANTES de
 *    qualquer child montar (módulo importado pelo RootLayout = primeira
 *    coisa no client bundle).
 *
 * 2. `<I18nextProvider i18n={...}>` põe o i18n no React context. Todos os
 *    `useTranslation` descendentes leem do context (1ª prioridade) em vez
 *    de cair no fallback global. Zero risco de fragmentation.
 *
 * 3. `initializeLocale()` aqui (no useEffect do provider, não no
 *    AppBootEffects) garante que o detect/apply do idioma rola assim que
 *    o root mounta, antes dos children de fato renderizarem o tree todo.
 */

// Top-level (module-eval): init i18next ANTES de qualquer componente render.
// `getI18nInstance()` é idempotente — chamadas subsequentes retornam a mesma
// instance sem re-init.
const i18nInstance = getI18nInstance();

export function I18nClientProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Roda 1x no mount do provider (que é o root client component). Async
    // mas fire-and-forget — children renderam imediatamente com o lng
    // inicial e re-renderam quando languageChanged dispara.
    void initializeLocale();
  }, []);

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}
