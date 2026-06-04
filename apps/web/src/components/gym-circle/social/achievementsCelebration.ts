import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAchievementCompositeId,
  type Achievement,
} from "./achievements";

/**
 * Sprint 7.5.11 — Achievement Celebration tracking.
 *
 * Service pra detectar achievements ganhos mas ainda não celebrados
 * (celebrated_at IS NULL em user_achievements). Cada um vira card no
 * queue do AchievementCelebrationOverlay.
 *
 * Pipeline boot:
 *   1. loadUncelebratedAchievements(client, userId) → composite IDs
 *   2. Frontend cross-ref com getAllAchievements() pra resolver
 *      shape Achievement completo (label/description/iconKey/rarity/secret)
 *   3. Dispatch queue overlay um por vez
 *   4. User dismiss → markAchievementCelebrated(client, userId, id)
 *
 * Concurrency: chamadas idempotentes (mesmo composite ID 2x → 2º update
 * é no-op). Best-effort em erros.
 */

type UncelebratedRow = { achievement_id: string };

/**
 * Retorna composite IDs ("kind:id" ou "challenge:periodKey:id") dos
 * achievements ganhos mas ainda não celebrados pelo user.
 *
 * Lista ordenada por earned_at ASC pra mostrar primeiro o mais antigo
 * (UX: "você ganhou isso antes mas a gente não tinha celebrado").
 */
export async function loadUncelebratedAchievementIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
      .is("celebrated_at", null)
      .order("earned_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as UncelebratedRow[]).map((r) => r.achievement_id);
  } catch (err) {
    console.warn("[achievementsCelebration] load failed:", err);
    return [];
  }
}

/**
 * Resolve composite IDs em Achievement objects, usando o snapshot atual
 * vindo de getAllAchievements. IDs órfãos (achievement removido do
 * código ou challenge expirado) são silenciosamente ignorados.
 */
export function resolveAchievementsByCompositeIds(
  compositeIds: ReadonlyArray<string>,
  allAchievements: ReadonlyArray<Achievement>,
): Achievement[] {
  const result: Achievement[] = [];
  for (const compositeId of compositeIds) {
    const parsed = parseAchievementCompositeId(compositeId);
    if (!parsed) continue;
    const match = allAchievements.find((a) => {
      if (a.kind !== parsed.kind) return false;
      // Challenge composite tem 3 partes: precisa bater periodKey + id
      if (a.kind === "challenge" && parsed.periodKey !== undefined) {
        return a.periodKey === parsed.periodKey && a.id === parsed.id;
      }
      return a.id === parsed.id;
    });
    if (match) result.push(match);
  }
  return result;
}

/**
 * Marca um achievement como celebrado (user dispensou o overlay).
 * Idempotente: UPDATE on conflict idempotente. Best-effort — falha
 * só loga, próximo boot recoloca na queue (UX repete celebração 1x,
 * tolerável).
 */
export async function markAchievementCelebrated(
  client: SupabaseClient,
  userId: string,
  compositeId: string,
): Promise<void> {
  try {
    const { error } = await client
      .from("user_achievements")
      .update({ celebrated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("achievement_id", compositeId);
    if (error) throw error;
  } catch (err) {
    console.warn("[achievementsCelebration] mark failed:", err);
  }
}

/**
 * Marca TODOS uncelebrated do user de uma vez. Usado quando user
 * dispensa "Pular tudo" no queue (várias celebrações pendentes).
 */
export async function markAllAchievementsCelebrated(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const { error } = await client
      .from("user_achievements")
      .update({ celebrated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("celebrated_at", null);
    if (error) throw error;
  } catch (err) {
    console.warn("[achievementsCelebration] mark all failed:", err);
  }
}
