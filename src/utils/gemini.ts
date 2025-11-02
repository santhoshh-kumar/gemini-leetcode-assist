import { GoogleGenAI, GenerationConfig, Content } from "@google/genai";
import { Chat } from "../state/slices/chatSlice";

export type StreamEvent = { text?: string; thought?: string };

/**
 * Calls the Gemini API with a structured prompt and returns a streaming response.
 *
 * @param apiKey - The API key for the Gemini API.
 * @param modelName - The name of the Gemini model to use.
 * @param chatHistory - The recent chat history.
 * @param problemDetails - The details of the LeetCode problem.
 * @param userCode - The user's code.
 * @param currentUserMessage - The user's latest message.
 * @param streamThoughts - Whether to stream thinking responses.
 * @returns An async generator that yields text chunks as they are generated.
 */
export const callGeminiApi = async function* (
  apiKey: string,
  modelName: string,
  chatHistory: Chat["messages"],
  problemDetails: string | null,
  userCode: string | null,
  currentUserMessage: string,
  streamThoughts: boolean,
) {
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("Invalid API key provided.");
  }

  const systemPrompt = `
You are an expert competitive programmer and mentor.
Adapt your style dynamically based on how the user interacts:

- If the user shares code, act as a debugging assistant.
- If they ask about a problem, act as a teacher and explain clearly.
- If they express emotions (e.g., frustration, excitement), respond empathetically and motivate them.
- If they are brainstorming casually, be a friendly coding buddy.

When context is provided (like problem details or code), use it only if it is relevant to the user's current message.
- If the user asks something that requires context (e.g., questions about their code or a problem) but no context was provided, ask them politely to click on 
Add Context
 and select the context (problem details or code) that is missing in the user's input.
- If the user's message is unrelated to the provided context (for example, a greeting or a casual question), ignore the context and respond naturally to their message alone.

Always keep responses concise, structured, and practical for competitive programming.
`;

  const contents: Content[] = [
    ...chatHistory.map((m) => ({
      role: m.isUser ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `Problem Details:
          ${
            problemDetails || "No problem details provided."
          }\n\nUser Code:\n${userCode || "No code provided."}`,
        },
        { text: currentUserMessage },
      ],
    },
  ];

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topP: 0.9,
      topK: 40,
    };

    if (streamThoughts) {
      generationConfig.thinkingConfig = {
        includeThoughts: true,
        thinkingBudget: -1,
      };
    }

    const response = await genAI.models.generateContentStream({
      model: modelName,
      config: {
        ...generationConfig,
        systemInstruction: systemPrompt,
      },
      contents,
    });

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) {
        continue;
      }
      for (const part of chunk.candidates[0].content.parts) {
        if (!part.text) {
          continue;
        } else if (part.thought) {
          yield { thought: part.text };
        } else {
          yield { text: part.text };
        }
      }
    }
  } catch (e) {
    const error = e as Error;
    if (error.message.includes("400")) {
      throw new Error(
        "Invalid request. Please check your prompt and try again.",
      );
    } else if (error.message.includes("401")) {
      throw new Error("Authentication failed. Please check your API key.");
    } else if (error.message.includes("403")) {
      throw new Error(
        "Permission denied. You do not have permission to call the API.",
      );
    } else if (error.message.includes("404")) {
      throw new Error("The requested resource was not found.");
    } else if (error.message.includes("429")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (error.message.includes("500") || error.message.includes("503")) {
      throw new Error(
        "The service is temporarily unavailable. Please try again later.",
      );
    } else {
      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }
};
