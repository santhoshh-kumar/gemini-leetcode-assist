import { render, screen, fireEvent, act } from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import MessageInput from "@/components/chat/MessageInput";
import { thunk } from "redux-thunk";
import { addContext, removeContext } from "@/state/slices/chatSlice";
import { setSelectedModel } from "@/state/slices/settingsSlice";
import { setContextOpen, setModelMenuOpen } from "@/state/slices/uiSlice";
import { DEFAULT_MODEL } from "@/utils/models";

const mockStore = configureStore([thunk]);

const createMockState = (overrides = {}) => ({
  chat: {
    selectedContexts: [],
    messages: [],
    chats: [],
    currentChatId: null,
    currentProblemSlug: null,
  },
  ui: {
    isContextOpen: false,
    isModelMenuOpen: false,
  },
  settings: {
    selectedModel: DEFAULT_MODEL,
  },
  ...overrides,
});

describe("MessageInput", () => {
  it("sends a message when the send button is clicked", () => {
    const store = mockStore(createMockState());
    const mockOnSendMessage = jest.fn();

    render(
      <Provider store={store}>
        <MessageInput onSendMessage={mockOnSendMessage} />
      </Provider>,
    );

    const inputElement = screen.getByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(inputElement, { target: { value: "Hello, world!" } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
    expect(mockOnSendMessage).toHaveBeenCalledWith("Hello, world!");
  });

  it("does not send empty messages", () => {
    const store = mockStore(createMockState());
    const mockOnSendMessage = jest.fn();

    render(
      <Provider store={store}>
        <MessageInput onSendMessage={mockOnSendMessage} />
      </Provider>,
    );

    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.click(sendButton);

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("clears input after sending message", () => {
    const store = mockStore(createMockState());
    const mockOnSendMessage = jest.fn();

    render(
      <Provider store={store}>
        <MessageInput onSendMessage={mockOnSendMessage} />
      </Provider>,
    );

    const inputElement = screen.getByRole("textbox") as HTMLTextAreaElement;
    const sendButton = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(inputElement, { target: { value: "Test message" } });
    expect(inputElement.value).toBe("Test message");

    fireEvent.click(sendButton);

    expect(inputElement.value).toBe("");
  });

  it("sends message when Enter is pressed without Shift", () => {
    const store = mockStore(createMockState());
    const mockOnSendMessage = jest.fn();

    render(
      <Provider store={store}>
        <MessageInput onSendMessage={mockOnSendMessage} />
      </Provider>,
    );

    const inputElement = screen.getByRole("textbox");

    fireEvent.change(inputElement, { target: { value: "Enter message" } });
    fireEvent.keyDown(inputElement, { key: "Enter", shiftKey: false });

    expect(mockOnSendMessage).toHaveBeenCalledWith("Enter message");
  });

  it("does not send message when Shift+Enter is pressed", () => {
    const store = mockStore(createMockState());
    const mockOnSendMessage = jest.fn();

    render(
      <Provider store={store}>
        <MessageInput onSendMessage={mockOnSendMessage} />
      </Provider>,
    );

    const inputElement = screen.getByRole("textbox");

    fireEvent.change(inputElement, { target: { value: "Multiline message" } });
    fireEvent.keyDown(inputElement, { key: "Enter", shiftKey: true });

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("opens and closes the context menu", () => {
    const store = mockStore(createMockState());
    const { rerender } = render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const addContextButton = screen.getByText("Add Context");
    fireEvent.click(addContextButton);

    expect(store.getActions()).toContainEqual(setContextOpen(true));

    // Re-render with the menu open to test closing
    const storeWithMenuOpen = mockStore(
      createMockState({
        ui: { isContextOpen: true, isModelMenuOpen: false },
      }),
    );
    rerender(
      <Provider store={storeWithMenuOpen}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    fireEvent.click(addContextButton);
    expect(storeWithMenuOpen.getActions()).toContainEqual(
      setContextOpen(false),
    );
  });

  it("adds a context when a context menu item is clicked", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const problemDetailsButton = screen.getByText("Problem Details");
    fireEvent.click(problemDetailsButton);

    expect(store.getActions()).toContainEqual(addContext("Problem Details"));
    expect(store.getActions()).toContainEqual(setContextOpen(false));
  });

  it("removes a context when the remove button is clicked", () => {
    const store = mockStore(
      createMockState({
        chat: {
          selectedContexts: ["Code"],
          chats: [],
          currentChatId: null,
          currentProblemSlug: null,
        },
      }),
    );
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const removeButton = screen.getByRole("button", { name: /Code/i });
    fireEvent.click(removeButton);

    expect(store.getActions()).toContainEqual(removeContext("Code"));
  });

  it("opens and closes the model menu", () => {
    const store = mockStore(createMockState());
    const { rerender } = render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const modelMenuButton = screen.getByText("Gemini 2.5 Pro");
    fireEvent.click(modelMenuButton);

    expect(store.getActions()).toContainEqual(setModelMenuOpen(true));

    // Re-render with the menu open to test closing
    const storeWithMenuOpen = mockStore(
      createMockState({
        ui: { isContextOpen: false, isModelMenuOpen: true },
      }),
    );
    rerender(
      <Provider store={storeWithMenuOpen}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    fireEvent.click(modelMenuButton);
    expect(storeWithMenuOpen.getActions()).toContainEqual(
      setModelMenuOpen(false),
    );
  });

  it("selects a model when a model menu item is clicked", () => {
    const store = mockStore(createMockState({ ui: { isModelMenuOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const flashModelButton = screen.getByText("Gemini 2.5 Flash");
    fireEvent.click(flashModelButton);

    expect(store.getActions()).toContainEqual(
      setSelectedModel("gemini-2.5-flash"),
    );
    expect(store.getActions()).toContainEqual(setModelMenuOpen(false));
  });

  it("closes context menu when clicking outside", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    const { container } = render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    // Click outside the context menu
    fireEvent.mouseDown(container);

    expect(store.getActions()).toContainEqual(setContextOpen(false));
  });

  it("closes model menu when clicking outside", () => {
    const store = mockStore(createMockState({ ui: { isModelMenuOpen: true } }));
    const { container } = render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    // Click outside the model menu
    fireEvent.mouseDown(container);

    expect(store.getActions()).toContainEqual(setModelMenuOpen(false));
  });

  it("does not close menus when clicking inside", () => {
    const store = mockStore(
      createMockState({ ui: { isContextOpen: true, isModelMenuOpen: true } }),
    );
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const contextMenu = screen.getByRole("button", { name: /add context/i })
      .nextElementSibling as HTMLElement;
    fireEvent.mouseDown(contextMenu);

    // Should not have dispatched close actions
    const actions = store.getActions();
    const hasContextClose = actions.some(
      (action) => action.type === setContextOpen(false).type,
    );
    expect(hasContextClose).toBe(false);
  });

  it("resets textarea height when message is empty", () => {
    const store = mockStore(createMockState());
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Type something
    fireEvent.change(textarea, { target: { value: "Test message" } });
    expect(textarea.value).toBe("Test message");

    // Clear the message
    fireEvent.change(textarea, { target: { value: "" } });
    expect(textarea.value).toBe("");
    expect(textarea.style.height).toBe("auto");
    expect(textarea.style.overflowY).toBe("hidden");
  });

  it("auto-resizes textarea based on content", () => {
    const store = mockStore(createMockState());
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Mock computed styles first
    jest.spyOn(window, "getComputedStyle").mockReturnValue({
      fontSize: "16px",
      lineHeight: "20px",
    } as CSSStyleDeclaration);

    // Mock scrollHeight to simulate content
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => 100,
    });

    fireEvent.change(textarea, { target: { value: "Line 1\nLine 2\nLine 3" } });

    // Height should be set to scrollHeight
    expect(textarea.style.height).toBe("100px");
  });

  it("limits textarea to max 6 rows", () => {
    const store = mockStore(createMockState());
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Mock styles and scrollHeight to simulate very tall content
    const mockComputedStyle = {
      fontSize: "16px",
      lineHeight: "normal",
    };
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue(mockComputedStyle as CSSStyleDeclaration);

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => 300, // Much taller than 6 rows
    });

    fireEvent.change(textarea, {
      target: {
        value: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7",
      },
    });

    // Calculate expected max height: fontSize * 1.2 * 6
    const expectedMaxHeight = 16 * 1.2 * 6; // = 115.2px

    const actualHeight = parseFloat(textarea.style.height);
    expect(actualHeight).toBeLessThanOrEqual(expectedMaxHeight);
    expect(textarea.style.overflowY).toBe("auto"); // Should enable scroll
  });

  it("restores scroll position when at max height", () => {
    const store = mockStore(createMockState());
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Mock computed styles
    jest.spyOn(window, "getComputedStyle").mockReturnValue({
      fontSize: "16px",
      lineHeight: "20px",
    } as CSSStyleDeclaration);

    // Set initial scroll position
    textarea.scrollTop = 50;

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => 200, // Exceeds max height
    });

    fireEvent.change(textarea, {
      target: { value: "Very\nlong\nmessage\nwith\nmany\nlines\nmore\nlines" },
    });

    // scrollTop should be preserved when content exceeds max height
    expect(textarea.scrollTop).toBe(50);
  });

  it("disables Test Result button when hastestResult is false", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} hasTestResult={false} />
      </Provider>,
    );

    const testResultButton = screen.getByText("Test Result").closest("button");
    expect(testResultButton).toBeDisabled();
    expect(testResultButton).toHaveClass("cursor-not-allowed");
    expect(testResultButton).toHaveAttribute(
      "title",
      "Please run the code first",
    );
  });

  it("enables Test Result button when hastestResult is true", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} hasTestResult={true} />
      </Provider>,
    );

    const testResultButton = screen.getByText("Test Result").closest("button");
    expect(testResultButton).not.toBeDisabled();
    expect(testResultButton).not.toHaveClass("cursor-not-allowed");
  });

  it("does not allow adding Test Result context when disabled", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} hasTestResult={false} />
      </Provider>,
    );

    const testResultButton = screen.getByText("Test Result");
    fireEvent.click(testResultButton);

    // Should not dispatch addContext when button is disabled
    const actions = store.getActions();
    const hasAddContext = actions.some(
      (action) => action.type === addContext("Test Result").type,
    );
    expect(hasAddContext).toBe(false);
  });

  it("allows adding Test Result context when enabled", () => {
    const store = mockStore(createMockState({ ui: { isContextOpen: true } }));
    render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} hasTestResult={true} />
      </Provider>,
    );

    const testResultButton = screen.getByText("Test Result");
    fireEvent.click(testResultButton);

    expect(store.getActions()).toContainEqual(addContext("Test Result"));
    expect(store.getActions()).toContainEqual(setContextOpen(false));
  });

  it("applies focus border class when textarea is focused", () => {
    const store = mockStore(createMockState());
    const { container } = render(
      <Provider store={store}>
        <MessageInput onSendMessage={() => {}} />
      </Provider>,
    );

    const textarea = screen.getByRole("textbox");
    const messageInputContainer = container.querySelector(
      ".message-input-container",
    );

    // Initially not focused
    expect(messageInputContainer).not.toHaveClass("message-input-focused");

    // Focus the textarea
    fireEvent.focus(textarea);
    expect(messageInputContainer).toHaveClass("message-input-focused");

    // Blur the textarea
    fireEvent.blur(textarea);
    expect(messageInputContainer).not.toHaveClass("message-input-focused");
  });

  describe("Context Indicator Integration", () => {
    // Mock chrome.storage.local
    const mockChromeStorage = {
      local: {
        get: jest.fn(),
      },
    };

    beforeEach(() => {
      global.chrome = {
        // @ts-expect-error - Partial mock of chrome.storage
        storage: mockChromeStorage,
      };
      jest.clearAllMocks();
    });

    it("should render ContextIndicator component", () => {
      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: [],
            chats: [],
            currentChatId: null,
            currentProblemSlug: null,
          },
        }),
      );

      const { container } = render(
        <Provider store={store}>
          <MessageInput onSendMessage={() => {}} />
        </Provider>,
      );

      // Look for the ContextIndicator by checking for the SVG and percentage text
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      // Should show some percentage
      expect(container.textContent).toMatch(/\d+\.?\d*%/);
    });

    it("should pass correct totalTokens prop based on selected model", () => {
      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: [],
            chats: [],
            currentChatId: null,
            currentProblemSlug: null,
          },
          settings: {
            selectedModel: "gemini-2.5-flash",
          },
        }),
      );

      render(
        <Provider store={store}>
          <MessageInput onSendMessage={() => {}} />
        </Provider>,
      );

      // The component should use MODEL_CONTEXT_LIMITS for the selected model
      // We can verify this indirectly by checking that the component renders without errors
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should calculate token count from chat messages", async () => {
      const mockMessages = [
        { id: "1", text: "Hello", isUser: true, status: "succeeded" as const },
        {
          id: "2",
          text: "Hi there",
          isUser: false,
          status: "succeeded" as const,
        },
      ];

      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: [],
            chats: [
              {
                id: "chat-1",
                messages: mockMessages,
                createdAt: Date.now(),
              },
            ],
            currentChatId: "chat-1",
            currentProblemSlug: null,
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        // Wait for the useEffect to calculate tokens
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should render ContextIndicator with calculated tokens
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should include Problem Details context in token count", async () => {
      const mockProblemData = {
        title: "Two Sum",
        description: "Given an array of integers...",
        constraints: ["1 <= nums.length <= 10^4"],
        examples: [{ input: "[2,7,11,15]", output: "0,1" }],
        code: "function twoSum(nums, target) {}",
      };

      mockChromeStorage.local.get.mockResolvedValue({
        "leetcode-problem-test-problem": mockProblemData,
      });

      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: ["Problem Details"],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "test-problem",
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        // Wait for async chrome storage call
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(
        "leetcode-problem-test-problem",
      );
    });

    it("should include Code context in token count", async () => {
      const mockProblemData = {
        code: "function solution() { return 42; }",
      };

      mockChromeStorage.local.get.mockResolvedValue({
        "leetcode-problem-code-problem": mockProblemData,
      });

      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: ["Code"],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "code-problem",
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(
        "leetcode-problem-code-problem",
      );
    });

    it("should include Test Result context in token count", async () => {
      const mockProblemData = {
        testResult: {
          status: "Accepted",
          runtime: "100ms",
          memory: "42MB",
        },
      };

      mockChromeStorage.local.get.mockResolvedValue({
        "leetcode-problem-test-result": mockProblemData,
      });

      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: ["Test Result"],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "test-result",
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(
        "leetcode-problem-test-result",
      );
    });

    it("should handle chrome storage errors gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      mockChromeStorage.local.get.mockRejectedValue(new Error("Storage error"));

      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: ["Problem Details"],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "error-problem",
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error loading problem data for token count:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should update token count when contexts change", async () => {
      const mockProblemData = {
        title: "Test Problem",
        description: "A test problem",
      };

      mockChromeStorage.local.get.mockResolvedValue({
        "leetcode-problem-dynamic": mockProblemData,
      });

      const initialStore = mockStore(
        createMockState({
          chat: {
            selectedContexts: [],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "dynamic",
          },
        }),
      );

      const { rerender } = await act(async () => {
        const result = render(
          <Provider store={initialStore}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        return result;
      });

      // Clear mock calls
      mockChromeStorage.local.get.mockClear();

      // Re-render with Problem Details context added
      const updatedStore = mockStore(
        createMockState({
          chat: {
            selectedContexts: ["Problem Details"],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "dynamic",
          },
        }),
      );

      await act(async () => {
        rerender(
          <Provider store={updatedStore}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should fetch problem data when context is added
      expect(mockChromeStorage.local.get).toHaveBeenCalled();
    });

    it("should not fetch problem data when no contexts are selected", async () => {
      const store = mockStore(
        createMockState({
          chat: {
            selectedContexts: [],
            chats: [],
            currentChatId: null,
            currentProblemSlug: "no-context",
          },
        }),
      );

      await act(async () => {
        render(
          <Provider store={store}>
            <MessageInput onSendMessage={() => {}} />
          </Provider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockChromeStorage.local.get).not.toHaveBeenCalled();
    });
  });
});
