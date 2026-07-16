import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("GymSearchSheet external search", () => {
  it("does not implement search-as-you-type against the public endpoint", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./GymSearchSheet.tsx", import.meta.url)),
      "utf8",
    );

    expect(source).not.toContain("Debounced text search");
    expect(source).not.toContain("void runSearch(trimmed)");
    expect(source).toContain('type="submit"');
    expect(source).toContain("Buscar locais externos");
    expect(source).toContain('"X-GymCircle-Search-Intent": "explicit"');
  });
});
