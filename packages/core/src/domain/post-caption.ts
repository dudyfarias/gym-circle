export type PostCaptionMode = "single" | "per_media";

export type PostCaptionSource = {
  /**
   * Já normalizada para "" no mapper — as linhas do banco trazem
   * `string | null`, mas `GymPost.caption` é não-nullable e o card chama
   * `.length` sem guarda.
   */
  caption: string;
  captionMode?: PostCaptionMode | null;
  media?: Array<{ caption?: string | null }> | undefined;
};

/**
 * Qual legenda mostrar para o card ativo do carrossel.
 *
 * Devolve sempre `string` (nunca null), para casar com `GymPost.caption`.
 *
 * Degrada para a legenda do post quando:
 *  - o modo é `single` (ou ausente, em post antigo);
 *  - não há array de mídia (post legado);
 *  - o índice está fora do intervalo;
 *  - **estado degenerado**: modo `per_media` com menos de 2 mídias. O app iOS
 *    publicado produz esse estado ao reduzir o carrossel — ele apaga as linhas
 *    de post_media e só reinsere quando sobra mais de uma, então um post pode
 *    ficar `per_media` com zero mídias. Sem este ramo o post ficaria mudo para
 *    sempre, mesmo com `posts.caption` preenchido.
 */
export function resolvePostCaption(
  post: PostCaptionSource,
  activeIndex: number,
): string {
  if (post.captionMode !== "per_media") return post.caption;

  const media = post.media;
  if (!Array.isArray(media) || media.length < 2) return post.caption;

  const item = media[activeIndex];
  if (!item) return post.caption;

  return item.caption ?? "";
}
