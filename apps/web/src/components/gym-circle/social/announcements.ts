/**
 * Comunicados do app — avisos pontuais mostrados uma única vez por pessoa.
 *
 * Reusa `profiles.contextual_hints_seen` (Sprint 7C.1): o "já vi" mora no
 * banco, não no localStorage, então vale entre aparelhos e sobrevive a
 * reinstalação. Marcar é idempotente (`markContextualHintSeen`).
 *
 * Para publicar um comunicado novo: acrescente uma entrada aqui com um `id`
 * NOVO e as chaves de i18n. Nunca reaproveite um `id` já publicado — quem já
 * dispensou o antigo não veria o novo.
 */
export type Announcement = {
  /** Vira a chave em contextual_hints_seen. Imutável depois de publicado. */
  id: string;
  titleKey: string;
  bodyKey: string;
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "announcement.2026-08-06.follow-incident",
    titleKey: "announcements.followIncident.title",
    bodyKey: "announcements.followIncident.body",
  },
];

/**
 * Primeiro comunicado ainda não visto, na ordem em que foram declarados.
 * Devolve null quando não há nada pendente — inclusive quando o mapa de
 * "vistos" ainda não carregou, para não piscar o comunicado e marcá-lo como
 * visto antes de a pessoa ter chance de ler.
 */
export function selectPendingAnnouncement(
  announcements: Announcement[],
  seen: Record<string, string> | undefined,
): Announcement | null {
  if (!seen) return null;
  return announcements.find((item) => !seen[item.id]) ?? null;
}
