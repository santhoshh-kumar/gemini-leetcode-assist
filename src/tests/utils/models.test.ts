import {
  MODEL_DISPLAY_NAMES,
  DEFAULT_MODEL,
  MODEL_CONTEXT_LIMITS,
  estimateTokenCount,
} from "@/utils/models";

describe("models.ts", () => {
  describe("MODEL_DISPLAY_NAMES", () => {
    it("should have display names for all models", () => {
      expect(MODEL_DISPLAY_NAMES["gemini-2.5-pro"]).toBe("Gemini 2.5 Pro");
      expect(MODEL_DISPLAY_NAMES["gemini-2.5-flash"]).toBe("Gemini 2.5 Flash");
    });
  });

  describe("DEFAULT_MODEL", () => {
    it("should be set to gemini-2.5-pro", () => {
      expect(DEFAULT_MODEL).toBe("gemini-2.5-pro");
    });
  });

  describe("MODEL_CONTEXT_LIMITS", () => {
    it("should have context limits for all models", () => {
      expect(MODEL_CONTEXT_LIMITS["gemini-2.5-pro"]).toBe(1_048_576);
      expect(MODEL_CONTEXT_LIMITS["gemini-2.5-flash"]).toBe(1_048_576);
    });

    it("should have numeric values for context limits", () => {
      Object.values(MODEL_CONTEXT_LIMITS).forEach((limit) => {
        expect(typeof limit).toBe("number");
        expect(limit).toBeGreaterThan(0);
      });
    });
  });

  describe("estimateTokenCount", () => {
    it("should return 0 for empty string", () => {
      expect(estimateTokenCount("")).toBe(0);
    });

    it("should return 0 for null/undefined", () => {
      expect(estimateTokenCount(null as unknown as string)).toBe(0);
      expect(estimateTokenCount(undefined as unknown as string)).toBe(0);
    });

    it("should estimate tokens using 4 characters per token formula", () => {
      // 4 characters = 1 token (rounded up)
      expect(estimateTokenCount("test")).toBe(1);

      // 8 characters = 2 tokens
      expect(estimateTokenCount("testtest")).toBe(2);

      // 100 characters = 25 tokens
      expect(estimateTokenCount("a".repeat(100))).toBe(25);
    });

    it("should round up using Math.ceil", () => {
      // 5 characters should round up to 2 tokens (5/4 = 1.25 -> 2)
      expect(estimateTokenCount("hello")).toBe(2);

      // 3 characters should round up to 1 token (3/4 = 0.75 -> 1)
      expect(estimateTokenCount("hey")).toBe(1);

      // 7 characters should round up to 2 tokens (7/4 = 1.75 -> 2)
      expect(estimateTokenCount("testing")).toBe(2);
    });

    it("should handle single character", () => {
      expect(estimateTokenCount("a")).toBe(1);
    });

    it("should handle strings with spaces", () => {
      // "hello world" = 11 characters (including space) = 11/4 = 2.75 -> 3 tokens
      expect(estimateTokenCount("hello world")).toBe(3);
    });

    it("should handle strings with special characters", () => {
      // "hello!@#$%^&*()" = 15 characters = 15/4 = 3.75 -> 4 tokens
      expect(estimateTokenCount("hello!@#$%^&*()")).toBe(4);
    });

    it("should handle strings with newlines", () => {
      // "line1\nline2\nline3" = 17 characters = 17/4 = 4.25 -> 5 tokens
      expect(estimateTokenCount("line1\nline2\nline3")).toBe(5);
    });

    it("should handle strings with punctuation", () => {
      // "Hello, world! How are you?" = 26 characters = 26/4 = 6.5 -> 7 tokens
      expect(estimateTokenCount("Hello, world! How are you?")).toBe(7);
    });

    it("should handle long strings", () => {
      // 1000 characters = 250 tokens
      expect(estimateTokenCount("a".repeat(1000))).toBe(250);

      // 10000 characters = 2500 tokens
      expect(estimateTokenCount("b".repeat(10000))).toBe(2500);
    });

    it("should handle multi-byte characters", () => {
      // Emoji and unicode characters still count by string length
      // "Hello 👋 World 🌍" = 17 characters (emoji count as 2 chars each in JS) = 5 tokens
      const textWithEmoji = "Hello 👋 World 🌍";
      expect(estimateTokenCount(textWithEmoji)).toBe(
        Math.ceil(textWithEmoji.length / 4),
      );
    });

    it("should handle code snippets", () => {
      const codeSnippet = `function hello() {\n  console.log("Hello");\n}`;
      // Calculate expected: length / 4, rounded up
      expect(estimateTokenCount(codeSnippet)).toBe(
        Math.ceil(codeSnippet.length / 4),
      );
    });

    it("should produce consistent results for same input", () => {
      const testString = "This is a test string for consistency";
      const result1 = estimateTokenCount(testString);
      const result2 = estimateTokenCount(testString);
      expect(result1).toBe(result2);
    });
  });
});
