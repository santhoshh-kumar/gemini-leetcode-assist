import { callGeminiApi } from "@/utils/gemini";
import { Chat } from "@/state/slices/chatSlice";

// Mock the GoogleGenAI library
const mockGenerateContentStream = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContentStream: mockGenerateContentStream,
    },
  })),
  GenerationConfig: {},
  Content: {},
}));

describe("callGeminiApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const apiKey = "test-api-key";
  const modelName = "gemini-pro";
  const chatHistory: Chat["messages"] = [
    { id: "1", text: "Hello", isUser: true, status: "succeeded" },
    { id: "2", text: "Hi there", isUser: false, status: "succeeded" },
  ];
  const problemDetails = '{"title":"Two Sum"}';
  const userCode = 'console.log("hello world")';
  const currentUserMessage = "How do I solve this?";

  it("should yield text chunks from the streaming API on success", async () => {
    const mockChunks = [
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Test " }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [{ text: "response" }],
            },
          },
        ],
      },
    ];
    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      })(),
    );

    const generator = callGeminiApi(
      apiKey,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ text: "Test " }, { text: "response" }]);
  });

  it("should throw an error for an invalid API key", async () => {
    const generator = callGeminiApi(
      "" as string,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    await expect(generator.next()).rejects.toThrow("Invalid API key provided.");
  });

  it("should construct the final prompt correctly", async () => {
    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: "mock response" }],
              },
            },
          ],
        };
      })(),
    );

    const generator = callGeminiApi(
      apiKey,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    await generator.next();

    const callArgs = mockGenerateContentStream.mock.calls[0][0];
    expect(callArgs.model).toBe(modelName);
    expect(callArgs.config.systemInstruction).toContain(
      "You are an expert competitive programmer and mentor",
    );
    expect(callArgs.contents).toHaveLength(3); // chat history + user message parts
    expect(callArgs.contents[2].parts[0].text).toContain(currentUserMessage);
  });

  it("should handle null problemDetails and userCode", async () => {
    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: "mock response" }],
              },
            },
          ],
        };
      })(),
    );

    const generator = callGeminiApi(
      apiKey,
      modelName,
      chatHistory,
      null,
      null,
      currentUserMessage,
      false,
    );

    await generator.next();

    const callArgs = mockGenerateContentStream.mock.calls[0][0];
    expect(callArgs.contents[2].parts[0].text).toMatch(
      /Problem Details:\s*No problem details provided\./,
    );
    expect(callArgs.contents[2].parts[0].text).toMatch(
      /User Code:\s*No code provided\./,
    );
    expect(callArgs.contents[2].parts[0].text).toMatch(
      /User's latest message to respond to: How do I solve this\?/,
    );
  });

  const errorTestCases = [
    {
      code: "400",
      message: "Invalid request. Please check your prompt and try again.",
    },
    {
      code: "401",
      message: "Authentication failed. Please check your API key.",
    },
    {
      code: "403",
      message: "Permission denied. You do not have permission to call the API.",
    },
    { code: "404", message: "The requested resource was not found." },
    { code: "429", message: "Rate limit exceeded. Please try again later." },
    {
      code: "500",
      message:
        "The service is temporarily unavailable. Please try again later.",
    },
    {
      code: "503",
      message:
        "The service is temporarily unavailable. Please try again later.",
    },
  ];

  errorTestCases.forEach(({ code, message }) => {
    it(`should throw a specific error for a ${code} response`, async () => {
      mockGenerateContentStream.mockRejectedValue(
        new Error(`Request failed with status code ${code}`),
      );

      const generator = callGeminiApi(
        apiKey,
        modelName,
        chatHistory,
        problemDetails,
        userCode,
        currentUserMessage,
        false,
      );

      await expect(generator.next()).rejects.toThrow(message);
    });
  });

  it("should throw a generic error for an unexpected error", async () => {
    const errorMessage = "Some other error";
    mockGenerateContentStream.mockRejectedValue(new Error(errorMessage));

    const generator = callGeminiApi(
      apiKey,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    await expect(generator.next()).rejects.toThrow(
      `An unexpected error occurred: ${errorMessage}`,
    );
  });

  it("should handle empty chunks from the streaming API", async () => {
    const mockChunks = [
      {
        candidates: [
          {
            content: {
              parts: [{ text: "" }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Valid text" }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [{ text: "" }],
            },
          },
        ],
      },
    ];
    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      })(),
    );

    const generator = callGeminiApi(
      apiKey,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // Should only yield non-empty chunks
    expect(chunks).toEqual([{ text: "Valid text" }]);
  });

  it("should handle null API key", async () => {
    const generator = callGeminiApi(
      null as unknown as string,
      modelName,
      chatHistory,
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    await expect(generator.next()).rejects.toThrow("Invalid API key provided.");
  });

  it("should handle empty chat history", async () => {
    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: "response" }],
              },
            },
          ],
        };
      })(),
    );

    const generator = callGeminiApi(
      apiKey,
      modelName,
      [],
      problemDetails,
      userCode,
      currentUserMessage,
      false,
    );

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ text: "response" }]);

    const callArgs = mockGenerateContentStream.mock.calls[0][0];
    // Should have only 1 content item (the user message)
    expect(callArgs.contents).toHaveLength(1);
  });
});
