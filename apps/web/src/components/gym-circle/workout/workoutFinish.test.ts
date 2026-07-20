import { describe, expect, it, vi } from "vitest";
import { finishWithTimeout, withRequestTimeout } from "./workoutFinish";

describe("finishWithTimeout", () => {
  it("retorna a atividade quando a finalização responde", async () => {
    await expect(
      finishWithTimeout(Promise.resolve({ id: "activity-1" }), 100),
    ).resolves.toEqual({ id: "activity-1" });
  });

  it("libera a UI quando a finalização não responde", async () => {
    vi.useFakeTimers();
    const request = finishWithTimeout(new Promise<never>(() => undefined), 500);
    const rejection = expect(request).rejects.toThrow("workout_finish_timeout");

    await vi.advanceTimersByTimeAsync(500);
    await rejection;
    vi.useRealTimers();
  });

  it("propaga o erro original", async () => {
    await expect(
      finishWithTimeout(Promise.reject(new Error("activity_create_failed"))),
    ).rejects.toThrow("activity_create_failed");
  });
});

describe("withRequestTimeout", () => {
  it("usa o erro específico do fluxo que ficou sem resposta", async () => {
    vi.useFakeTimers();
    const request = withRequestTimeout(
      new Promise<never>(() => undefined),
      300,
      "healthkit_request_timeout",
    );
    const rejection = expect(request).rejects.toThrow(
      "healthkit_request_timeout",
    );

    await vi.advanceTimersByTimeAsync(300);
    await rejection;
    vi.useRealTimers();
  });
});
