export const MODEL_DISPLAY_NAMES: { [key: string]: string } = {
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
};

export const DEFAULT_MODEL = "gemini-2.5-pro";

// Official context window limits from Gemini API docs
export const MODEL_CONTEXT_LIMITS: { [key: string]: number } = {
  "gemini-2.5-pro": 1_048_576, // Input token limit
  "gemini-2.5-flash": 1_048_576, // Input token limit
};

/**
 * Estimates token count from text using a character-based approximation.
 * Uses a conservative formula for better accuracy: ~4 characters = 1 token
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated number of tokens
 */
export const estimateTokenCount = (text: string): number => {
  if (!text) return 0;

  // Conservative estimation: ~4 characters per token
  // This accounts for spaces, punctuation, and multi-byte characters
  return Math.ceil(text.length / 4);
};
