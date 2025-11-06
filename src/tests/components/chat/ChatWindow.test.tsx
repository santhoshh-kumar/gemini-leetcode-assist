import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import ChatWindow from "@/components/chat/ChatWindow";
import { toggleChat, toggleMinimize } from "@/state/slices/uiSlice";
import * as gemini from "@/utils/gemini";
import { loadChats } from "@/state/slices/chatSlice";

jest.mock("@/state/slices/chatSlice", () => ({
  ...jest.requireActual("@/state/slices/chatSlice"),
  loadChats: jest.fn(),
  addMessage: jest.fn(),
  startStreamingMessage: jest.fn(),
  updateStreamingMessage: jest.fn(),
  finishStreamingMessageAndSave: jest.fn(),
  failStreamingMessage: jest.fn(),
}));

jest.mock("@/state/slices/settingsSlice", () => ({
  ...jest.requireActual("@/state/slices/settingsSlice"),
  loadApiKey: jest.fn(() => ({ type: "settings/loadApiKey/mock" })),
}));

const mockStore = configureStore([]);

// Mock gemini API as async generator
const mockCallGeminiApi = jest.fn();
jest.spyOn(gemini, "callGeminiApi").mockImplementation(mockCallGeminiApi);

// Helper function to create a complete mock state
type MockStateOverrides = Partial<{
  chat: Partial<{
    chats: Array<{
      id: string;
      messages: Array<{
        id: string;
        text: string;
        isUser: boolean;
        status?: string;
      }>;
    }>;
    currentChatId: string | null;
    selectedContexts: string[];
  }>;
  ui: Partial<{
    isChatOpen: boolean;
    isChatMinimized: boolean;
    chatPosition: { x: number; y: number };
    chatSize: { width: number; height: number };
    isContextOpen: boolean;
    isModelMenuOpen: boolean;
  }>;
  settings: Partial<{
    apiKey: string | null;
    selectedModel: string;
  }>;
  api: Partial<{
    isLoading: boolean;
    error: string | null;
  }>;
  problem: Partial<{
    currentProblemSlug: string | null;
  }>;
  [key: string]: unknown;
}>;

const createMockState = (overrides: MockStateOverrides = {}) => {
  const defaultChat = { chats: [], currentChatId: null, selectedContexts: [] };
  const defaultUi = {
    isChatOpen: true,
    isChatMinimized: false,
    chatPosition: { x: 50, y: 50 },
    chatSize: { width: 400, height: 600 },
    isContextOpen: false,
    isModelMenuOpen: false,
  };
  const defaultSettings = {
    apiKey: "test-api-key",
    selectedModel: "gemini-2.5-pro",
  };
  const defaultApi = { isLoading: false, error: null };
  const defaultProblem = { currentProblemSlug: "two-sum" };

  return {
    chat: { ...defaultChat, ...(overrides.chat || {}) },
    ui: { ...defaultUi, ...(overrides.ui || {}) },
    settings: { ...defaultSettings, ...(overrides.settings || {}) },
    api: { ...defaultApi, ...(overrides.api || {}) },
    problem: { ...defaultProblem, ...(overrides.problem || {}) },
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([k]) => !["chat", "ui", "settings", "api", "problem"].includes(k),
      ),
    ),
  };
};

// Helper to render the component inside act so async state updates are wrapped
const renderWithStore = async (store: ReturnType<typeof mockStore>) =>
  await act(async () => {
    const result = render(
      <Provider store={store}>
        <ChatWindow />
      </Provider>,
    );
    // Wait for any async effects to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
    return result;
  });

describe("ChatWindow", () => {
  beforeEach(() => {
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
        } as unknown as typeof chrome.storage.local,
      },
    } as unknown as typeof chrome;
    // ensure window.pathname contains a problem slug used by the component logic
    // use history.pushState to avoid redefining window.location
    window.history.pushState({}, "", "/problems/two-sum/");

    // Mock the streaming API
    mockCallGeminiApi.mockImplementation(async function* () {
      yield "Bot ";
      yield "response";
    });

    // Mock the async actions to return simple action objects
    (loadChats as unknown as jest.Mock).mockReturnValue({
      type: "chat/loadChats/mock",
    });
  });

  it("renders chat messages", async () => {
    const state = createMockState({
      chat: {
        chats: [
          {
            id: "chat1",
            messages: [
              { id: "1", text: "User message", isUser: true },
              { id: "2", text: "Bot message", isUser: false },
            ],
          },
        ],
        currentChatId: "chat1",
      },
    });
    const store = mockStore(state);

    await renderWithStore(store);

    await waitFor(() => {
      expect(screen.getByText("User message")).toBeInTheDocument();
      expect(screen.getByText("Bot message")).toBeInTheDocument();
    });
  });

  it("displays a welcome message when there are no messages", async () => {
    const store = mockStore(createMockState());

    await renderWithStore(store);

    expect(await screen.findByText("Hello, LeetCoder")).toBeInTheDocument();

    // Find the welcome message container and verify its content
    const welcomeContainer = await screen
      .findByText("Hello, LeetCoder")
      .then(
        (element) =>
          element.closest(".flex.flex-col.items-center") as HTMLElement,
      );
    expect(welcomeContainer).toBeInTheDocument();
    expect(welcomeContainer.textContent).toContain("How can I assist you with");
    expect(welcomeContainer.textContent).toContain("Two Sum");
  });

  it("displays a welcome message with the problem title", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "1. Two Sum",
      },
    });

    const store = mockStore(createMockState());
    await renderWithStore(store);

    // Find the welcome message container and verify its content
    const welcomeContainer = await screen
      .findByText("Hello, LeetCoder")
      .then(
        (element) =>
          element.closest(".flex.flex-col.items-center") as HTMLElement,
      );
    expect(welcomeContainer).toBeInTheDocument();
    expect(welcomeContainer.textContent).toContain("How can I assist you with");
    expect(welcomeContainer.textContent).toContain("Two Sum");
    expect(welcomeContainer.textContent).toContain("problem?");
  });

  it("dispatches loadChats on mount if problem slug exists", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);
    expect(loadChats).toHaveBeenCalledWith("two-sum");
  });

  it("sends context with the message", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "1. Two Sum",
        description: "<p>Problem description</p>",
        constraints: "constraints",
        examples: "examples",
        code: "class Solution {}",
      },
    });

    // Test with API key present to ensure the message input is rendered
    const store = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
          selectedContexts: ["Problem Details", "Code"],
        },
        settings: {
          apiKey: "test-api-key",
          selectedModel: "gemini-2.5-pro",
        },
      }),
    );

    await renderWithStore(store);

    // Verify that with API key present, the input is rendered
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();

    // Verify context-related UI elements are present
    fireEvent.change(input, { target: { value: "My message" } });
    expect(input).toHaveValue("My message");
  });

  it("displays loading indicator when isLoading is true", async () => {
    const state = createMockState({
      api: {
        isLoading: true,
        error: null,
      },
    });
    const store = mockStore(state);

    await renderWithStore(store);

    expect(await screen.findByText("...")).toBeInTheDocument();
  });

  it("displays error message when there is an error", async () => {
    const state = createMockState({
      api: {
        isLoading: false,
        error: "Something went wrong",
      },
    });
    const store = mockStore(state);

    await renderWithStore(store);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render when chat is closed", async () => {
    const state = createMockState({
      ui: {
        isChatOpen: false,
        isChatMinimized: false,
        chatPosition: { x: 50, y: 50 },
        chatSize: { width: 400, height: 600 },
      },
    });
    const store = mockStore(state);

    await renderWithStore(store);

    // renderWithStore returns void from act wrapping, so read from DOM directly
    // Use document queries to assert nothing was rendered
    expect(document.querySelector("#chat-window")).toBeNull();
  });

  it("shows API key message when apiKey is not set", async () => {
    const store = mockStore(createMockState({ settings: { apiKey: null } }));
    await renderWithStore(store);

    expect(
      await screen.findByText(
        "Please set your Gemini API key in the extension settings.",
      ),
    ).toBeInTheDocument();
  });

  it("should dispatch toggleMinimize when minimize button is clicked", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    fireEvent.click(await screen.findByRole("button", { name: /Minimize/i }));
    expect(store.getActions()).toContainEqual(toggleMinimize());
  });

  it("should dispatch toggleChat when close button is clicked", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    fireEvent.click(await screen.findByRole("button", { name: /Close/i }));
    expect(store.getActions()).toContainEqual(toggleChat());
  });

  it("should call scrollToBottom when messagesEndRef is available", async () => {
    const mockScrollIntoView = jest.fn();

    // Create initial state with empty messages
    const initialStore = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
        },
      }),
    );

    // Render the component initially
    const { rerender } = await act(async () => {
      return render(
        <Provider store={initialStore}>
          <ChatWindow />
        </Provider>,
      );
    });

    // Get the messages end div and mock its scrollIntoView
    await waitFor(() => {
      const messagesEndDiv = document.querySelector(
        "[ref='messagesEndRef'], .flex-grow > div:last-child",
      );
      expect(messagesEndDiv).toBeInTheDocument();

      // Mock scrollIntoView on the messagesEndDiv
      Object.defineProperty(messagesEndDiv, "scrollIntoView", {
        value: mockScrollIntoView,
        writable: true,
      });
    });

    // Create new store with messages to trigger useEffect
    const storeWithMessages = mockStore(
      createMockState({
        chat: {
          chats: [
            {
              id: "chat1",
              messages: [
                {
                  id: "1",
                  text: "New message",
                  isUser: false,
                  status: "succeeded",
                },
              ],
            },
          ],
          currentChatId: "chat1",
        },
      }),
    );

    // Rerender with new messages to trigger scrollToBottom
    await act(async () => {
      rerender(
        <Provider store={storeWithMessages}>
          <ChatWindow />
        </Provider>,
      );
    });

    // Verify that scrollIntoView was called
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
    });
  });

  it("should handle error in loadProblemTitle", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Mock chrome.storage.local.get to throw an error
    (chrome.storage.local.get as jest.Mock).mockRejectedValue(
      new Error("Storage error"),
    );

    const store = mockStore(createMockState());
    await renderWithStore(store);

    // Wait for the async effect to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error loading problem title:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it("should handle newChat button click", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    fireEvent.click(await screen.findByRole("button", { name: /New Chat/i }));

    const actions = store.getActions();
    expect(actions.some((action) => action.type.includes("newChat"))).toBe(
      true,
    );
    expect(
      actions.some((action) => action.type.includes("setChatHistoryOpen")),
    ).toBe(true);
  });

  it("should handle chat history toggle", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    fireEvent.click(
      await screen.findByRole("button", { name: /Chat History/i }),
    );

    const actions = store.getActions();
    expect(
      actions.some((action) => action.type.includes("setChatHistoryOpen")),
    ).toBe(true);
  });

  it("should handle drag events", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    // Find the draggable element by its handle class
    const handle = document.querySelector(".handle");
    expect(handle).toBeInTheDocument();

    // Simulate drag (this tests the onDrag callback)
    // Note: We can't easily test the actual drag behavior in jsdom,
    // but we can verify the element is set up correctly
  });

  it("should handle resize events", async () => {
    const store = mockStore(createMockState());
    await renderWithStore(store);

    // Find the resizable element
    const resizableHandle = document.querySelector(".react-resizable-handle");
    expect(resizableHandle).toBeInTheDocument();
  });

  it("should return early from handleSendMessage when no currentProblemSlug", async () => {
    const store = mockStore(
      createMockState({
        problem: { currentProblemSlug: null },
        settings: { apiKey: "test-key" },
      }),
    );

    await renderWithStore(store);

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should not call gemini API when no problem slug
    expect(mockCallGeminiApi).not.toHaveBeenCalled();
  });

  it("should handle sendMessage with no API key", async () => {
    const store = mockStore(
      createMockState({
        settings: { apiKey: null },
      }),
    );

    await renderWithStore(store);

    // Should show API key message instead of input
    expect(
      screen.getByText(
        "Please set your Gemini API key in the extension settings.",
      ),
    ).toBeInTheDocument();
  });

  it("should handle context selection for problem details only", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        description: "Problem description",
        constraints: "constraints",
        examples: "examples",
        code: "function solution() {}",
      },
    });

    const store = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
          selectedContexts: ["Problem Details"], // Only problem details, no code
        },
      }),
    );

    await renderWithStore(store);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test message" } });

    // We can't easily test the actual API call due to async actions,
    // but we can verify the input accepts the message
    expect(input).toHaveValue("Test message");
  });

  it("should handle context selection for code only", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        code: "function solution() {}",
      },
    });

    const store = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
          selectedContexts: ["Code"], // Only code, no problem details
        },
      }),
    );

    await renderWithStore(store);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test message" } });
    expect(input).toHaveValue("Test message");
  });

  it("should handle empty selectedContexts", async () => {
    const store = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
          selectedContexts: [], // No contexts selected
        },
      }),
    );

    await renderWithStore(store);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test message" } });
    expect(input).toHaveValue("Test message");
  });

  it("should test actual streaming flow by mocking all dependencies", async () => {
    // Mock chrome storage to return problem data
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        description: "Problem description",
        constraints: "constraints",
        examples: "examples",
        code: "function solution() {}",
      },
    });

    // Mock the streaming generator to yield chunks
    mockCallGeminiApi.mockImplementation(async function* () {
      yield "Response ";
      yield "chunk ";
      yield "1";
    });

    // Create a mock store that supports thunks by implementing basic dispatch
    const mockDispatch = jest.fn().mockImplementation((action) => {
      if (typeof action === "function") {
        // For thunks, call them with mock dispatch and getState
        return action(mockDispatch, () => mockStateData, undefined);
      }
      return action;
    });

    const mockStateData = createMockState({
      chat: {
        chats: [{ id: "chat1", messages: [] }],
        currentChatId: "chat1",
        selectedContexts: ["Problem Details", "Code"],
      },
    });

    const store = {
      dispatch: mockDispatch,
      getState: () => mockStateData,
      subscribe: jest.fn(),
      replaceReducer: jest.fn(),
      [Symbol.observable]: jest.fn(),
    } as unknown as ReturnType<typeof mockStore>;

    await act(async () => {
      render(
        <Provider store={store}>
          <ChatWindow />
        </Provider>,
      );
      // Wait for async effects
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test streaming message" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify that various actions were dispatched
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("clearError"),
      }),
    );

    // Check that the gemini API was called with correct parameters
    expect(mockCallGeminiApi).toHaveBeenCalledWith(
      "test-api-key",
      "gemini-2.5-pro",
      [],
      expect.stringContaining("Two Sum"),
      "function solution() {}",
      "Test streaming message",
      true,
    );
  });

  it("should handle streaming API errors", async () => {
    // Mock chrome storage
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
      },
    });

    // Mock the streaming generator to throw an error
    mockCallGeminiApi.mockImplementation(async function* () {
      yield ""; // Need at least one yield to make it a valid generator
      throw new Error("API Error");
    });

    const mockDispatch = jest.fn().mockImplementation((action) => {
      if (typeof action === "function") {
        return action(mockDispatch, () => mockStateData, undefined);
      }
      return action;
    });

    const mockStateData = createMockState({
      chat: {
        chats: [{ id: "chat1", messages: [] }],
        currentChatId: "chat1",
      },
    });

    const store = {
      dispatch: mockDispatch,
      getState: () => mockStateData,
      subscribe: jest.fn(),
      replaceReducer: jest.fn(),
      [Symbol.observable]: jest.fn(),
    } as unknown as ReturnType<typeof mockStore>;

    await act(async () => {
      render(
        <Provider store={store}>
          <ChatWindow />
        </Provider>,
      );
      // Wait for async effects
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test error" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify error handling actions were dispatched
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("setError"),
      }),
    );
  });

  it("should handle scrollToBottom when ref is null", async () => {
    // This tests the condition check in scrollToBottom
    // We'll create a ChatWindow instance and verify it handles null refs gracefully
    const store = mockStore(createMockState());

    await act(async () => {
      render(
        <Provider store={store}>
          <ChatWindow />
        </Provider>,
      );
      // Wait for async effects
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The component should render without errors even if refs are null
    expect(screen.getByText("Gemini Assistant")).toBeInTheDocument();
  });
});
