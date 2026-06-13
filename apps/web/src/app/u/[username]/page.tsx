import { redirect } from "next/navigation";

/**
 * Sprint 19 — alvo do universal link /u/* (AASA). Mesmo racional do
 * /post/*: nativo intercepta; browser cai na home com o handle em query.
 */
export default async function ProfileDeepLinkPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect(`/?u=${encodeURIComponent(username)}`);
}
