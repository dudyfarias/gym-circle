import type { LiveStrengthSet } from "./workoutSession";

export type ExerciseLoadType = NonNullable<LiveStrengthSet["loadType"]>;

const VALID_LOAD_TYPES: ReadonlyArray<ExerciseLoadType> = [
  "external",
  "bodyweight",
  "assisted",
  "not_provided",
];

function normalizeLoadType(
  value: LiveStrengthSet["loadType"],
): ExerciseLoadType {
  return VALID_LOAD_TYPES.includes(value as ExerciseLoadType)
    ? (value as ExerciseLoadType)
    : "not_provided";
}

/**
 * Resolve o padrão visual do exercício a partir de sessões antigas, nas quais
 * cada série podia ter um tipo diferente. O tipo mais frequente vence; em
 * empate preservamos o primeiro encontrado para não surpreender o usuário.
 */
export function resolveExerciseLoadType(
  sets: ReadonlyArray<LiveStrengthSet>,
): ExerciseLoadType {
  if (sets.length === 0) return "not_provided";

  const counts = new Map<ExerciseLoadType, number>();
  const order: ExerciseLoadType[] = [];
  for (const set of sets) {
    const loadType = normalizeLoadType(set.loadType);
    if (!counts.has(loadType)) order.push(loadType);
    counts.set(loadType, (counts.get(loadType) ?? 0) + 1);
  }

  return order.reduce((best, candidate) =>
    (counts.get(candidate) ?? 0) > (counts.get(best) ?? 0) ? candidate : best,
  );
}

/**
 * Aplica a escolha do exercício a todas as suas séries. Cargas digitadas ficam
 * preservadas no estado da sessão para o caso de o usuário voltar ao tipo
 * anterior; a serialização final já remove os campos incompatíveis com o tipo
 * ativo, portanto bodyweight/not_provided nunca viram volume externo.
 */
export function applyExerciseLoadType(
  sets: ReadonlyArray<LiveStrengthSet>,
  setClientIds: ReadonlySet<string>,
  loadType: ExerciseLoadType,
): LiveStrengthSet[] {
  let changed = false;
  const next = sets.map((set) => {
    if (!setClientIds.has(set.clientId) || set.loadType === loadType)
      return set;
    changed = true;
    return { ...set, loadType };
  });
  return changed ? next : (sets as LiveStrengthSet[]);
}
