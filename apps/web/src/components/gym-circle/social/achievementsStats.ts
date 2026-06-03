import type { SupabaseClient } from "@supabase/supabase-js";
import { getAchievementCompositeId, type Achievement } from "./achievements";

/**
 * Sprint 7.5.8 — Estatísticas globais + lazy backfill de achievements.
 *
 * Duas responsabilidades coesas:
 *
 * 1. **Lazy backfill** (`backfillUserAchievements`)
 *    No boot, compara achievements derivados (getAllAchievements) com
 *    user_achievements DB. Para cada earned que NÃO está no DB, faz
 *    insert. Idempotente — chamar 2x não duplica. earned_at vira now()
 *    (sacrifica precisão histórica pra simplicidade — alternativa seria
 *    inferir do primeiro post qualificador).
 *
 * 2. **Global percent stats** (`getAchievementGlobalPercent`)
 *    Chama RPC get_achievement_global_stats. Cache in-memory por
 *    achievement_id com TTL 5min — evita refetch quando user navega
 *    overlay back/forward em sequência.
 *
 * IMPORTANTE: stats só fazem sentido quando há backfill. Por isso este
 * arquivo agrupa as 2 funções — a documentação fica clara que stats sem
 * backfill = "0% dos usuários" pra tudo (misleading).
 */

type CachedStats = {
  percent: number | null;
  timestamp: number;
};

const STATS_CACHE = new Map<string, CachedStats>();
const STATS_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Limpa o cache em memória. Útil pra tests ou quando user sabe que
 * volume mudou bruscamente (ex: import em massa).
 */
export function clearAchievementStatsCache(): void {
  STATS_CACHE.clear();
}

/**
 * Retorna % de users que possuem o achievement. Null quando:
 *   - earned_count = 0 (achievement não foi conquistado por ninguém)
 *   - total_users = 0 (DB vazio — edge case)
 *   - Query falha (network/RLS)
 *
 * Cache 5min in-memory. Cold call dispara RPC.
 */
export async function getAchievementGlobalPercent(
  client: SupabaseClient,
  achievementId: string,
): Promise<number | null> {
  const cached = STATS_CACHE.get(achievementId);
  if (cached && Date.now() - cached.timestamp < STATS_TTL_MS) {
    return cached.percent;
  }

  try {
    const { data, error } = await client.rpc("get_achievement_global_stats", {
      p_achievement_id: achievementId,
    });
    if (error) throw error;

    // RPC retorna array com 1 row (RETURNS TABLE)
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      STATS_CACHE.set(achievementId, { percent: null, timestamp: Date.now() });
      return null;
    }

    const earned = Number(row.earned_count ?? 0);
    const total = Number(row.total_users ?? 0);
    const percent = total === 0 || earned === 0 ? null : (earned / total) * 100;

    STATS_CACHE.set(achievementId, { percent, timestamp: Date.now() });
    return percent;
  } catch (err) {
    console.warn(`[achievementsStats] global percent failed for ${achievementId}:`, err);
    return null;
  }
}

/**
 * Backfill no boot: insere em user_achievements os achievements earned
 * que ainda não estão lá. Idempotente, fire-and-forget.
 *
 * Estratégia:
 *   1. Carrega TODOS achievement_ids já em user_achievements pro user
 *   2. Filtra achievements derivados earned não presentes
 *   3. Bulk insert com upsert (silencia conflitos)
 *
 * Trade-off: earned_at = now() perde precisão histórica. Migração mais
 * sofisticada inferiria do primeiro post qualificador. Por simplicidade
 * MVP, usamos now().
 *
 * Quando achievements já têm count > 1 (repeatable trophies), apenas
 * atualizamos last_earned_at + increment count. Por hora, mantemos como
 * count=1 — repeatable logic fica pra sub-fase futura.
 */
export async function backfillUserAchievements(
  client: SupabaseClient,
  userId: string,
  achievements: ReadonlyArray<Achievement>,
): Promise<void> {
  try {
    // 1. Read existing
    const { data: existingRows, error: readError } = await client
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId);
    if (readError) throw readError;

    const existing = new Set(
      ((existingRows ?? []) as Array<{ achievement_id: string }>).map(
        (r) => r.achievement_id,
      ),
    );

    // 2. Filter earned NOT in DB
    const now = new Date().toISOString();
    const toInsert = achievements
      .filter((a) => a.earned)
      .map((a) => getAchievementCompositeId(a))
      .filter((id) => !existing.has(id))
      .map((id) => ({
        user_id: userId,
        achievement_id: id,
        earned_at: now,
        last_earned_at: now,
        count: 1,
        metadata: {},
      }));

    if (toInsert.length === 0) return;

    // 3. Bulk upsert (idempotente)
    const { error: insertError } = await client
      .from("user_achievements")
      .upsert(toInsert, { onConflict: "user_id,achievement_id" });
    if (insertError) throw insertError;
  } catch (err) {
    console.warn("[achievementsStats] backfill failed:", err);
  }
}

/**
 * Formata percent com precisão variável por magnitude. Caller passa o
 * raw percent (0–100). Retorna string já com símbolo "%".
 *
 *   0           → null (sem dados, esconder)
 *   0.001–0.099 → "0.01%" / "0.05%" (2 decimal — relíquias raríssimas)
 *   0.10–0.99   → "0.10%" / "0.50%" / "0.99%" (1 decimal)
 *   1.0–9.9     → "1.5%" / "9.9%" (1 decimal — alta raridade)
 *   10–100      → "23%" / "100%" (integer — comum)
 *
 * Locale-aware separator (vírgula em PT-BR, ponto em EN).
 */
export function formatRarityPercent(
  percent: number | null,
  locale: string,
): string | null {
  if (percent === null || percent <= 0) return null;

  let decimals: number;
  if (percent < 0.1) decimals = 2;
  else if (percent < 1) decimals = 2;
  else if (percent < 10) decimals = 1;
  else decimals = 0;

  // Cap em 0.01% no display (não mostra 0.001%)
  const value = percent < 0.01 ? 0.01 : percent;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return `${formatted}%`;
}
