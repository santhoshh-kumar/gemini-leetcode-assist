import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import MessageInput from "@/components/chat/MessageInput";
import { thunk } from "redux-thunk";
import { addContext, removeContext } from "@/state/slices/chatSlice";
import { setSelectedModel } from "@/state/slices/settingsSlice";
import { setContextOpen, setModelMenuOpen } from "@/state/slices/uiSlice";

const mockStore = configureStore([thunk]);

const createMockState = (overrides = {}) => ({
  chat: {
    selectedContexts: [],
    messages: [],
  },
  ui: {
    isContextOpen: false,
    isModelMenuOpen: false,
  },
  settings: {
    selectedModel: "gemini-2.5-pro",
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
      createMockState({ chat: { selectedContexts: ["Code"] } }),
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
        <MessageInput onSendMessage={() => {}} hastestResult={false} />
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
});
