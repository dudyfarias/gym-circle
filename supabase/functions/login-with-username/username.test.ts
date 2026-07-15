import { describe, expect, it } from "vitest";
import { cleanUsername, escapeIlikeLiteral } from "./username";

describe("login-with-username normalization", () => {
  it.each(["dudy", "Dudy", "DUDY", " @DuDy "])(
    "normalizes %s without case distinction",
    (value) => {
      expect(cleanUsername(value)).toBe("dudy");
    },
  );

  it("escapes SQL pattern characters used in valid usernames", () => {
    expect(escapeIlikeLiteral("dudy_test")).toBe("dudy\\_test");
    expect(escapeIlikeLiteral("dudy%test")).toBe("dudy\\%test");
    expect(escapeIlikeLiteral("dudy\\test")).toBe("dudy\\\\test");
  });
});
