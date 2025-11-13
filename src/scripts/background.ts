chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handler for other parts of the extension that might need the tab ID
  if (message.type === "GET_TAB_ID") {
    if (sender.tab?.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          sendResponse({ tabId: tabs[0].id });
        } else {
          sendResponse({ tabId: undefined });
        }
      });
      return true; // Indicates asynchronous response
    }
  }
  // Handler for receiving the unified problem data from the content script
  else if (message.type === "PROBLEM_UPDATE") {
    const { problemSlug, data } = message.payload;
    if (problemSlug) {
      const key = `leetcode-problem-${problemSlug}`;
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            `Error setting storage key "${key}": ${chrome.runtime.lastError.message}`,
          );
        }
      });
    }
  }
});
