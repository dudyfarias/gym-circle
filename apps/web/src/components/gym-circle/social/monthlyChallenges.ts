import type { SupabaseClient } from "@supabase/supabase-js";
import type { AchievementRarity } from "./achievements";

/**
 * Sprint 7.5.6 — Monthly Challenges client-side service.
 *
 * Lê desafios mensais + progresso individual do user. Cada boot:
 *   1. Resolve período corrente (YYYY-MM, timezone SP)
 *   2. Query monthly_challenges where period_key=current → 4 challenges
 *   3. Query user_monthly_challenge_progress where user_id=me AND
 *      challenge_id in (...) → progress per challenge
 *   4. Recompute progress comparando user.workoutDays com goal_kind
 *      + goal_target (caso DB esteja stale)
 *   5. UPDATE user_monthly_challenge_progress quando diff
 *
 * Retorna shape pronto pro AchievementsInput.monthlyChallenges +
 * MyCircleSheet card.
 *
 * Tipos locais (vs Database["public"]["Tables"]["X"]) pra contornar
 * symlink quirk do release branch — packages/core/database.types.ts
 * ainda não tem as 3 tables novas. Quando bump do release branch,
 * pode migrar pra Database type direto.
 */

type MonthlyChallengeRow = {
  id: string;
  period_key: string;
  title_pt: string;
  title_en: string;
  description_pt: string;
  description_en: string;
  // Sprint 22 — raridade direta (5 níveis). `difficulty` segue na tabela
  // (inerte) até o nativo migrar, mas o web lê `rarity`.
  rarity: string;
  goal_kind: string;
  goal_target: number;
  start_date: string;
  end_date: string;
  trophy_id: string;
  is_secret: boolean;
  goal_config: Record<string, unknown>;
  created_at: string;
};

type UserChallengeProgressRow = {
  user_id: string;
  challenge_id: string;
  progress: number;
  completed_at: string | null;
  updated_at: string;
};

export type MonthlyChallengeData = {
  id: string;
  periodKey: string;
  title: string; // já localizada
  description: string; // já localizada
  rarity: AchievementRarity;
  goalKind: string;
  goalTarget: number;
  trophyId: string;
  progress: number;
  completedAt: string | null;
  /**
   * Sprint 7.5.10 — quando true, UI esconde título/descrição até user
   * completar (mostra "???"). Revela ao ganhar — mesmo padrão dos
   * secret badges (Sprint 5.3).
   */
  isSecret: boolean;
  /**
   * Sprint 7.5.10 — parâmetros extras pro goal_kind. Shape depende:
   *   - workout_type_specific: { workout_type: string } (case-insensitive)
   */
  goalConfig: Record<string, unknown>;
};

/**
 * Resolve o período corrente em YYYY-MM, timezone America/Sao_Paulo.
 * Coerente com o pattern usado em buildMonthlyRecap (Sprint 5.5a).
 */
export function getCurrentPeriodKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(now);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  return `${byType.get("year")}-${byType.get("month")}`;
}

/**
 * Formata um period_key ("YYYY-MM") no nome do mês localizado.
 *
 * O label do card de desafios DEVE vir daqui — do período real dos desafios
 * carregados (getCurrentPeriodKey, SP) — e nunca da navegação do calendário
 * do MyCircle, senão "Desafios de {{mês}}" troca de mês mas a lista continua
 * a do mês corrente (bug do mês errado). Ancoramos no dia 15 ao meio-dia UTC
 * e formatamos em UTC pra o mês nunca "vazar" pro vizinho por fuso do device.
 */
export function formatChallengePeriodLabel(
  periodKey: string,
  locale: string,
): string {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";
  const date = new Date(Date.UTC(year, month - 1, 15, 12));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Carrega os desafios do período + progresso do user. Locale escolhe
 * qual variante de title/description usar.
 *
 * Quando user nunca teve progress salvo (primeira vez), insert defensive
 * com progress=0. Próximas chamadas atualizam via lazy upsert.
 */
export async function loadMonthlyChallenges(
  client: SupabaseClient,
  userId: string,
  options: { periodKey?: string; locale?: string } = {},
): Promise<MonthlyChallengeData[]> {
  const periodKey = options.periodKey ?? getCurrentPeriodKey();
  const locale = options.locale ?? "pt-BR";
  const usePtBR = locale.startsWith("pt");

  // 1. Challenges do período. Cast pelo symlink quirk — as tables novas
  // não estão no Database type ainda.
  const { data: rawChallenges, error: challengesError } = await client
    .from("monthly_challenges")
    .select(
      "id,period_key,title_pt,title_en,description_pt,description_en," +
        "rarity,goal_kind,goal_target,start_date,end_date,trophy_id," +
        "is_secret,goal_config,created_at",
    )
    .eq("period_key", periodKey);
  if (challengesError) throw challengesError;
  const challenges = (rawChallenges ?? []) as unknown as MonthlyChallengeRow[];
  if (challenges.length === 0) return [];

  // 2. Progresso do user pra esses challenges
  const challengeIds = challenges.map((c) => c.id);
  const { data: rawProgress, error: progressError } = await client
    .from("user_monthly_challenge_progress")
    .select("user_id,challenge_id,progress,completed_at,updated_at")
    .eq("user_id", userId)
    .in("challenge_id", challengeIds);
  if (progressError) throw progressError;

  const progressByChallenge = new Map(
    ((rawProgress ?? []) as UserChallengeProgressRow[]).map((p) => [
      p.challenge_id,
      p,
    ]),
  );

  return challenges.map((c) => {
    const progress = progressByChallenge.get(c.id);
    return {
      id: c.id,
      periodKey: c.period_key,
      title: usePtBR ? c.title_pt : c.title_en,
      description: usePtBR ? c.description_pt : c.description_en,
      rarity: c.rarity as MonthlyChallengeData["rarity"],
      goalKind: c.goal_kind,
      goalTarget: c.goal_target,
      trophyId: c.trophy_id,
      progress: progress?.progress ?? 0,
      completedAt: progress?.completed_at ?? null,
      isSecret: c.is_secret ?? false,
      goalConfig: c.goal_config ?? {},
    };
  });
}

/**
 * Snapshot mínimo de um post pra logic de challenge progress.
 */
export type ChallengePostSnapshot = {
  workoutDate: string;
  workoutType: string | null;
  /**
   * Fix pós-Sprint 13 — tags adicionais do post (workout_types array,
   * até 5). A contagem de tipos considera primária + adicionais; posts
   * antigos (array null) seguem só com a primária.
   */
  workoutTypes?: ReadonlyArray<string> | null;
  /**
   * Quando o post tem 1+ participante accepted (além do autor implícito,
   * ou seja, 2+ pessoas no total), conta como group workout. Caller deve
   * hidratar esse flag a partir de post_participants.
   */
  hasAcceptedGroup?: boolean;
  /**
   * Desafio Popstar — nº de mídias do post (carrossel Sprint 13/14).
   * Ausente = post single (1 mídia).
   */
  mediaCount?: number;
};

/**
 * Normaliza string pra comparação fuzzy: lowercase + remove acentos.
 * Permite match "Tênis" / "tenis" / "Tennis" pra mesma palavra-chave.
 */
function normalizeForCompare(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Dois dias `YYYY-MM-DD` são consecutivos? Comparação via timestamp UTC
 * meio-dia (imune a DST/timezone).
 */
function isNextCalendarDay(prev: string, next: string): boolean {
  const p = new Date(`${prev}T12:00:00Z`).getTime();
  const n = new Date(`${next}T12:00:00Z`).getTime();
  return n - p === 24 * 60 * 60 * 1000;
}

/**
 * Todos os tipos de treino de um post (primária + tags da Sprint 13),
 * já normalizados e dedupados.
 */
function postWorkoutTypes(post: ChallengePostSnapshot): string[] {
  const types = new Set<string>();
  if (post.workoutType?.trim()) {
    types.add(normalizeForCompare(post.workoutType));
  }
  for (const tag of post.workoutTypes ?? []) {
    if (tag?.trim()) types.add(normalizeForCompare(tag));
  }
  return [...types];
}

/**
 * Recompute progress de UM challenge a partir do estado social atual.
 *
 * Goal kinds suportados (Sprint 7.5.10 + Sprint 17):
 *   - workouts_in_month: dias treinados no período
 *   - workout_type_specific: posts com qualquer tag matching (config.workout_type)
 *   - group_workouts: posts com 1+ participante accepted (2+ pessoas no total)
 *   - distinct_types: tipos únicos no período (primária + tags Sprint 13)
 *   - streak_in_month: maior sequência de dias CONSECUTIVOS no período
 *   - perfect_month: dias distintos no período (seed define goal_target =
 *     nº de dias do mês → só completa com mês perfeito)
 *   - media_count_in_post: maior nº de mídias num ÚNICO post do período
 *     (desafio Popstar — barra mostra o melhor carrossel até agora)
 *
 * Goal kinds desconhecidos: fallback mantém valor atual.
 *
 * Retorna progress atualizado + flag se completou agora (pra trigger
 * UPDATE no DB).
 */
export function recomputeChallengeProgress(
  challenge: MonthlyChallengeData,
  context: {
    workoutDays: string[]; // YYYY-MM-DD do user
    posts?: ReadonlyArray<ChallengePostSnapshot>;
  },
): { progress: number; justCompleted: boolean } {
  let newProgress = challenge.progress;
  const postsInMonth = (context.posts ?? []).filter((p) =>
    p.workoutDate?.startsWith(challenge.periodKey),
  );

  switch (challenge.goalKind) {
    case "workouts_in_month": {
      const monthDays = context.workoutDays.filter((d) =>
        d.startsWith(challenge.periodKey),
      );
      newProgress = new Set(monthDays).size;
      break;
    }
    case "workout_type_specific": {
      const target = String(
        (challenge.goalConfig?.workout_type as string) ?? "",
      );
      if (!target) {
        newProgress = challenge.progress;
        break;
      }
      const targetNorm = normalizeForCompare(target);
      // Fix pós-Sprint 13: considera TODAS as tags do post (primária +
      // workout_types), não só a primária — tênis como 2ª tag conta.
      newProgress = postsInMonth.filter((p) =>
        postWorkoutTypes(p).some((type) => type.includes(targetNorm)),
      ).length;
      break;
    }
    case "group_workouts": {
      newProgress = postsInMonth.filter((p) => p.hasAcceptedGroup).length;
      break;
    }
    case "distinct_types": {
      const types = new Set<string>();
      for (const p of postsInMonth) {
        for (const type of postWorkoutTypes(p)) types.add(type);
      }
      newProgress = types.size;
      break;
    }
    case "streak_in_month": {
      // Sprint 17 (B4) — maior sequência de dias CONSECUTIVOS treinados
      // dentro do período. Gap de 1 dia zera a sequência corrente.
      const monthDays = [
        ...new Set(
          context.workoutDays.filter((d) => d.startsWith(challenge.periodKey)),
        ),
      ].sort();
      let best = 0;
      let run = 0;
      let prev: string | null = null;
      for (const day of monthDays) {
        run = prev !== null && isNextCalendarDay(prev, day) ? run + 1 : 1;
        if (run > best) best = run;
        prev = day;
      }
      newProgress = best;
      break;
    }
    case "media_count_in_post": {
      // Desafio Popstar — completa com UM post de goal_target mídias no
      // carrossel (limite do composer = 10, Sprint 14). Progress = melhor
      // post do período, então a barra motiva sem somar entre posts.
      newProgress = postsInMonth.reduce(
        (best, p) => Math.max(best, p.mediaCount ?? 1),
        0,
      );
      break;
    }
    case "perfect_month": {
      // Sprint 17 (B4) — dias distintos treinados no período. O seed
      // define goal_target = nº de dias do mês, então só completa com o
      // mês 100% treinado; o progress serve de barra motivacional.
      const monthDays = new Set(
        context.workoutDays.filter((d) => d.startsWith(challenge.periodKey)),
      );
      newProgress = monthDays.size;
      break;
    }
    default:
      break;
  }

  const wasIncomplete = challenge.completedAt === null;
  const isComplete = newProgress >= challenge.goalTarget;
  return {
    progress: newProgress,
    justCompleted: wasIncomplete && isComplete,
  };
}

/**
 * Persiste progress recomputado. Idempotente — upsert via insert + on
 * conflict update. Quando justCompleted=true, popula completed_at + grava
 * achievement_id em user_achievements (também idempotente).
 */
export async function syncChallengeProgress(
  client: SupabaseClient,
  userId: string,
  challenge: MonthlyChallengeData,
  result: ReturnType<typeof recomputeChallengeProgress>,
): Promise<void> {
  if (
    result.progress === challenge.progress &&
    !result.justCompleted
  )
    return; // nothing to sync

  // Sprint 17 (guard B5) — progresso persistido NUNCA regride. Recompute
  // com dados parciais (janela de posts incompleta, fetch que falhou)
  // escreveria um valor menor por engano; e por decisão de produto, post
  // deletado também não rebaixa desafio (mensal e motivacional, como os
  // anéis da Apple).
  if (result.progress < challenge.progress && !result.justCompleted) {
    return;
  }

  const completedAt = result.justCompleted
    ? new Date().toISOString()
    : challenge.completedAt;

  // Upsert progress. Symlink quirk casts.
  const { error: upsertError } = await client
    .from("user_monthly_challenge_progress")
    .upsert(
      {
        user_id: userId,
        challenge_id: challenge.id,
        progress: result.progress,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,challenge_id" },
    );
  if (upsertError) throw upsertError;

  // Quando completou agora, registra achievement
  if (result.justCompleted) {
    const achievementId = `challenge:${challenge.periodKey}:${challenge.id}`;
    const { error: achError } = await client
        .from("user_achievements")
      .upsert(
        {
          user_id: userId,
          achievement_id: achievementId,
          earned_at: new Date().toISOString(),
          last_earned_at: new Date().toISOString(),
          count: 1,
          metadata: { rarity: challenge.rarity, trophyId: challenge.trophyId },
        },
        { onConflict: "user_id,achievement_id" },
      );
    if (achError) {
      // Best-effort — não bloqueia. Próximo boot reconcilia.
      console.warn("Failed to register challenge achievement:", achError);
    }
  }
}
