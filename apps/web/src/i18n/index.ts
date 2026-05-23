/**
 * Barrel pra api pública do i18n.
 * Mantém imports curtos: `import { useLocale, initializeLocale } from "@/i18n"`.
 */
export { DEFAULT_LOCALE, SUPPORTED_LOCALES, getI18nInstance } from "./config";
export type { SupportedLocale } from "./config";
export {
  initializeLocale,
  setLocale,
  getCurrentLocale,
  resolveInitialLocale,
} from "./LocaleService";
export { useLocale } from "./useLocale";
