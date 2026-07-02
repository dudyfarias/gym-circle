import { describe, expect, it } from "vitest";
import {
  allSettledWithConcurrency,
  getMediaUploadConcurrency,
} from "./mediaUploadQueue";

describe("mediaUploadQueue", () => {
  it("processa qualquer lote com vídeo de forma sequencial", () => {
    expect(
      getMediaUploadConcurrency([
        { type: "image/jpeg" },
        { type: "video/mp4" },
        { type: "image/png" },
      ]),
    ).toBe(1);
    expect(
      getMediaUploadConcurrency([
        { type: "image/jpeg" },
        { type: "image/png" },
      ]),
    ).toBe(2);
  });

  it("limita concorrência, preserva ordem e captura falhas", async () => {
    let active = 0;
    let peak = 0;

    const results = await allSettledWithConcurrency(
      [30, 5, -1, 10],
      2,
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, Math.abs(value)));
        active -= 1;
        if (value < 0) throw new Error("falhou");
        return value * 2;
      },
    );

    expect(peak).toBe(2);
    expect(results).toEqual([
      { status: "fulfilled", value: 60 },
      { status: "fulfilled", value: 10 },
      { status: "rejected", reason: expect.any(Error) },
      { status: "fulfilled", value: 20 },
    ]);
  });
});
