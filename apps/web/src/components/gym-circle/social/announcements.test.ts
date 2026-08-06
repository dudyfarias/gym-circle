import { describe, expect, it } from "vitest";
import { selectPendingAnnouncement, type Announcement } from "./announcements";

const a: Announcement = { id: "a", titleKey: "t.a", bodyKey: "b.a" };
const b: Announcement = { id: "b", titleKey: "t.b", bodyKey: "b.b" };

describe("selectPendingAnnouncement", () => {
  it("devolve o primeiro não visto", () => {
    expect(selectPendingAnnouncement([a, b], {})).toBe(a);
  });

  it("pula os já vistos", () => {
    expect(selectPendingAnnouncement([a, b], { a: "2026-08-06" })).toBe(b);
  });

  it("devolve null quando todos foram vistos", () => {
    expect(
      selectPendingAnnouncement([a, b], { a: "x", b: "y" }),
    ).toBeNull();
  });

  // Sem esta guarda o comunicado piscaria antes do perfil carregar e seria
  // marcado como visto sem a pessoa ter lido.
  it("devolve null enquanto o mapa de vistos não carregou", () => {
    expect(selectPendingAnnouncement([a, b], undefined)).toBeNull();
  });

  it("sem comunicados, devolve null", () => {
    expect(selectPendingAnnouncement([], {})).toBeNull();
  });
});
