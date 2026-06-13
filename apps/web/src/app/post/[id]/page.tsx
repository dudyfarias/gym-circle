import { redirect } from "next/navigation";

/**
 * Sprint 19 — alvo do universal link /post/* (AASA).
 *
 * Com o app nativo instalado, o iOS intercepta a URL antes do browser e
 * o roteador nativo (GymCircleNativeRootView.route) abre o post. No
 * browser, redireciona pro app web com o id em query — o shell abre na
 * home; a abertura automática do overlay via ?post= é um aprimoramento
 * registrado na Sprint 19.
 */
export default async function PostDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?post=${encodeURIComponent(id)}`);
}
