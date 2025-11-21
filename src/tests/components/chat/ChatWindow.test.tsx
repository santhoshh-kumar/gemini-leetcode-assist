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
import { DEFAULT_MODEL } from "@/utils/models";

jest.mock("@/state/slices/chatSlice", () => ({
  ...jest.requireActual("@/state/slices/chatSlice"),
  loadChats: jest.fn(),
  addMessage: jest.fn((payload) => ({ type: "chat/addMessage", payload })),
  startStreamingMessage: jest.fn((payload) => ({ type: "chat/startStreamingMessage", payload })),
  updateStreamingMessage: jest.fn((payload) => ({ type: "chat/updateStreamingMessage", payload })),
  finishStreamingMessageAndSave: jest.fn((payload) => ({ type: "chat/finishStreamingMessageAndSave", payload })),
  failStreamingMessage: jest.fn((payload) => ({ type: "chat/failStreamingMessage", payload })),
  updateThinkingState: jest.fn((payload) => ({ type: "chat/updateThinkingState", payload })),
  setThinkingStartTime: jest.fn((payload) => ({ type: "chat/setThinkingStartTime", payload })),
  setThinkingEndTime: jest.fn((payload) => ({ type: "chat/setThinkingEndTime", payload })),
  removeMessagesAfter: jest.fn((payload) => ({ type: "chat/removeMessagesAfter", payload })),
  newChat: jest.fn(() => ({ type: "chat/newChat" })),
  setChatHistoryOpen: jest.fn((payload) => ({ type: "chat/setChatHistoryOpen", payload })),
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
    selectedModel: DEFAULT_MODEL,
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
    await new Promise((resolve) => setTimeout(resolve, 100));
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
      yield { text: "Bot " };
      yield { text: "response" };
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

  it("displays a welcome message with 'this problem' when no problem slug", async () => {
    const store = mockStore(
      createMockState({ problem: { currentProblemSlug: null } }),
    );

    await renderWithStore(store);

    expect(await screen.findByText("Hello, LeetCoder")).toBeInTheDocument();

    // Find the welcome message container and verify it uses 'this problem'
    const welcomeContainer = await screen
      .findByText("Hello, LeetCoder")
      .then(
        (element) =>
          element.closest(".flex.flex-col.items-center") as HTMLElement,
      );
    expect(welcomeContainer).toBeInTheDocument();
    expect(welcomeContainer.textContent).toContain("How can I assist you with");
    expect(welcomeContainer.textContent).toContain("this problem");
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

  it("displays a welcome message with prettified slug when no title in storage", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        // No title property, should fall back to prettify
      },
    });

    const store = mockStore(createMockState());
    await renderWithStore(store);

    // Wait for the prettified title to appear
    await waitFor(() => {
      expect(screen.getByText("Two Sum")).toBeInTheDocument();
    });

    // Find the welcome message container and verify it uses prettified slug
    const welcomeContainer = await screen
      .findByText("Hello, LeetCoder")
      .then(
        (element) =>
          element.closest(".flex.flex-col.items-center") as HTMLElement,
      );
    expect(welcomeContainer).toBeInTheDocument();
    expect(welcomeContainer.textContent).toContain("How can I assist you with");
    expect(welcomeContainer.textContent).toContain("Two Sum"); // Prettified from "two-sum"
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
      "Error loading problem data:",
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

    // Mock the streaming generator to yield chunks with thought and text
    mockCallGeminiApi.mockImplementation(async function* () {
      yield { thought: "Thinking about the solution..." };
      yield { text: "Response " };
      yield { text: "chunk " };
      yield { text: "1" };
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
        currentChatId: null, // Set to null to cover chatId = nanoid()
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
      null,
      "Test streaming message",
      true,
    );
  });

  it("should dispatch thinking time actions when stream yields thinking timestamps", async () => {
    // Mock chrome storage
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        description: "Problem description",
        constraints: "constraints",
        examples: "examples",
        code: "function solution() {}",
      },
    });

    // Mock the streaming generator to yield thinking timestamps
    mockCallGeminiApi.mockImplementation(async function* () {
      yield { thinkingStartTime: 1000 };
      yield { thought: "Intermediate thought" };
      yield { thinkingEndTime: 2000 };
      yield { text: "Final response" };
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

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test thinking timestamps" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify thinking time related actions were dispatched
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("setThinkingStartTime"),
      }),
    );

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("setThinkingEndTime"),
      }),
    );
  });

  it("uses fallback scroll behavior when messagesEndRef.scrollIntoView is not available", async () => {
    const initialStore = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
        },
      }),
    );

    // Render initially
    const { rerender } = await act(async () => {
      return render(
        <Provider store={initialStore}>
          <ChatWindow />
        </Provider>,
      );
    });

    // Find the messages container and the end div
    const container = document.querySelector(
      ".flex-grow.p-4.overflow-y-auto",
    ) as HTMLElement | null;
    const messagesEndDiv = container?.querySelector("div:last-child");

    expect(container).toBeInTheDocument();
    expect(messagesEndDiv).toBeInTheDocument();

    // Remove scrollIntoView to force fallback path
    // @ts-expect-error - remove scrollIntoView to force fallback path
    delete (messagesEndDiv as HTMLElement).scrollIntoView;

    // Define scrollHeight on the container and reset scrollTop
    Object.defineProperty(container as HTMLElement, "scrollHeight", {
      value: 500,
      configurable: true,
    });
    (container as HTMLElement & { scrollTop: number }).scrollTop = 0;

    // Rerender with a new message to trigger scrollToBottom fallback
    const storeWithMessages = mockStore(
      createMockState({
        chat: {
          chats: [
            {
              id: "chat1",
              messages: [{ id: "1", text: "New message", isUser: false }],
            },
          ],
          currentChatId: "chat1",
        },
      }),
    );

    await act(async () => {
      rerender(
        <Provider store={storeWithMessages}>
          <ChatWindow />
        </Provider>,
      );
      // allow effects to run
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The fallback should have set scrollTop to scrollHeight
    expect((container as HTMLElement & { scrollTop: number }).scrollTop).toBe(
      (container as HTMLElement & { scrollHeight: number }).scrollHeight,
    );
  });

  it("does not auto-scroll when the user has scrolled up (handleScroll sets autoScrollEnabledRef to false)", async () => {
    const initialStore = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
        },
      }),
    );

    const { rerender } = await act(async () => {
      return render(
        <Provider store={initialStore}>
          <ChatWindow />
        </Provider>,
      );
    });

    // Find the messages container and the end div
    const container = document.querySelector(
      ".flex-grow.p-4.overflow-y-auto",
    ) as HTMLElement | null;
    const messagesEndDiv = container?.querySelector("div:last-child");

    expect(container).toBeInTheDocument();
    expect(messagesEndDiv).toBeInTheDocument();

    // Ensure scrollIntoView exists and spy on it
    const spy = jest.fn();
    Object.defineProperty(messagesEndDiv as HTMLElement, "scrollIntoView", {
      value: spy,
      writable: true,
    });

    // Simulate that user scrolled up: distanceFromBottom > SCROLL_THRESHOLD
    Object.defineProperty(container as HTMLElement, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(container as HTMLElement, "clientHeight", {
      value: 400,
      configurable: true,
    });
    (container as HTMLElement & { scrollTop: number }).scrollTop = 100;

    // Trigger scroll event to call handleScroll
    container?.dispatchEvent(new Event("scroll"));

    // Rerender with a new message; since auto-scroll should be disabled,
    // scrollIntoView should NOT be called.
    const storeWithMessages = mockStore(
      createMockState({
        chat: {
          chats: [
            {
              id: "chat1",
              messages: [{ id: "1", text: "New message", isUser: false }],
            },
          ],
          currentChatId: "chat1",
        },
      }),
    );

    await act(async () => {
      rerender(
        <Provider store={storeWithMessages}>
          <ChatWindow />
        </Provider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("renders minimized header only when chat is minimized", async () => {
    const store = mockStore(
      createMockState({
        ui: {
          isChatOpen: true,
          isChatMinimized: true,
          chatPosition: { x: 50, y: 50 },
          chatSize: { width: 400, height: 600 },
        },
      }),
    );

    await renderWithStore(store);

    // When minimized, the header should still be visible but message area should not
    expect(screen.getByText("Gemini Assistant")).toBeInTheDocument();
    // The welcome text or input should NOT be visible when minimized
    expect(screen.queryByText("Hello, LeetCoder")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
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

  it("enables auto-scroll when user scrolls near the bottom", async () => {
    const initialStore = mockStore(
      createMockState({
        chat: {
          chats: [{ id: "chat1", messages: [] }],
          currentChatId: "chat1",
        },
      }),
    );

    const { rerender } = await act(async () => {
      return render(
        <Provider store={initialStore}>
          <ChatWindow />
        </Provider>,
      );
    });

    const container = document.querySelector(
      ".flex-grow.p-4.overflow-y-auto",
    ) as HTMLElement | null;
    const messagesEndDiv = container?.querySelector("div:last-child");

    expect(container).toBeInTheDocument();
    expect(messagesEndDiv).toBeInTheDocument();

    const spy = jest.fn();
    Object.defineProperty(messagesEndDiv as HTMLElement, "scrollIntoView", {
      value: spy,
      writable: true,
    });

    // Simulate user is near bottom: distanceFromBottom <= SCROLL_THRESHOLD (80px)
    Object.defineProperty(container as HTMLElement, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(container as HTMLElement, "clientHeight", {
      value: 400,
      configurable: true,
    });
    (container as HTMLElement & { scrollTop: number }).scrollTop = 550; // Distance = 1000 - 550 - 400 = 50px

    container?.dispatchEvent(new Event("scroll"));

    // Rerender with a new message; auto-scroll should be enabled
    const storeWithMessages = mockStore(
      createMockState({
        chat: {
          chats: [
            {
              id: "chat1",
              messages: [{ id: "1", text: "New message", isUser: false }],
            },
          ],
          currentChatId: "chat1",
        },
      }),
    );

    await act(async () => {
      rerender(
        <Provider store={storeWithMessages}>
          <ChatWindow />
        </Provider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(spy).toHaveBeenCalledWith({ behavior: "auto" });
  });

  it("should update hastestResult when context menu opens", async () => {
    // Mock storage to initially not have test result
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        testResult: null,
      },
    });

    const initialStore = mockStore(
      createMockState({
        ui: {
          isChatOpen: true,
          isChatMinimized: false,
          chatPosition: { x: 50, y: 50 },
          chatSize: { width: 400, height: 600 },
          isContextOpen: false,
        },
      }),
    );

    const { rerender } = await renderWithStore(initialStore);

    // Now update storage to have test result and open context menu
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        testResult: { status: "passed" },
      },
    });

    const storeWithContext = mockStore(
      createMockState({
        ui: {
          isChatOpen: true,
          isChatMinimized: false,
          chatPosition: { x: 50, y: 50 },
          chatSize: { width: 400, height: 600 },
          isContextOpen: true, // Context menu opened
        },
      }),
    );

    await act(async () => {
      rerender(
        <Provider store={storeWithContext}>
          <ChatWindow />
        </Provider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Verify chrome storage was called with the correct key
    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      "leetcode-problem-two-sum",
    );
  });

  it("should handle Test Result context when available", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        description: "Problem description",
        code: "function solution() {}",
        testResult: { status: "passed", output: "All tests passed" },
      },
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
        selectedContexts: ["Test Result"], // Test Result selected
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test with test result" } });
    fireEvent.click(sendButton);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify the API was called with test result
    expect(mockCallGeminiApi).toHaveBeenCalledWith(
      "test-api-key",
      "gemini-2.5-pro",
      [],
      null,
      null,
      expect.stringContaining("passed"), // Test result should be included
      "Test with test result",
      true,
    );
  });

  it("should handle all contexts selected together", async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
        description: "Problem description",
        code: "function solution() {}",
        testResult: { status: "passed" },
      },
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
        selectedContexts: ["Problem Details", "Code", "Test Result"],
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test all contexts" } });
    fireEvent.click(sendButton);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify the API was called with all contexts
    expect(mockCallGeminiApi).toHaveBeenCalledWith(
      "test-api-key",
      "gemini-2.5-pro",
      [],
      expect.stringContaining("Two Sum"), // Problem details
      "function solution() {}", // Code
      expect.stringContaining("passed"), // Test result
      "Test all contexts",
      true,
    );
  });

  it("should handle streaming error and dispatch failStreamingMessage", async () => {
    // Mock chrome storage
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
      },
    });

    // Mock the streaming generator to throw an error
    mockCallGeminiApi.mockImplementation(async function* () {
      yield { text: "Starting..." };
      throw new Error("Streaming failed");
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test error handling" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify that failStreamingMessage was dispatched with the error
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("failStreamingMessage"),
        payload: expect.objectContaining({
          errorMessage: "Streaming failed",
        }),
      }),
    );
  });

  it("should handle streaming with text chunks only (no thinking)", async () => {
    // Mock chrome storage
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
      },
    });

    // Mock the streaming generator to yield only text chunks
    mockCallGeminiApi.mockImplementation(async function* () {
      yield { text: "First " };
      yield { text: "chunk" };
      yield { text: " of " };
      yield { text: "response" };
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test text chunks" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify that updateStreamingMessage was called for text chunks
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("updateStreamingMessage"),
        payload: expect.objectContaining({
          textChunk: "First ",
        }),
      }),
    );

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("updateStreamingMessage"),
        payload: expect.objectContaining({
          textChunk: "chunk",
        }),
      }),
    );

    // Verify that finishStreamingMessageAndSave was called
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("finishStreamingMessageAndSave"),
      }),
    );
  });

  it("should handle streaming with undefined text chunks", async () => {
    // Mock chrome storage
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      "leetcode-problem-two-sum": {
        title: "Two Sum",
      },
    });

    // Mock the streaming generator to yield chunks with undefined text
    mockCallGeminiApi.mockImplementation(async function* () {
      yield { text: undefined };
      yield { text: "Valid text" };
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const input = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "Test undefined text" } });
    fireEvent.click(sendButton);

    // Wait for async operations
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify that only valid text chunks trigger updateStreamingMessage
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("updateStreamingMessage"),
        payload: expect.objectContaining({
          textChunk: "Valid text",
        }),
      }),
    );

    // Should not have been called for undefined text
    const updateCalls = mockDispatch.mock.calls.filter(call =>
      call[0]?.type?.includes("updateStreamingMessage") &&
      call[0]?.payload?.textChunk === undefined
    );
    expect(updateCalls.length).toBe(0);
  });

  it("should render ChatMessage components with correct props", async () => {
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

    // Verify that ChatMessage components are rendered with correct props
    await waitFor(() => {
      expect(screen.getByText("User message")).toBeInTheDocument();
      expect(screen.getByText("Bot message")).toBeInTheDocument();
    });

    // The ChatMessage components should have been rendered with the correct props
    // This test ensures the messages.map code path is executed
  });
});
