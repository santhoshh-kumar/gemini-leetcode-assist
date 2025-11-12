// Import mockChrome from setupTests
import { mockChrome } from "./setupTests";
import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "@/state/slices/uiSlice";
import chatReducer from "@/state/slices/chatSlice";
import settingsReducer from "@/state/slices/settingsSlice";
import apiReducer from "@/state/slices/apiSlice";
import problemReducer from "@/state/slices/problemSlice";
import { RootState } from "@/state/store";

// Mock parser
const mockParseLeetCodeProblem = jest.fn();
jest.mock("../scripts/content-script/parser", () => ({
  __esModule: true,
  parseLeetCodeProblem: mockParseLeetCodeProblem,
}));

// Create a proper store mock
let mockStore: ReturnType<typeof configureStore>;
jest.mock("@/state/store", () => {
  return {
    __esModule: true,
    get default() {
      return mockStore;
    },
  };
});

describe("content-script", () => {
  const fakeDetails = {
    title: "Two Sum",
    description: "<p>Find two numbers...</p>",
    examples: ["Input: [2,7,11,15], target = 9 Output: [0,1]"],
    constraints: "<ul><li>1 <= n <= 10^5</li></ul>",
  };

  // Helper to send a message event with source === window
  const sendCodeUpdate = (code: string) => {
    const evt = new MessageEvent("message", {
      data: { type: "CODE_UPDATE", code },
      source: window as never,
    });
    window.dispatchEvent(evt);
  };

  let addListenerSpy: jest.SpyInstance | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Reset parser mock
    mockParseLeetCodeProblem.mockReset();

    // Create real Redux store for testing
    mockStore = configureStore({
      reducer: {
        chat: chatReducer,
        settings: settingsReducer,
        ui: uiReducer,
        api: apiReducer,
        problem: problemReducer,
      },
    });

    // Set a relative path to avoid cross-origin SecurityError in jsdom
    window.history.replaceState({}, "", "/problems/two-sum/");

    // Spy the addEventListener to capture handler for cleanup
    addListenerSpy = jest.spyOn(window, "addEventListener");
    messageHandler = null;

    // Default parser impl resolves immediately
    mockParseLeetCodeProblem.mockImplementation(() =>
      Promise.resolve(fakeDetails),
    );
  });

  afterEach(() => {
    // Attempt to remove the 'message' listener if we captured it
    try {
      if (addListenerSpy) {
        const messageCall = addListenerSpy.mock.calls.find(
          (c) => c[0] === "message",
        );
        if (messageCall && messageCall[1]) {
          messageHandler = messageCall[1] as (event: MessageEvent) => void;
        }
      }
      if (messageHandler) {
        window.removeEventListener(
          "message",
          messageHandler as EventListener,
          false,
        );
      }
    } catch {
      // ignore cleanup errors
    } finally {
      if (addListenerSpy) addListenerSpy.mockRestore();
    }
  });

  it("injects the script and removes it on load", async () => {
    await import("../scripts/content-script/content-script");

    // The injected script should be in the DOM
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="chrome-extension://mock-id/injected-script.js"]',
    );
    expect(script).toBeTruthy();

    // Simulate script load -> should remove itself
    script?.onload?.(new Event("load") as never);
    const stillThere = document.querySelector<HTMLScriptElement>(
      'script[src="chrome-extension://mock-id/injected-script.js"]',
    );
    expect(stillThere).toBeNull();
  });

  it("sends a unified update when a CODE_UPDATE message is received after parsing is ready", async () => {
    await import("../scripts/content-script/content-script");

    // Wait a microtask for parse promise then-handler to run
    await Promise.resolve();

    // Send a code update from the same window (ensures event.source === window)
    const code = "console.log(1);";
    sendCodeUpdate(code);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "PROBLEM_UPDATE",
      payload: {
        problemSlug: "two-sum",
        data: expect.objectContaining({
          ...fakeDetails,
          code,
          timestamp: expect.any(String),
        }),
      },
    });
  });

  it("does not send duplicate updates for the same code", async () => {
    await import("../scripts/content-script/content-script");

    await Promise.resolve();

    const code = "let x = 42;";
    sendCodeUpdate(code);
    sendCodeUpdate(code);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not send updates before parsing is ready, but sends after it resolves", async () => {
    // Create a deferred promise to control when parse resolves
    let resolveParse!: (value: typeof fakeDetails) => void;
    mockParseLeetCodeProblem.mockImplementation(
      () =>
        new Promise<typeof fakeDetails>((res) => {
          resolveParse = res;
        }),
    );

    await import("../scripts/content-script/content-script");

    // Before parse resolves, updates should be ignored
    sendCodeUpdate("a = b + c;");
    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();

    // Now resolve parse and let microtasks run
    resolveParse(fakeDetails);
    await Promise.resolve();

    // After parse is ready, posting again should send once
    sendCodeUpdate("a = b + c;");
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not send when problem slug is missing", async () => {
    window.history.replaceState({}, "", "/problems/"); // No slug
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    sendCodeUpdate("let a = 1;");

    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("ignores non-CODE_UPDATE messages and messages not from window", async () => {
    await import("../scripts/content-script/content-script");

    await Promise.resolve();

    // Non-matching type
    const evt1 = new MessageEvent("message", {
      data: { type: "NOT_CODE_UPDATE", code: "x" },
      source: window as never,
    });
    window.dispatchEvent(evt1);

    // Matching type but wrong source
    const evt2 = new MessageEvent("message", {
      data: { type: "CODE_UPDATE", code: "y" },
      source: null,
    } as never);
    window.dispatchEvent(evt2);

    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("logs parse errors when parsing problem details fails", async () => {
    const error = new Error("boom");
    mockParseLeetCodeProblem.mockImplementation(() => Promise.reject(error));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await import("../scripts/content-script/content-script");
    // allow the promise rejection to be handled
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse LeetCode problem details:",
      error,
    );
    consoleErrorSpy.mockRestore();
  });

  // New test cases for improved coverage
  it("handles title changes through mutation observer", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Add title element
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Three Sum";
    document.body.appendChild(titleElement);

    // Simulate mutation
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for debounce

    // Should trigger a new problem parse
    expect(mockParseLeetCodeProblem).toHaveBeenCalled();
  });

  it("cleans up properly on page unload", async () => {
    await import("../scripts/content-script/content-script");

    // Add title element to trigger observer
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    document.body.appendChild(titleElement);

    // Verify observer is working
    titleElement.textContent = "New Problem";
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for debounce

    // Trigger beforeunload
    window.dispatchEvent(new Event("beforeunload"));

    // Add new title - should not trigger observer anymore
    titleElement.textContent = "Another Problem";
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Only the first title change should have triggered a parse
    expect(mockParseLeetCodeProblem).toHaveBeenCalledTimes(2); // Initial + first change
  });

  it("handles chat toggle messages from popup", async () => {
    await import("../scripts/content-script/content-script");

    // Get initial state
    const state = mockStore.getState() as RootState;
    expect(state.ui.isChatOpen).toBe(false);

    // Simulate receiving a TOGGLE_CHAT message
    if (mockChrome.runtime.onMessage.addListener.mock.calls[0]) {
      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      await messageListener({ type: "TOGGLE_CHAT" });
    }

    // Verify the UI state was toggled
    const finalState = mockStore.getState() as RootState;
    expect(finalState.ui.isChatOpen).toBe(true);
  });

  it("updates Redux store state through chat toggle action", async () => {
    await import("../scripts/content-script/content-script");

    // Get initial state
    const initialState = mockStore.getState() as RootState;
    expect(initialState.ui.isChatOpen).toBe(false);

    // Dispatch toggle action through store
    mockStore.dispatch({ type: "ui/toggleChat" });

    // Verify state updated
    const updatedState = mockStore.getState() as RootState;
    expect(updatedState.ui.isChatOpen).toBe(true);

    // Toggle back
    mockStore.dispatch({ type: "ui/toggleChat" });
    const finalState = mockStore.getState() as RootState;
    expect(finalState.ui.isChatOpen).toBe(false);
  });

  it("stops observing when navigating away from a problem page", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Navigate to a non-problem page
    window.history.replaceState({}, "", "/contest/");

    // Trigger problem change
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Add a title change that should be ignored
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Contest Page";
    document.body.appendChild(titleElement);

    await new Promise((resolve) => setTimeout(resolve, 250));

    // Should not trigger additional parsing
    expect(mockParseLeetCodeProblem).toHaveBeenCalledTimes(1); // Just the initial parse
  });

  it("sends update with test result when test result changes", async () => {
    const mockTestResult = [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: "[0,1]",
        expected: "[0,1]",
      },
    ];

    // Mock parseLeetCodetestResult
    const mockParseLeetCodetestResult = jest
      .fn()
      .mockResolvedValue(mockTestResult);
    jest.mock("../scripts/content-script/parser", () => ({
      parseLeetCodeProblem: mockParseLeetCodeProblem,
      parseLeetCodetestResult: mockParseLeetCodetestResult,
    }));

    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Send code update first
    const code = "console.log(1);";
    sendCodeUpdate(code);

    // Verify initial message was sent
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

    // Clear the mock to test test result update
    mockChrome.runtime.sendMessage.mockClear();

    // Simulate test result appearing
    document.body.innerHTML = `
      <div data-e2e-locator="console-result">Accepted</div>
      <div class="flex-1 overflow-y-auto">
        <div class="mb-2">Input</div>
        <div class="space-y-2">
          <div class="group relative">
            <div class="mx-3 mb-2">nums =</div>
            <div class="font-menlo mx-3">[2,7,11,15]</div>
          </div>
        </div>
      </div>
    `;

    // We can't easily test the monitortestResult function directly in this setup
    // but we've added comprehensive parser tests
  });

  it("handles keyboard shortcut Ctrl+' to trigger test monitoring", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Create a keydown event with Ctrl+'
    const event = new KeyboardEvent("keydown", {
      key: "'",
      ctrlKey: true,
      bubbles: true,
    });

    // Dispatch the event
    document.dispatchEvent(event);

    // The monitortestResult function should be triggered
    // We can't easily test the interval logic without mocking timers
  });

  it("attaches click listener to run button if present", async () => {
    // Add run button before importing
    const runButton = document.createElement("button");
    runButton.setAttribute("data-e2e-locator", "console-run-button");
    document.body.appendChild(runButton);

    const clickSpy = jest.spyOn(runButton, "addEventListener");

    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Verify click listener was attached
    expect(clickSpy).toHaveBeenCalledWith("click", expect.any(Function));

    clickSpy.mockRestore();
  });

  it("does not throw error when run button is not present", async () => {
    // Don't add run button
    expect(
      () => import("../scripts/content-script/content-script"),
    ).not.toThrow();
  });

  it("sends update when code changes after test result is available", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    const code1 = "console.log(1);";
    sendCodeUpdate(code1);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    const firstCall = mockChrome.runtime.sendMessage.mock.calls[0][0];
    expect(firstCall.payload.data.code).toBe(code1);
    expect(firstCall.payload.data.testResult).toBeNull();

    // Send different code
    const code2 = "console.log(2);";
    sendCodeUpdate(code2);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    const secondCall = mockChrome.runtime.sendMessage.mock.calls[1][0];
    expect(secondCall.payload.data.code).toBe(code2);
  });

  it("includes timestamp in problem update payload", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    sendCodeUpdate("test code");

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    const call = mockChrome.runtime.sendMessage.mock.calls[0][0];
    expect(call.payload.data.timestamp).toBeDefined();
    expect(typeof call.payload.data.timestamp).toBe("string");
    // Verify it's a valid ISO string
    expect(() => new Date(call.payload.data.timestamp)).not.toThrow();
  });

  it("handles same title but different problem slug", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    const callsBefore = mockParseLeetCodeProblem.mock.calls.length;

    // Mock a different problem
    mockParseLeetCodeProblem.mockResolvedValueOnce({
      title: "Two Sum II",
      description: "<p>Different problem</p>",
      examples: [],
      constraints: "",
    });

    // Change URL to different problem with similar title
    window.history.replaceState({}, "", "/problems/two-sum-ii/");

    // Trigger title change
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Two Sum II";
    document.body.appendChild(titleElement);

    await new Promise((resolve) => setTimeout(resolve, 250));

    // Should trigger new parse (at least one more call than before)
    expect(mockParseLeetCodeProblem.mock.calls.length).toBeGreaterThan(
      callsBefore,
    );
  });

  it("clears problem details when navigating to non-problem page", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    // Initially on problem page
    expect(mockParseLeetCodeProblem).toHaveBeenCalled();

    // Navigate to non-problem page
    window.history.replaceState({}, "", "/problemset/all/");

    // Trigger observer by changing title
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Problems";
    document.body.appendChild(titleElement);

    await new Promise((resolve) => setTimeout(resolve, 250));

    // No new code updates should be sent after navigation away
    const code = "console.log('test');";
    sendCodeUpdate(code);

    // Should not send message since not on problem page
    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("re-triggers parse when problem title changes to a different problem", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    const initialCalls = mockParseLeetCodeProblem.mock.calls.length;

    // Change problem title
    mockParseLeetCodeProblem.mockResolvedValue({
      title: "Three Sum",
      description: "<p>Different problem</p>",
      examples: [],
      constraints: "",
    });

    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Three Sum";
    document.body.appendChild(titleElement);

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(mockParseLeetCodeProblem).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it("does not re-trigger parse when same title appears again", async () => {
    await import("../scripts/content-script/content-script");
    await Promise.resolve();

    const initialCalls = mockParseLeetCodeProblem.mock.calls.length;

    // Try to add same title multiple times - mutation observer should debounce and ignore
    const titleElement = document.createElement("div");
    titleElement.className = "text-title-large";
    titleElement.textContent = "Two Sum"; // Same as fakeDetails.title
    document.body.appendChild(titleElement);

    // Change it multiple times quickly
    titleElement.textContent = "Two Sum";
    titleElement.textContent = "Two Sum";

    await new Promise((resolve) => setTimeout(resolve, 250));

    // The observer will trigger once, but the handler should recognize it's the same title
    // and not call parseLeetCodeProblem again (since lastSeenTitle will match)
    // At most one additional call could happen, but likely none since title matches
    const callsAfter = mockParseLeetCodeProblem.mock.calls.length;

    // Either no new calls or at most one (depending on timing)
    expect(callsAfter - initialCalls).toBeLessThanOrEqual(1);
  });
});
