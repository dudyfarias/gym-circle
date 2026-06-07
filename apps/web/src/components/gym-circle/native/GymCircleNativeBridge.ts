import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Sprint 8.1 — Bridge TS pra plugin Capacitor `GymCircleNativeBridge`.
 *
 * Estratégia híbrida: web (Next.js dentro do WKWebView) pode pedir pra
 * surfaces SwiftUI nativas serem apresentadas via UIHostingController.
 * Reusa session Supabase armazenada no iOS Keychain pelo Capacitor Auth.
 *
 * O plugin Swift correspondente:
 *   ios/App/App/Plugins/GymCircleNativeBridgePlugin.swift
 *
 * Quando rodando em platforms NÃO-iOS (web browser, Android atual sem
 * SwiftUI), todas as chamadas rejeitam com mensagem clara — caller deve
 * cair pro fluxo web existente.
 */

export interface GymCircleNativeBridgePlugin {
  /**
   * Verifica se o plugin está disponível neste device + build. Retorna
   * `false` quando: plataforma não é iOS, plugin Swift não foi adicionado
   * ao Xcode project, ou Capacitor não detectou o plugin no boot.
   */
  isAvailable(): Promise<{ available: boolean }>;

  /**
   * Apresenta MyCircleView nativo full-screen. Quando user fecha (botão
   * Voltar ou swipe), o promise resolve. Bridge SwiftUI executa toda
   * logic isoladamente — não há callbacks intermediários.
   *
   * @param userId — ID do user dono do MyCircle (próprio user ou outro
   *                 com follow accepted)
   * @param isOwn  — true quando userId é o currentUser (sprint 7.5
   *                 features só pra próprio user)
   */
  presentMyCircleNative(opts: { userId: string; isOwn?: boolean }): Promise<void>;

  /**
   * Sprint 8.4 — Apresenta AchievementDetailView nativo full-screen pra
   * um achievement específico.
   *
   * @param compositeId — formato "kind:id" ou "challenge:periodKey:id"
   * @param userId      — user dono do achievement (pra resolver
   *                      earned_at, count, etc)
   */
  presentAchievementDetail(opts: {
    compositeId: string;
    userId: string;
  }): Promise<void>;

  /**
   * Sprint 8.6 — Apresenta AchievementCelebrationView com particle
   * effects nativos quando user ganha achievement.
   */
  presentCelebration(opts: {
    compositeId: string;
    userId: string;
  }): Promise<void>;

  /**
   * Sprint 8.5 — Apresenta AchievementsView (Hall da Fama nativo) com
   * 6 tabs + sub-seções.
   */
  presentAchievementsHub(opts: { userId: string }): Promise<void>;

  /**
   * Sprint 9.1 — Apresenta OtherProfileView (perfil de outro user) com
   * Follow/Msg/Flag/Block + LatestPostPreview + posts grid.
   *
   * @param targetUserId  — user dono do perfil sendo visitado
   * @param currentUserId — user autenticado (pra Follow CTA state)
   */
  presentOtherProfile(opts: {
    targetUserId: string;
    currentUserId: string;
  }): Promise<void>;

  /**
   * Sprint 9.1 — Apresenta EditProfileSheet pro user autenticado.
   * Save dispara update server-side automaticamente.
   */
  presentEditProfile(opts: { userId: string }): Promise<void>;

  /**
   * Sprint 9.1 — Apresenta MonthlyRecapSheet (canvas poster + share).
   *
   * @param userId   — user dono do recap
   * @param monthKey — opcional "YYYY-MM"; default = mês corrente
   */
  presentMonthlyRecap(opts: {
    userId: string;
    monthKey?: string;
  }): Promise<void>;

  /**
   * Sprint 9.5.4 — capacitor addListener API. Usado pra escutar
   * eventos emitidos pelo SwiftUI host (inverse bridge).
   */
  addListener(
    eventName: string,
    listenerFunc: (data: unknown) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const GymCircleNativeBridgePluginInstance =
  registerPlugin<GymCircleNativeBridgePlugin>("GymCircleNativeBridge");

/**
 * Wrapper amigável que valida plataforma + disponibilidade antes de
 * invocar o plugin. Em cases de falha, retorna `false` pra caller
 * decidir entre erro ou fallback web.
 *
 * Pattern típico de uso (com feature flag):
 *
 *   const useNative = process.env.NEXT_PUBLIC_USE_NATIVE_MYCIRCLE === "true";
 *
 *   if (useNative && await GymCircleNativeBridge.isAvailable()) {
 *     await GymCircleNativeBridge.presentMyCircleNative({ userId });
 *   } else {
 *     setMyCircleOpenWeb(userId);
 *   }
 */
export const GymCircleNativeBridge = {
  /**
   * Conjunto check: plataforma iOS + Capacitor nativo + plugin registrado.
   * Cacheia o resultado pra não fazer roundtrip a cada call.
   */
  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    if (Capacitor.getPlatform() !== "ios") return false;
    try {
      const result = await GymCircleNativeBridgePluginInstance.isAvailable();
      return result?.available ?? false;
    } catch {
      // Plugin não registrado ou Xcode project não tem o plugin file
      return false;
    }
  },

  async presentMyCircleNative(opts: {
    userId: string;
    isOwn?: boolean;
  }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentMyCircleNative(opts);
  },

  async presentAchievementDetail(opts: {
    compositeId: string;
    userId: string;
  }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentAchievementDetail(opts);
  },

  async presentCelebration(opts: {
    compositeId: string;
    userId: string;
  }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentCelebration(opts);
  },

  async presentAchievementsHub(opts: { userId: string }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentAchievementsHub(opts);
  },

  async presentOtherProfile(opts: {
    targetUserId: string;
    currentUserId: string;
  }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentOtherProfile(opts);
  },

  async presentEditProfile(opts: { userId: string }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentEditProfile(opts);
  },

  async presentMonthlyRecap(opts: {
    userId: string;
    monthKey?: string;
  }): Promise<void> {
    return GymCircleNativeBridgePluginInstance.presentMonthlyRecap(opts);
  },

  /**
   * Sprint 9.5.4 — registra listener pra eventos que a tela SwiftUI
   * dispara de volta pro JS (inverse bridge).
   *
   * Eventos emitidos pelo NativeOtherProfileHost:
   *   - "openChat": { userId } — user tocou em "Mensagem"
   *   - "reportUser": { userId } — user tocou em "Reportar"
   *   - "blockUser": { userId } — user tocou em "Bloquear"
   *   - "openPost": { postId } — user tocou num post do grid
   *
   * Retorna função pra remover o listener (cleanup).
   */
  async addListener<T = Record<string, unknown>>(
    eventName: string,
    handler: (data: T) => void,
  ): Promise<{ remove: () => Promise<void> }> {
    const handle = await GymCircleNativeBridgePluginInstance.addListener(
      eventName,
      handler as (data: unknown) => void,
    );
    return handle as { remove: () => Promise<void> };
  },
};
