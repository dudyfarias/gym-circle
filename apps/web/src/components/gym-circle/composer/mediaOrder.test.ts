import { describe, expect, it } from "vitest";
import { moveMediaItem } from "./mediaOrder";

const list = ["a", "b", "c", "d"];

describe("moveMediaItem", () => {
  it("move para frente", () => {
    expect(moveMediaItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("move para trás", () => {
    expect(moveMediaItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("mesma posição é no-op", () => {
    expect(moveMediaItem(list, 1, 1)).toEqual(list);
  });

  it("índices fora do intervalo são no-op", () => {
    expect(moveMediaItem(list, -1, 2)).toEqual(list);
    expect(moveMediaItem(list, 0, 9)).toEqual(list);
    expect(moveMediaItem(list, 9, 0)).toEqual(list);
  });

  it("não muta o array original", () => {
    const original = [...list];
    moveMediaItem(list, 0, 3);
    expect(list).toEqual(original);
  });

  it("mover a última para o começo troca a capa", () => {
    // A 1a mídia vira posts.image_url — a capa no feed e na grade do perfil.
    expect(moveMediaItem(list, 3, 0)[0]).toBe("d");
  });
});
