import { describe, expect, it, vi } from "vitest";
import { createSocialActions } from "./supabaseSocialActions";

/**
 * A confirmação visual do follow-back não pode depender do `refresh()` do
 * social inteiro: o follow já foi gravado no primeiro await. Acoplar as duas
 * coisas fazia o botão ficar em spinner por segundos e — se o refresh
 * falhasse — nunca aplicar o override, voltando pra "Seguir" mesmo com o
 * follow gravado com sucesso.
 */
function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    currentUserId: "me",
    services: {
      follows: {
        toggle: vi.fn().mockResolvedValue({ followStatus: "accepted" }),
      },
    },
    refresh: vi.fn().mockResolvedValue(undefined),
    showFeedback: vi.fn(),
    enrichedAll: new Map(),
    ...overrides,
  } as unknown as Parameters<typeof createSocialActions>[0];
}

describe("toggleFollow", () => {
  it("devolve o status mesmo quando o refresh falha", async () => {
    const ctx = makeCtx({
      refresh: vi.fn().mockRejectedValue(new Error("refresh caiu")),
    });
    const actions = createSocialActions(ctx);

    await expect(actions.toggleFollow("outro")).resolves.toEqual({
      followStatus: "accepted",
    });
  });

  it("confirma sem esperar o refresh terminar", async () => {
    let liberarRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberarRefresh = resolve;
        }),
    );
    const ctx = makeCtx({ refresh });
    const actions = createSocialActions(ctx);

    // Resolve com o refresh ainda pendente — senão o botão fica em "..."
    // até o social inteiro recarregar.
    await expect(actions.toggleFollow("outro")).resolves.toEqual({
      followStatus: "accepted",
    });
    expect(refresh).toHaveBeenCalled();

    liberarRefresh?.();
  });
});
