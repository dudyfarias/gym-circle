import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitRunningSessionEvents,
  RUNNING_SESSION_EVENT_NAME,
} from "./runningSessionEvents";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("running session event bridge", () => {
  it("emits only the sanitized event contract", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      dispatchEvent,
    });
    vi.stubGlobal(
      "CustomEvent",
      class {
        type: string;
        detail: unknown;

        constructor(type: string, options: { detail: unknown }) {
          this.type = type;
          this.detail = options.detail;
        }
      },
    );

    emitRunningSessionEvents([
      {
        id: "step_started:step-1:1000:start",
        type: "step_started",
        atMs: 1_000,
        segmentId: "step-1",
      },
    ]);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0]).toEqual({
      type: RUNNING_SESSION_EVENT_NAME,
      detail: {
        eventId: "step_started:step-1:1000:start",
        type: "step_started",
        messageKey: null,
      },
    });
    expect(JSON.stringify(dispatchEvent.mock.calls[0][0])).not.toContain(
      "segmentId",
    );
  });
});
