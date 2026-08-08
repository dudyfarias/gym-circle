import { describe, expect, it } from "vitest";
import { resolvePostCaption } from "./post-caption";

const m = (caption: string | null) => ({ caption });

describe("resolvePostCaption", () => {
  it("modo single devolve a legenda do post", () => {
    expect(
      resolvePostCaption({ caption: "geral", captionMode: "single", media: [] }, 0),
    ).toBe("geral");
  });

  it("modo per_media devolve a legenda da mídia ativa", () => {
    expect(
      resolvePostCaption(
        {
          caption: "espelho",
          captionMode: "per_media",
          media: [m("primeira"), m("segunda")],
        },
        1,
      ),
    ).toBe("segunda");
  });

  it("card sem legenda devolve string vazia", () => {
    expect(
      resolvePostCaption(
        {
          caption: "espelho",
          captionMode: "per_media",
          media: [m("primeira"), m(null)],
        },
        1,
      ),
    ).toBe("");
  });

  // Estado degenerado: o app iOS publicado reduz o carrossel a 1 mídia com um
  // delete SEM insert, deixando per_media com menos de 2 mídias. Sem este
  // fallback o post ficaria mudo para sempre, mesmo com posts.caption cheio.
  it("per_media com menos de 2 mídias cai para a legenda do post", () => {
    expect(
      resolvePostCaption(
        { caption: "espelho", captionMode: "per_media", media: [m(null)] },
        0,
      ),
    ).toBe("espelho");
  });

  it("índice fora do intervalo cai para a legenda do post", () => {
    expect(
      resolvePostCaption(
        { caption: "espelho", captionMode: "per_media", media: [m("a"), m("b")] },
        9,
      ),
    ).toBe("espelho");
  });

  it("post legado sem array de mídia cai para a legenda do post", () => {
    expect(
      resolvePostCaption(
        { caption: "antiga", captionMode: "per_media", media: undefined },
        0,
      ),
    ).toBe("antiga");
  });

  it("modo ausente (post antigo) se comporta como single", () => {
    expect(
      resolvePostCaption(
        { caption: "antiga", media: [m("a"), m("b")] },
        1,
      ),
    ).toBe("antiga");
  });
});
