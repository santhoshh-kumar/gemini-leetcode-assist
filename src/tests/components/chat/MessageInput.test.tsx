import { render, screen, fireEvent } from "@testing-library/react";
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
});
