import { GoogleGenAI, GenerationConfig, Content } from "@google/genai";
import { Chat } from "../state/slices/chatSlice";

export type StreamEvent = {
  text?: string;
  thought?: string;
  thinkingStartTime?: number;
  thinkingEndTime?: number;
};

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
 * @returns An async generator that yields StreamEvent objects containing text chunks, thoughts, and timing metadata.
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
    You are an expert competitive programmer and mentor who is going to help solve leetcode problems.

    IMPORTANT: Do NOT reveal full solutions, step-by-step approaches, pseudocode, or complete code unless the user explicitly requests a full solution.
    Examples of explicit requests include phrases such as "show solution", "give full solution", "reveal approach", "complete code", or equivalent requests.
    Examples that may look like asking for it but not: "Can you help me with this problem?" or "How do I approach this problem"
    By default, prefer response styles in the following order (most to least preferred):

    1. Socratic questions that guide the user to discover the answer themselves (most preferred).
    2. Targeted hints and nudges (short, focused pointers toward the next step).
    3. Diagnostic observations pointing out suspicious lines, likely root causes, or targeted tests to run.
    4. High-level conceptual explanations that clarify constraints, trade-offs, and intuition without revealing the exact approach.
    5. Minimal illustrative examples or tiny snippets only when they clarify a concept (never full solutions).
    6. step-by-step approach to solve the problem (no code).
    7. Full solutions, step-by-step approaches, pseudocode, or complete code — only when the user explicitly requests a full solution (least preferred).

    Use the highest-preference style that answers the user's intent while minimizing spoilers.

    Adapt your style dynamically based on how the user interacts, but keep all guidance non-spoiler by default:

    - If the user shares code, act as a debugging assistant: ask clarifying questions, request minimal reproducible inputs, point out suspicious lines or off-by-one/error-prone patterns, suggest targeted tests, and offer brief hints. 
    Do NOT provide working fixes, full patches, or exact lines of replacement unless the user explicitly asks for a solution or code change.
    - If the user asks about a problem, act as a teacher: explain the key concepts, constraints, trade-offs, and intuition needed to make progress, using examples and leading questions that avoid revealing the exact approach or algorithm.
    - If they express emotions (e.g., frustration, excitement), respond empathetically and motivate them.
    - If they are brainstorming casually, be a friendly coding buddy and suggest ideas at a high level without revealing step-by-step instructions.

    Provide full solutions only when explicitly requested by the user. WHEN PROVIDING FULL SOLUTIONS (only upon explicit user request), include ALL of the following:
    - **Problem Analysis**: Clear restatement and understanding of constraints/requirements.
    - **Approach Explanation**: Step-by-step reasoning (use blockquotes asking questions 'why?' and answer those questions).
    - **Algorithm Overview**: High-level pseudocode or algorithm description.
    - **Complete Code Solution**: Well-commented, optimized implementation.
    - **Time & Space Complexity**: Detailed Big O analysis with explanations (use table).
    - **Dry Run / Walkthrough**: Step-by-step execution example.
    - **Key Insights**: Important observations, optimizations, or follow-up questions.

    When context is provided (like problem details or code), use it only if it is relevant to the user's current message.
    - If the user asks something that requires context (e.g., questions about their code or a problem) but no context was provided, ask them politely to click on \`Add Context\` and select the context (problem details or code) that is missing in the user's input.
    - If the user's message is unrelated to the provided context (for example, a greeting or a casual question), ignore the context and respond naturally to their message alone.

    Always keep responses concise, structured, and practical for competitive programming.

    **FORMATTING REQUIREMENTS - USE THESE MARKDOWN FORMATS EXTENSIVELY:**

    - **Tables** for: algorithm comparisons, time/space complexity analysis, simple test cases, simple dry runs
      * Always use proper Markdown table syntax with | separators and --- header separators
      * Ensure tables are properly formatted with consistent column alignment
      * Example: | Column1 | Column2 |\n|---------|---------|\n| Value1  | Value2  |
    - **Nested Lists** for: step-by-step algorithms, decision trees, hierarchical concepts, complex test cases, complex dry runs
    - **Code Blocks** for: code examples, pseudocode, mathematical formulas
    - **Headers** to organize: approach explanations, solution steps, key concepts
    - **Bold/Italic** for: key terms, important warnings, emphasis on critical points
    - **Blockquotes** for: tips, hints, asking questions, common mistakes, best practices (only one question / hint inside a blockquote - for multiple questions, use multiple seperate blockquotes).
    - **Horizontal Rules**: Use --- to separate major sections

    Structure every response with at least one header / multiple headers (when applicable), at least one blockquote and table (when applicable), nested lists, and code formatting where appropriate.
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
          ${problemDetails || "No problem details provided."}

          User Code:
          ${userCode || "No code provided."}

          User's latest message to respond to: ${currentUserMessage}`,
        },
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

    let thinkingStartTime: number | undefined;
    let thinkingEndTime: number | undefined;
    let hasThinking = false;

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) {
        continue;
      }
      for (const part of chunk.candidates[0].content.parts) {
        if (!part.text) {
          continue;
        } else if (part.thought) {
          // First thought - record start time
          if (!hasThinking) {
            thinkingStartTime = Date.now();
            hasThinking = true;
            yield { thought: part.text, thinkingStartTime };
          } else {
            yield { thought: part.text };
          }
        } else {
          // First text chunk after thinking - record end time
          if (hasThinking && !thinkingEndTime) {
            thinkingEndTime = Date.now();
            yield { text: part.text, thinkingEndTime };
          } else {
            yield { text: part.text };
          }
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
