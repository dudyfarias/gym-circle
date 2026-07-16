import { afterEach, describe, expect, it, vi } from "vitest";

function request(params = "lat=-23.561&lng=-46.656&radius=1500") {
  return new Request(`https://gymcircle.test/api/places/nearby?${params}`);
}

async function loadGet() {
  vi.resetModules();
  return (await import("./route")).GET;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("places nearby route", () => {
  it("returns a successful degraded response after one upstream timeout", async () => {
    const upstreamFetch = vi
      .fn()
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    vi.stubGlobal("fetch", upstreamFetch);
    const GET = await loadGet();

    const response = await GET(request());
    const payload = (await response.json()) as {
      degraded: boolean;
      reason: string;
      results: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      degraded: true,
      reason: "nearby_timeout",
      results: [],
    });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const circuitResponse = await GET(request("lat=-23.562&lng=-46.656"));
    expect(circuitResponse.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry an upstream 504", async () => {
    const upstreamFetch = vi
      .fn()
      .mockResolvedValue(new Response("timeout", { status: 504 }));
    vi.stubGlobal("fetch", upstreamFetch);
    const GET = await loadGet();

    const response = await GET(request());
    const payload = (await response.json()) as { degraded: boolean };

    expect(response.status).toBe(200);
    expect(payload.degraded).toBe(true);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it("returns valid places ordered by distance", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            {
              id: 2,
              lat: -23.58,
              lon: -46.67,
              tags: { leisure: "fitness_centre", name: "Academia distante" },
              type: "node",
            },
            {
              id: 1,
              lat: -23.5615,
              lon: -46.656,
              tags: { leisure: "park", name: "Parque próximo" },
              type: "node",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", upstreamFetch);
    const GET = await loadGet();

    const response = await GET(request());
    const payload = (await response.json()) as {
      results: Array<{ name: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.results.map((item) => item.name)).toEqual([
      "Parque próximo",
      "Academia distante",
    ]);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});
