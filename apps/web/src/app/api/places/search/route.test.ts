import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function request(query: string, ip: string, explicit = true) {
  return new Request(
    `https://gymcircle.test/api/places/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "x-forwarded-for": ip,
        ...(explicit ? { "x-gymcircle-search-intent": "explicit" } : {}),
      },
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("places external search route", () => {
  it("rejects short or non-explicit searches without contacting Nominatim", async () => {
    const upstreamFetch = vi.fn();
    vi.stubGlobal("fetch", upstreamFetch);

    expect((await GET(request("SP", "198.51.100.1"))).status).toBe(400);
    expect((await GET(request("Bluefit", "198.51.100.2", false))).status).toBe(
      400,
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("returns OpenStreetMap attribution for an explicit search", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            address: { city: "São Paulo", country_code: "br", road: "Rua A" },
            display_name: "Academia Exemplo, Rua A, São Paulo",
            lat: "-23.55",
            lon: "-46.64",
            name: "Academia Exemplo",
            osm_id: 123,
            osm_type: "node",
            type: "fitness_centre",
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(request("Academia Exemplo", "198.51.100.3"));
    const payload = (await response.json()) as {
      attribution: { provider: string };
      results: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload.attribution.provider).toBe("openstreetmap");
    expect(payload.results).toHaveLength(1);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      "User-Agent": "GymCircle/1.0 (+https://gym-circle-rust.vercel.app)",
    });
  });

  it("rate limits repeated explicit searches from the same client", async () => {
    const upstreamFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", upstreamFetch);

    const first = await GET(request("Smart Fit", "198.51.100.4"));
    const second = await GET(request("Bio Ritmo", "198.51.100.4"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("2");
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});
