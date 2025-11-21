import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import configureStore, { MockStore } from "redux-mock-store";
import Popup from "@/pages/popup/Popup";
import { thunk } from "redux-thunk";
import { saveApiKey } from "@/state/slices/settingsSlice";

// Create a mock store
const mockStore = configureStore([thunk]);

describe("Popup", () => {
  let store: MockStore;

  beforeEach(() => {
    store = mockStore({
      settings: {
        apiKey: "test-api-key",
      },
    });

    // Mock chrome.tabs.query and chrome.tabs.sendMessage
    global.chrome = {
      tabs: {
        query: jest.fn((_, callback) => callback([{ id: 1 }])),
        sendMessage: jest.fn(),
      },
      runtime: {
        lastError: null,
      },
    } as unknown as typeof chrome;
  });

  it("renders the correct title", () => {
    render(
      <Provider store={store}>
        <Popup />
      </Provider>,
    );
    const titleElement = screen.getByText(/Gemini LeetCode Assist/i);
    expect(titleElement).toBeInTheDocument();
  });

  it("shows the settings page when the settings button is clicked", () => {
    render(
      <Provider store={store}>
        <Popup />
      </Provider>,
    );
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByText("Gemini API Key")).toBeInTheDocument();
  });

  it("returns to the main page from the settings page", () => {
    render(
      <Provider store={store}>
        <Popup />
      </Provider>,
    );
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText(/Gemini LeetCode Assist/i)).toBeInTheDocument();
  });

  it("sends a message when 'Open Chat Window' is clicked", () => {
    render(
      <Provider store={store}>
        <Popup />
      </Provider>,
    );
    fireEvent.click(screen.getByText("Open Chat Window"));
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      { type: "TOGGLE_CHAT" },
      expect.any(Function),
    );
  });

  it("dispatches saveApiKey when the save button is clicked", () => {
    render(
      <Provider store={store}>
        <Popup />
      </Provider>,
    );
    fireEvent.click(screen.getByText("Settings"));
    fireEvent.change(screen.getByLabelText("Gemini API Key"), {
      target: { value: "new-api-key" },
    });
    fireEvent.click(screen.getByText("Save"));
    const actions = store.getActions();
    expect(
      actions.some((action) => action.type === saveApiKey.pending.type),
    ).toBe(true);
  });
});
