"use client";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  getI18nInstance,
} from "./config";

/**
 * LocaleService — Sprint 4.2.
 *
 * Resolve qual idioma usar e persiste a escolha do user.
 *
 * Ordem de prioridade (primeira não-nula vence):
 *   1. `localStorage.getItem("gc-locale")` — escolha explícita do user
 *      via Settings sheet. Persiste entre sessões e re-abrir do app.
 *   2. `@capacitor/device.getLanguageCode()` — idioma do sistema operacional
 *      do iPhone/Android. Só consultado na PRIMEIRA abertura (quando
 *      localStorage está vazio).
 *   3. `navigator.language` — fallback web puro (PWA sem Capacitor).
 *   4. `DEFAULT_LOCALE` ("pt-BR") — último recurso.
 *
 * Mapeamento de codes: Capacitor/browser retornam codes BCP-47 tipo
 * "pt", "pt-BR", "en", "en-US", "en-GB". Normalizamos pra nossos 2
 * supported locales: qualquer "pt*" → "pt-BR", qualquer "en*" → "en".
 * Outros idiomas caem no DEFAULT_LOCALE.
 *
 * API:
 *   - `resolveInitialLocale()` async — chamada no boot do app.
 *   - `getCurrentLocale()` sync — leitura rápida do estado atual.
 *   - `setLocale(locale)` async — persiste + atualiza i18next.
 */

const STORAGE_KEY = "gc-locale";

function normalize(rawCode: string | null | undefined): SupportedLocale | null {
  if (!rawCode) return null;
  const lower = rawCode.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("en")) return "en";
  return null;
}

function readFromStorage(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalize(raw);
  } catch {
    // localStorage pode falhar em privacy mode ou contextos sem origin.
    // Cai silente pra próxima fonte.
    return null;
  }
}

function writeToStorage(locale: SupportedLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Idem read — falha silente. Próxima abertura volta a detectar.
  }
}

type DeviceModule = typeof import("@capacitor/device");

let cachedDeviceModule: Promise<DeviceModule | null> | null = null;

function loadDeviceModule(): Promise<DeviceModule | null> {
  if (cachedDeviceModule) return cachedDeviceModule;
  cachedDeviceModule = (async () => {
    try {
      return await import("@capacitor/device");
    } catch {
      // Plugin não disponível (Next dev em browser puro, web sem PWA).
      // Cai pra navigator.language.
      return null;
    }
  })();
  return cachedDeviceModule;
}

async function detectFromDevice(): Promise<SupportedLocale | null> {
  const mod = await loadDeviceModule();
  if (!mod?.Device) return null;
  try {
    const result = await mod.Device.getLanguageCode();
    return normalize(result?.value);
  } catch {
    return null;
  }
}

function detectFromBrowser(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  return normalize(window.navigator?.language);
}

/**
 * Detecta o melhor locale na ordem de prioridade. Chamada UMA vez no boot.
 * Posterior `setLocale()` sobrescreve.
 */
export async function resolveInitialLocale(): Promise<SupportedLocale> {
  const stored = readFromStorage();
  if (stored) return stored;
  const fromDevice = await detectFromDevice();
  if (fromDevice) {
    // Persiste o detect inicial pra fixar a escolha automática nas
    // próximas aberturas — evita re-detectar toda vez (e dá previsibilidade
    // se o user mudar o idioma do sistema sem querer afetar o app).
    writeToStorage(fromDevice);
    return fromDevice;
  }
  const fromBrowser = detectFromBrowser();
  if (fromBrowser) {
    writeToStorage(fromBrowser);
    return fromBrowser;
  }
  writeToStorage(DEFAULT_LOCALE);
  return DEFAULT_LOCALE;
}

/**
 * Atualiza o locale ativo no i18next e persiste no localStorage.
 * Idempotente — chamar com o mesmo locale é no-op.
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  const instance = getI18nInstance();
  if (instance.language === locale) return;
  writeToStorage(locale);
  await instance.changeLanguage(locale);
}

/**
 * Leitura síncrona do locale atual. Em SSR retorna o default.
 */
export function getCurrentLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const instance = getI18nInstance();
  const lang = instance.language;
  if (lang === "pt-BR" || lang === "en") return lang;
  return DEFAULT_LOCALE;
}

/**
 * Inicializa o i18n com o locale resolvido. Chamada do `AppBootEffects`
 * no mount do app.
 */
export async function initializeLocale(): Promise<SupportedLocale> {
  const instance = getI18nInstance();
  const resolved = await resolveInitialLocale();
  if (instance.language !== resolved) {
    await instance.changeLanguage(resolved);
  }
  return resolved;
}
