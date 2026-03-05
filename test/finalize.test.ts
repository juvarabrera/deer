import { test, expect, describe } from "bun:test";
import { ensureDeerEmojiPrefix } from "../src/git/finalize";

describe("ensureDeerEmojiPrefix", () => {
  test("adds deer emoji to plain title", () => {
    expect(ensureDeerEmojiPrefix("Fix login redirect loop")).toBe("🦌 Fix login redirect loop");
  });

  test("does not double-add deer emoji", () => {
    expect(ensureDeerEmojiPrefix("🦌 Fix login redirect loop")).toBe("🦌 Fix login redirect loop");
  });

  test("handles empty string", () => {
    expect(ensureDeerEmojiPrefix("")).toBe("🦌 ");
  });

  test("handles title that already starts with emoji and space", () => {
    expect(ensureDeerEmojiPrefix("🦌 Add user search endpoint")).toBe("🦌 Add user search endpoint");
  });
});
