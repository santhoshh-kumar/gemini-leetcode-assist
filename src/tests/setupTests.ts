import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

if (typeof global.structuredClone === "undefined") {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// Shared mock of Chrome API for tests
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
    },
  },
  tabs: {
    query: jest.fn(),
    onRemoved: {
      addListener: jest.fn(),
    },
  },
};

// Make mockChrome available globally
global.chrome = mockChrome as never;

// Mock MutationObserver for jsdom compatibility
global.MutationObserver = class MockMutationObserver {
  constructor(private callback: MutationCallback) {}

  observe() {
    // Call callback immediately to simulate existing DOM elements
    setTimeout(() => {
      this.callback([], this);
    }, 0);
  }

  disconnect() {
    // Mock implementation - do nothing
  }

  takeRecords() {
    return [];
  }
};

// Export for explicit imports if needed
export { mockChrome };
