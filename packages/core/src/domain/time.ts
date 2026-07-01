export const GYM_CIRCLE_TIME_ZONE = "America/Sao_Paulo";

/**
 * Retorna uma chave civil YYYY-MM-DD no fuso oficial do produto.
 *
 * Não use `toISOString().slice(0, 10)` para conceitos como "hoje": ISO é
 * sempre UTC e, entre 21h e 00h em São Paulo, já aponta para o dia seguinte.
 */
export function getGymCircleDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: GYM_CIRCLE_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getGymCircleHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: GYM_CIRCLE_TIME_ZONE,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}
