"use client";

/**
 * OrientationService — Sprint 4.1.
 *
 * Lock do app em PORTRAIT em todas as plataformas. Defense in depth:
 *
 *   1. iOS Info.plist (`UISupportedInterfaceOrientations` = portrait only) —
 *      Apple lê esse arquivo em tempo de boot do app native. Autoritativo.
 *      Mesmo se o WebView interno tentar girar, o container UIView não
 *      acompanha. Bloqueio mais "duro" possível.
 *
 *   2. Esta camada JS (`@capacitor/screen-orientation`) — chama `lock("portrait")`
 *      no boot do React. Cobre:
 *      - Android (Info.plist é iOS-only).
 *      - Edge cases em iOS onde algum componente do WebView tente forçar
 *        rotação CSS-based.
 *      - Web standalone (PWA): suportado em alguns navegadores via Screen
 *        Orientation API.
 *
 *   3. CSS fallback (em globals.css) — `@media (orientation: landscape)` mostra
 *      overlay "vire o celular" se as 2 camadas anteriores falharem (raro:
 *      desktop browser, ou web tab sem fullscreen). Já garantido visualmente.
 *
 * Idempotente: chamar `lockPortrait()` várias vezes é seguro. Cacheia o
 * dynamic import e silencia falhas (Capacitor inexistente = web puro).
 *
 * Decisão consciente — NÃO usar `unlock()`: o app é portrait-only por
 * design. Sem screens "internamente landscape" (ex: photo viewer fullscreen
 * que algumas vezes destrava — Instagram faz isso). Se um dia precisar,
 * adicionar `unlockTemporarily(callback)` que faz unlock → run → lock de
 * volta no finally.
 */

type ScreenOrientationModule =
  typeof import("@capacitor/screen-orientation");

let cachedModule: Promise<ScreenOrientationModule | null> | null = null;

function loadModule(): Promise<ScreenOrientationModule | null> {
  if (cachedModule) return cachedModule;
  cachedModule = (async () => {
    try {
      const mod = await import("@capacitor/screen-orientation");
      return mod;
    } catch {
      // Capacitor plugin não disponível (Next dev em browser puro, web sem
      // PWA). Silencia — vamos cair no fallback do CSS / Web Screen
      // Orientation API.
      return null;
    }
  })();
  return cachedModule;
}

/**
 * Tenta o lock via Web Screen Orientation API (Chromium/Edge support).
 * Safari iOS WebKit não suporta — mas nesse caso o native Info.plist
 * (camada 1) já cobre.
 *
 * Type-safe access via narrow: `screen.orientation.lock` é experimental,
 * não está no TS lib.dom.d.ts default ainda em alguns targets, então
 * usamos optional chain + typeof.
 */
async function tryWebLock(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & {
        lock?: (orientation: "portrait" | "any") => Promise<void>;
      })
    | undefined;
  if (!orientation || typeof orientation.lock !== "function") return false;
  try {
    await orientation.lock("portrait");
    return true;
  } catch {
    // Falha comum: documento não está em fullscreen (Web Lock API exige
    // pra alguns engines). Não loga ruído.
    return false;
  }
}

/**
 * Lock principal — chamado no boot do app. Idempotente.
 *
 * Estratégia:
 *   1. Tenta Capacitor primeiro (cobre native + alguns webs)
 *   2. Fallback pra Web Screen Orientation API
 *   3. Se ambos falham, CSS overlay assume (camada 3)
 */
export async function lockPortrait(): Promise<void> {
  const mod = await loadModule();
  if (mod?.ScreenOrientation) {
    try {
      await mod.ScreenOrientation.lock({ orientation: "portrait" });
      return;
    } catch {
      // Capacitor presente mas lock falhou (raro). Tenta web fallback.
    }
  }
  await tryWebLock();
}
