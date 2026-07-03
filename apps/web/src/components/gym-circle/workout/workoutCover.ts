/**
 * Capa gerada do treino (rastreio de treino, Fase 1).
 *
 * Post sem foto: o modelo de posts exige mídia, então quando o user publica
 * um treino rastreado sem adicionar foto a gente desenha um card de stats
 * (4:5, tokens do app) e usa como capa — o feed web/nativo renderiza sem
 * nenhuma mudança. Mesmo padrão de canvas do MonthlyRecapSheet.
 */
type WorkoutCoverOptions = {
  /** "Musculação", "Corrida"... (já traduzido) */
  typeLabel: string;
  /** "58:12" (formatElapsed) */
  elapsedLabel: string;
  /** "TEMPO DE TREINO" (já traduzido) */
  elapsedCaption: string;
  /** "02/07/2026" */
  dateLabel: string;
};

const W = 1080;
const H = 1350;

export async function createWorkoutCoverFile(
  options: WorkoutCoverOptions,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");

  // Fundo do card do feed (#0c0d0e) + brilho azul sutil no topo.
  ctx.fillStyle = "#0c0d0e";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -H * 0.25, 80, W / 2, -H * 0.25, H * 0.9);
  glow.addColorStop(0, "rgba(48, 213, 255, 0.16)");
  glow.addColorStop(1, "rgba(48, 213, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const sans =
    '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = "center";

  // Marca (eyebrow)
  ctx.fillStyle = "rgba(255,255,255,0.44)";
  ctx.font = `900 34px ${sans}`;
  ctx.fillText("G Y M   C I R C L E", W / 2, 150);

  // Tipo do treino
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 76px ${sans}`;
  ctx.fillText(options.typeLabel, W / 2, H / 2 - 170);

  // Duração (herói, azul elétrico)
  ctx.fillStyle = "#30d5ff";
  ctx.font = `900 230px ${sans}`;
  ctx.fillText(options.elapsedLabel, W / 2, H / 2 + 60);

  // Legenda da duração
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `900 34px ${sans}`;
  ctx.fillText(options.elapsedCaption.toUpperCase(), W / 2, H / 2 + 150);

  // Data
  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.font = `700 40px ${sans}`;
  ctx.fillText(options.dateLabel, W / 2, H - 120);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("falha ao gerar a capa do treino");
  return new File([blob], `workout-cover-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });
}
