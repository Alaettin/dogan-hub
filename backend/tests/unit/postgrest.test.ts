import { describe, expect, it } from "vitest";
import { escapeLikeValue } from "../../src/lib/postgrest";

describe("escapeLikeValue", () => {
  it("lässt einfachen Text unverändert", () => {
    expect(escapeLikeValue("hallo welt")).toBe("hallo welt");
  });

  it("behält Punkte (zerbricht den Filter nicht)", () => {
    expect(escapeLikeValue("v1.0")).toBe("v1.0");
  });

  it("behält Kommas und Klammern unverändert (sind dank Quoting sicher)", () => {
    expect(escapeLikeValue("a,b(c)")).toBe("a,b(c)");
  });

  it("escapt doppelte Anführungszeichen", () => {
    expect(escapeLikeValue('a"b')).toBe('a\\"b');
  });

  it("escapt Backslashes", () => {
    // ein Backslash -> zwei Backslashes
    expect(escapeLikeValue("a\\b")).toBe("a\\\\b");
  });

  it("escapt Backslash vor Quote in korrekter Reihenfolge", () => {
    // Eingabe: Backslash + Quote  ->  \\ + \"  (3 Backslashes + Quote)
    expect(escapeLikeValue('\\"')).toBe('\\\\\\"');
  });
});
