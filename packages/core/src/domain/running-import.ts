import {
  normalizeRunningPlan,
  type RunningPlanImportDraft,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "./running";

const PARSER_VERSION = 2;
const HEADER_LINES = [
  /^corrida\s*[;:,.]?$/i,
  /^realizado\s*[;:,.]?$/i,
  /^treino\s*[;:,.]?$/i,
];
const URL_LINE = /^https?:\/\//i;
const URL_CONTINUATION_LINE = /^-[A-Za-z0-9_-]/;

type ImportSourceType = RunningPlanImportDraft["sourceType"];

export type ParseRunningPlanImportOptions = {
  sourceType?: ImportSourceType;
  sourceName?: string;
  sourceSha256?: string;
  sourceImageSha256?: string;
};

type ParsedStep = {
  confidence: number;
  line: string;
  step: RunningWorkoutPlanStepDraft;
};

type ParsedRecovery = {
  recoveryType: RunningWorkoutPlanStepDraft["recoveryType"];
  recoveryDurationS?: number;
  recoveryDistanceM?: number;
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function compactLine(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[’´`]/g, "'")
    .replace(/[×]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function repairNumericOcr(value: string) {
  return value
    .replace(/\b(?=[0-9Oo]*[0-9])[0-9Oo]+\b/g, (token) =>
      token.replace(/[Oo]/g, "0"),
    )
    .replace(/\b[zZ]\s*[lI|]\b/g, "Z1")
    .replace(/\btrein0\b/gi, "TREINO")
    .replace(/\bintervalad0\b/gi, "INTERVALADO")
    .replace(/\bdesaqueciment0\b/gi, "DESAQUECIMENTO")
    .replace(/\baqueciment0\b/gi, "AQUECIMENTO")
    .replace(/(\d)\s*:\s*(\d{2})/g, "$1:$2")
    .replace(/(\d)\s*\/\s*km\b/gi, "$1/km");
}

function decimal(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function secondsPerKm(minutes: string, seconds: string) {
  const parsedMinutes = Number.parseInt(minutes, 10);
  const parsedSeconds = Number.parseInt(seconds, 10);
  if (
    !Number.isFinite(parsedMinutes) ||
    !Number.isFinite(parsedSeconds) ||
    parsedMinutes < 0 ||
    parsedSeconds < 0 ||
    parsedSeconds > 59
  ) {
    return null;
  }
  return parsedMinutes * 60 + parsedSeconds;
}

function orderedPair(first: number, second: number) {
  return first <= second ? [first, second] : [second, first];
}

function unitSeconds(value: number, unit: string) {
  return /^h/i.test(unit)
    ? value * 3600
    : /^m/i.test(unit)
      ? value * 60
      : value;
}

function unitMeters(value: number, unit: string) {
  return /^km/i.test(unit) ? value * 1000 : value;
}

function extractUrls(rawText: string) {
  const joinedWrappedUrls = rawText.replace(
    /(https?:\/\/[^\s]+)\s*\n\s*(-[A-Za-z0-9_-][^\s]*)/g,
    "$1$2",
  );
  return joinedWrappedUrls.match(/https?:\/\/[^\s]+/g) ?? [];
}

function mergeWrappedLines(lines: string[]) {
  const merged: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const numberedPrescription =
      /^\d+[.)]\s*(?:correr|corrida)\b/i.test(line);
    if (!numberedPrescription) {
      merged.push(line);
      continue;
    }

    const parts = [line];
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (
        /^\d+[.)]\s*(?:correr|corrida)\b/i.test(next) ||
        /^(?:aquecimento|alongamento|educativo|desaquecimento)\s*:/i.test(
          next,
        ) ||
        URL_LINE.test(next)
      ) {
        break;
      }
      parts.push(next);
      index += 1;
    }
    merged.push(compactLine(parts.join(" ")));
  }
  return merged;
}

function prepareLines(rawText: string) {
  return mergeWrappedLines(
    rawText
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => compactLine(repairNumericOcr(line)))
      .filter(Boolean),
  );
}

function parsePaceRange(line: string) {
  const normalized = fold(line);
  const match = normalized.match(
    /(\d{1,2})[:'](\d{2})\s*(?:a|ate|[-–—])\s*(\d{1,2})[:'](\d{2})(?:\s*\/?\s*km|\s*(?:pace|ritmo|pac[ce]))?/i,
  );
  if (!match) return null;
  const hasPaceContext =
    /\/\s*km|pace|ritmo|pac[ce]/i.test(normalized) ||
    /\(\s*\d{1,2}[:']\d{2}/.test(normalized);
  if (!hasPaceContext) return null;
  const first = secondsPerKm(match[1], match[2]);
  const second = secondsPerKm(match[3], match[4]);
  if (first == null || second == null) return null;
  const [paceMinSPerKm, paceMaxSPerKm] = orderedPair(first, second);
  return { paceMinSPerKm, paceMaxSPerKm };
}

function parseZone(line: string) {
  const match = fold(line).match(/\bz(?:ona\s*)?([1-5])\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseDurationRange(line: string) {
  const match = fold(line).match(
    /(\d{1,4})\s*(?:a|ate|[-–—])\s*(\d{1,4})\s*(horas?|hrs?|h|minutos?|mins?|min|segundos?|segs?|seg|s|["'])(?:\b|$)/i,
  );
  if (!match) return null;
  const first = positiveInteger(match[1]);
  const second = positiveInteger(match[2]);
  if (first == null || second == null) return null;
  const [durationMinS, durationMaxS] = orderedPair(
    unitSeconds(first, match[3]),
    unitSeconds(second, match[3]),
  );
  return { durationMinS, durationMaxS };
}

function parseSingleDuration(line: string) {
  const match = fold(line).match(
    /(\d{1,4})\s*(horas?|hrs?|h|minutos?|mins?|min|segundos?|segs?|seg|s|["'])(?:\b|$)/i,
  );
  if (!match) return null;
  const value = positiveInteger(match[1]);
  return value == null ? null : unitSeconds(value, match[2]);
}

function parseDistanceRange(line: string) {
  const normalized = fold(line);
  const matches = Array.from(
    normalized.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(?:a|ate|[-–—])\s*(\d+(?:[.,]\d+)?)\s*(km|metros?|m)\b/gi,
    ),
  );
  const match = matches.find((candidate) => {
    const end = candidate.index + candidate[0].length;
    return !/^\s*\/?\s*h\b/i.test(normalized.slice(end));
  });
  if (!match) return null;
  const first = decimal(match[1]);
  const second = decimal(match[2]);
  if (first == null || second == null) return null;
  const [distanceMinM, distanceMaxM] = orderedPair(
    unitMeters(first, match[3]),
    unitMeters(second, match[3]),
  );
  return { distanceMinM, distanceMaxM };
}

function parseSingleDistance(line: string) {
  const matches = Array.from(
    fold(line).matchAll(/(\d+(?:[.,]\d+)?)\s*(km|metros?|m)\b/gi),
  );
  const match = matches.find((candidate) => {
    const end = candidate.index + candidate[0].length;
    return !/^\s*\/?\s*h\b/i.test(fold(line).slice(end));
  });
  if (!match) return null;
  const value = decimal(match[1]);
  return value == null ? null : unitMeters(value, match[2]);
}

function recoveryKind(line: string) {
  const normalized = fold(line);
  if (/caminh/.test(normalized)) return "walking" as const;
  if (/trote|leve|jog/.test(normalized)) return "easy_jog" as const;
  if (/parad|estatic/.test(normalized)) return "standing" as const;
  return "duration" as const;
}

function parseRecovery(line: string): ParsedRecovery | null {
  const normalized = fold(line);
  const marker = normalized.search(
    /recup\w{0,6}(?:cao|ção)|descanso|pausa|\/\s*\d/,
  );
  if (marker < 0) return null;
  const segment = line.slice(marker);
  const distance = parseSingleDistance(segment);
  if (distance != null) {
    return { recoveryType: "distance", recoveryDistanceM: distance };
  }
  const duration = parseSingleDuration(segment);
  if (duration == null) return null;
  return {
    recoveryType: recoveryKind(segment),
    recoveryDurationS: duration,
  };
}

function completionRange(line: string) {
  const match = fold(line).match(
    /completar\s+entre\s+(\d{1,3})[':](\d{2})"?\s+e\s+(\d{1,3})[':](\d{2})"?/i,
  );
  if (!match) return null;
  const first = secondsPerKm(match[1], match[2]);
  const second = secondsPerKm(match[3], match[4]);
  if (first == null || second == null) return null;
  const [minS, maxS] = orderedPair(first, second);
  return { minS, maxS };
}

function speedRange(line: string) {
  const match = fold(line).match(
    /(\d{1,2}(?:[.,]\d+)?)\s*a\s*(\d{1,2}(?:[.,]\d+)?)\s*km\s*\/?\s*h/i,
  );
  if (!match) return null;
  const first = decimal(match[1]);
  const second = decimal(match[2]);
  if (first == null || second == null) return null;
  const [minKmh, maxKmh] = orderedPair(first, second);
  return { minKmh, maxKmh };
}

function stepTypeForLine(
  line: string,
  zone: number | null,
): RunningWorkoutPlanStepDraft["stepType"] {
  const normalized = fold(line);
  if (/desaquec|volta a calma/.test(normalized)) return "cooldown";
  if (/aquec/.test(normalized)) return "warmup";
  if (/educativo|drill/.test(normalized)) return "drill";
  if (/fartlek|tiros?|interval/.test(normalized)) return "interval";
  if (intervalTarget(line) || intervalDurationRange(line)) return "interval";
  if (/recup/.test(normalized)) return "recovery";
  if (/longao|long run/.test(normalized)) return "long_run";
  if (/tempo run|ritmo de prova/.test(normalized)) return "tempo";
  if (/limiar|threshold/.test(normalized)) return "threshold";
  if (/progressiv/.test(normalized)) return "progression";
  if (/subida|hill/.test(normalized)) return "hill";
  if (/caminh/.test(normalized)) return "walk";
  if (/leve|easy/.test(normalized) || zone === 1) return "easy";
  if (/moderad|steady/.test(normalized) || zone === 2) return "steady";
  return "free";
}

function titleForStep(
  line: string,
  stepType: RunningWorkoutPlanStepDraft["stepType"],
  zone: number | null,
) {
  const labels: Record<RunningWorkoutPlanStepDraft["stepType"], string> = {
    warmup: "Aquecimento",
    easy: "Corrida leve",
    steady: "Corrida moderada",
    recovery: "Recuperação",
    interval: /fartlek/i.test(fold(line)) ? "Fartlek" : "Intervalado",
    tempo: "Tempo run",
    threshold: "Limiar",
    progression: "Progressivo",
    long_run: "Longão",
    walk: "Caminhada",
    cooldown: "Desaquecimento",
    drill: "Educativo",
    hill: "Subida",
    free: "Corrida",
  };
  return zone ? `${labels[stepType]} · Z${zone}` : labels[stepType];
}

function intervalTarget(line: string) {
  const normalized = fold(line);
  const match = normalized.match(
    /(?:\b(\d{1,3})\s*x\s*|\b(\d{1,3})\s+tiros?\s+(?:de\s+)?)(\d+(?:[.,]\d+)?)\s*(km|metros?|m|minutos?|mins?|min|segundos?|segs?|seg|s)\b/i,
  );
  if (!match) return null;
  const repetitions = positiveInteger(match[1] ?? match[2]);
  const value = decimal(match[3]);
  if (repetitions == null || value == null || value <= 0) return null;
  const unit = match[4];
  if (/^(?:km|metros?|m)$/i.test(unit)) {
    return {
      repetitions,
      targetBasis: "distance" as const,
      distanceM: unitMeters(value, unit),
    };
  }
  return {
    repetitions,
    targetBasis: "duration" as const,
    durationS: unitSeconds(value, unit),
  };
}

function intervalDurationRange(line: string) {
  const match = fold(line).match(
    /\b(\d{1,3})\s*x\s*(\d{1,4})\s*(?:a|ate|[-–—])\s*(\d{1,4})\s*(minutos?|mins?|min|segundos?|segs?|seg|s|["'])(?:\b|$)/i,
  );
  if (!match) return null;
  const repetitions = positiveInteger(match[1]);
  const first = positiveInteger(match[2]);
  const second = positiveInteger(match[3]);
  if (repetitions == null || first == null || second == null) return null;
  const [durationMinS, durationMaxS] = orderedPair(
    unitSeconds(first, match[4]),
    unitSeconds(second, match[4]),
  );
  return { repetitions, durationMinS, durationMaxS };
}

function parseStep(line: string): ParsedStep | null {
  const normalized = fold(line);
  const zone = parseZone(line);
  const pace = parsePaceRange(line);
  const repeatedRange = intervalDurationRange(line);
  const interval = intervalTarget(line);
  const recovery = parseRecovery(line);
  const stepType = stepTypeForLine(line, zone);

  if (repeatedRange) {
    return {
      line,
      confidence: 0.94,
      step: {
        position: 0,
        stepType,
        title: titleForStep(line, stepType, zone),
        instructions: line,
        repetitions: repeatedRange.repetitions,
        targetBasis: "duration",
        durationMinS: repeatedRange.durationMinS,
        durationMaxS: repeatedRange.durationMaxS,
        paceMinSPerKm: pace?.paceMinSPerKm ?? null,
        paceMaxSPerKm: pace?.paceMaxSPerKm ?? null,
        heartRateZone: zone,
        recoveryType: recovery?.recoveryType ?? "none",
        recoveryDurationS: recovery?.recoveryDurationS ?? null,
        recoveryDistanceM: recovery?.recoveryDistanceM ?? null,
        metadata: /fartlek/i.test(normalized)
          ? { workoutStyle: "fartlek" }
          : {},
      },
    };
  }

  if (interval) {
    return {
      line,
      confidence: pace || zone || recovery ? 0.96 : 0.88,
      step: {
        position: 0,
        stepType:
          stepType === "free" || stepType === "easy"
            ? "interval"
            : stepType,
        title: titleForStep(
          line,
          stepType === "free" || stepType === "easy" ? "interval" : stepType,
          zone,
        ),
        instructions: line,
        repetitions: interval.repetitions,
        targetBasis: interval.targetBasis,
        distanceM:
          "distanceM" in interval ? interval.distanceM : null,
        durationS:
          "durationS" in interval ? interval.durationS : null,
        paceMinSPerKm: pace?.paceMinSPerKm ?? null,
        paceMaxSPerKm: pace?.paceMaxSPerKm ?? null,
        heartRateZone: zone,
        recoveryType: recovery?.recoveryType ?? "none",
        recoveryDurationS: recovery?.recoveryDurationS ?? null,
        recoveryDistanceM: recovery?.recoveryDistanceM ?? null,
        metadata: /fartlek/i.test(normalized)
          ? { workoutStyle: "fartlek" }
          : {},
      },
    };
  }

  const distanceRange = parseDistanceRange(line);
  const distance = distanceRange ? null : parseSingleDistance(line);
  const durationRange =
    distance != null || distanceRange != null ? null : parseDurationRange(line);
  const duration =
    distance != null || distanceRange != null || durationRange
      ? null
      : parseSingleDuration(line);
  if (
    duration == null &&
    distance == null &&
    durationRange == null &&
    distanceRange == null
  ) {
    return null;
  }
  if (
    /(?:km|m)\s*\/?\s*h/i.test(normalized) &&
    distance == null &&
    duration == null
  ) {
    return null;
  }

  const targetBasis =
    distance != null || distanceRange != null ? "distance" : "duration";
  const completion = completionRange(line);
  const speed = speedRange(line);
  return {
    line,
    confidence:
      pace || zone || /aquec|desaquec|longao|tempo|leve|corrida|caminh/i.test(
        normalized,
      )
        ? 0.93
        : 0.72,
    step: {
      position: 0,
      stepType,
      title: titleForStep(line, stepType, zone),
      instructions: line,
      repetitions: 1,
      targetBasis,
      distanceM: distance,
      distanceMinM: distanceRange?.distanceMinM ?? null,
      distanceMaxM: distanceRange?.distanceMaxM ?? null,
      durationS: duration,
      durationMinS: durationRange?.durationMinS ?? null,
      durationMaxS: durationRange?.durationMaxS ?? null,
      paceMinSPerKm: pace?.paceMinSPerKm ?? null,
      paceMaxSPerKm: pace?.paceMaxSPerKm ?? null,
      heartRateZone: zone,
      recoveryType: "none",
      metadata: {
        ...(completion
          ? {
              sourceCompletionDurationMinS: completion.minS,
              sourceCompletionDurationMaxS: completion.maxS,
            }
          : {}),
        ...(speed
          ? {
              sourceSpeedMinKmh: speed.minKmh,
              sourceSpeedMaxKmh: speed.maxKmh,
            }
          : {}),
      },
    },
  };
}

function likelyTitle(line: string) {
  const normalized = fold(line);
  if (HEADER_LINES.some((pattern) => pattern.test(line))) return false;
  if (URL_LINE.test(line) || URL_CONTINUATION_LINE.test(line)) return false;
  return (
    /^(?:treino\s+)?(?:intervalado|fartlek|longao|corrida por tempo|tempo run)(?:\s+\d+\s*(?:k|km|min|minutos?))?(?:\s+\w+)?$/i.test(
      normalized,
    ) || (!/\d/.test(line) && line.length <= 80)
  );
}

function applyPlanContext(
  steps: ParsedStep[],
  explicitTitle: string | null,
) {
  const normalizedTitle = fold(explicitTitle ?? "");
  const mainSteps = steps.filter(
    ({ step }) =>
      step.stepType !== "warmup" && step.stepType !== "cooldown",
  );
  if (/longao|long run/.test(normalizedTitle) && mainSteps.length === 1) {
    mainSteps[0].step.stepType = "long_run";
    mainSteps[0].step.title = titleForStep(
      mainSteps[0].line,
      "long_run",
      mainSteps[0].step.heartRateZone ?? null,
    );
  }
  if (/fartlek/.test(normalizedTitle)) {
    for (const parsed of mainSteps) {
      if (parsed.step.repetitions > 1) {
        parsed.step.stepType = "interval";
        parsed.step.title = "Fartlek";
        parsed.step.metadata = {
          ...(parsed.step.metadata ?? {}),
          workoutStyle: "fartlek",
        };
      }
    }
  }
}

function enrichWarmup(
  steps: ParsedStep[],
  lines: string[],
  consumed: Set<string>,
  links: string[],
) {
  const warmup = steps.find((candidate) => candidate.step.stepType === "warmup");
  if (!warmup) return;
  const stretchLine = lines.find((line) =>
    /alongamento\s+din[aâ]mico\s*:/i.test(line),
  );
  const movementLine = lines.find((line) =>
    /^\d+\s*x\s*(?:de\s*)?\d+\s*(?:a|ate|[-–—])\s*\d+\s+movimentos?/i.test(
      fold(line),
    ),
  );
  const stretchCount = stretchLine
    ? fold(stretchLine).match(
        /(\d+)\s*(?:a|ate|[-–—])\s*(\d+)\s+exercicios?/i,
      )
    : null;
  const movementCount = movementLine
    ? fold(movementLine).match(
        /(\d+)\s*x\s*(?:de\s*)?(\d+)\s*(?:a|ate|[-–—])\s*(\d+)\s+movimentos?/i,
      )
    : null;
  if (stretchLine) consumed.add(stretchLine);
  if (movementLine) consumed.add(movementLine);
  warmup.step.instructions = [
    warmup.step.instructions,
    stretchLine,
    movementLine,
  ]
    .filter(Boolean)
    .join("\n");
  warmup.step.metadata = {
    ...(warmup.step.metadata ?? {}),
    ...(stretchCount
      ? {
          dynamicStretchExerciseCountMin: Number.parseInt(
            stretchCount[1],
            10,
          ),
          dynamicStretchExerciseCountMax: Number.parseInt(
            stretchCount[2],
            10,
          ),
        }
      : {}),
    ...(movementCount
      ? {
          dynamicStretchSets: Number.parseInt(movementCount[1], 10),
          movementsPerExerciseMin: Number.parseInt(movementCount[2], 10),
          movementsPerExerciseMax: Number.parseInt(movementCount[3], 10),
        }
      : {}),
    ...(links[0] ? { referenceUrl: links[0] } : {}),
  };
}

function attachStandaloneRecovery(
  parsedSteps: ParsedStep[],
  parsed: ParsedStep,
) {
  if (parsed.step.stepType !== "recovery") return false;
  const previous = parsedSteps.at(-1);
  if (!previous || previous.step.repetitions <= 1) return false;
  const recovery = parseRecovery(parsed.line);
  if (!recovery) return false;
  previous.step.recoveryType = recovery.recoveryType;
  previous.step.recoveryDurationS = recovery.recoveryDurationS ?? null;
  previous.step.recoveryDistanceM = recovery.recoveryDistanceM ?? null;
  previous.step.instructions = [
    previous.step.instructions,
    parsed.line,
  ].filter(Boolean).join("\n");
  previous.confidence = Math.min(previous.confidence, parsed.confidence);
  return true;
}

function computedTitle(steps: RunningWorkoutPlanStepDraft[]) {
  const totalDistanceM = steps.reduce((sum, step) => {
    const repetitions = Math.max(1, step.repetitions);
    return sum + (step.distanceM ?? 0) * repetitions;
  }, 0);
  const zones = Array.from(
    new Set(
      steps
        .map((step) => step.heartRateZone)
        .filter((zone): zone is number => zone != null),
    ),
  );
  const distance =
    totalDistanceM > 0 && totalDistanceM % 1000 === 0
      ? `${totalDistanceM / 1000} km`
      : null;
  const zoneLabel =
    zones.length > 0 ? zones.map((zone) => `Z${zone}`).join("–") : null;
  return ["Corrida", distance, zoneLabel].filter(Boolean).join(" · ");
}

function fieldConfidenceFor(steps: ParsedStep[]) {
  const values: Record<string, number> = {
    name: steps.length > 0 ? 0.85 : 0.3,
    level: 0.35,
    goal: 0.35,
  };
  steps.forEach((parsed, index) => {
    const prefix = `steps.${index}`;
    values[`${prefix}.title`] = parsed.confidence;
    values[`${prefix}.stepType`] = parsed.confidence;
    values[`${prefix}.target`] = parsed.confidence;
    if (parsed.step.paceMinSPerKm || parsed.step.paceMaxSPerKm) {
      values[`${prefix}.pace`] = parsed.confidence;
    }
    if (parsed.step.heartRateZone) {
      values[`${prefix}.heartRateZone`] = parsed.confidence;
    }
    if (parsed.step.recoveryType !== "none") {
      values[`${prefix}.recovery`] = parsed.confidence;
    }
  });
  return values;
}

export function parseRunningPlanImportText(
  rawText: string,
  options: ParseRunningPlanImportOptions = {},
): RunningPlanImportDraft {
  const lines = prepareLines(rawText);
  const links = extractUrls(rawText);
  const consumed = new Set<string>();
  const parsedSteps: ParsedStep[] = [];
  let explicitTitle: string | null = null;

  for (const line of lines) {
    if (
      HEADER_LINES.some((pattern) => pattern.test(line)) ||
      URL_LINE.test(line) ||
      URL_CONTINUATION_LINE.test(line)
    ) {
      continue;
    }
    if (!explicitTitle && likelyTitle(line)) {
      explicitTitle = line;
      consumed.add(line);
      continue;
    }
    if (
      /alongamento\s+din[aâ]mico|movimentos?/i.test(line) &&
      !/aquecimento/i.test(line)
    ) {
      continue;
    }
    const parsed = parseStep(line);
    if (!parsed) continue;
    consumed.add(line);
    if (!attachStandaloneRecovery(parsedSteps, parsed)) {
      parsedSteps.push(parsed);
    }
  }

  enrichWarmup(parsedSteps, lines, consumed, links);
  applyPlanContext(parsedSteps, explicitTitle);
  parsedSteps.sort((first, second) => {
    if (first.step.stepType === "warmup" && second.step.stepType !== "warmup") {
      return -1;
    }
    if (second.step.stepType === "warmup" && first.step.stepType !== "warmup") {
      return 1;
    }
    if (
      first.step.stepType === "cooldown" &&
      second.step.stepType !== "cooldown"
    ) {
      return 1;
    }
    if (
      second.step.stepType === "cooldown" &&
      first.step.stepType !== "cooldown"
    ) {
      return -1;
    }
    return 0;
  });
  const normalizedSteps = parsedSteps.map((parsed, position) => ({
    ...parsed.step,
    position,
    metadata: {
      ...(parsed.step.metadata ?? {}),
      importConfidence: parsed.confidence,
    },
  }));
  const unparsedLines = lines.filter(
    (line) =>
      !consumed.has(line) &&
      !HEADER_LINES.some((pattern) => pattern.test(line)) &&
      !URL_LINE.test(line) &&
      !URL_CONTINUATION_LINE.test(line),
  );
  const fieldConfidences = fieldConfidenceFor(parsedSteps);
  const averageConfidence =
    parsedSteps.length > 0
      ? parsedSteps.reduce((sum, step) => sum + step.confidence, 0) /
        parsedSteps.length
      : 0;
  const confidence = Math.max(
    0,
    Math.min(0.98, averageConfidence - unparsedLines.length * 0.04),
  );
  const warnings = [
    "review_required",
    "level_not_provided",
    "goal_not_provided",
    ...(links.length > 0 ? ["reference_links_not_verified"] : []),
    ...(unparsedLines.length > 0 ? ["unparsed_lines"] : []),
    ...(confidence < 0.75 ? ["low_confidence"] : []),
  ];
  const sourceType = options.sourceType ?? "text";
  const parsedPlan: RunningWorkoutPlanDraft = {
    name: explicitTitle ?? computedTitle(normalizedSteps),
    description: "Importado para revisão a partir de uma prescrição de corrida.",
    level: "beginner",
    goal: "general",
    source: sourceType,
    sourceMetadata: {
      sourceName: options.sourceName ?? null,
      sourceSha256:
        options.sourceSha256 ?? options.sourceImageSha256 ?? null,
      sourceImageSha256: options.sourceImageSha256 ?? null,
      referenceUrls: links,
      parserVersion: PARSER_VERSION,
      importConfidence: confidence,
      importWarnings: warnings,
      unparsedLines,
      reviewRequired: true,
    },
    steps: normalizedSteps,
  };

  return {
    sourceType,
    rawText,
    parsedPlan: normalizeRunningPlan(parsedPlan),
    warnings,
    confidence,
    fieldConfidences,
    reviewRequired: true,
    unparsedLines,
  };
}
