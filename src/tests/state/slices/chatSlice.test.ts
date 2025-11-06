import chatReducer, {
  addMessage,
  addContext,
  removeContext,
  setCurrentChat,
  newChat,
  updateChatTimestamp,
  loadChats,
  startStreamingMessage,
  updateStreamingMessage,
  finishStreamingMessage,
  failStreamingMessage,
  finishStreamingMessageAndSave,
  ChatState,
  Chat,
  ChatMessage,
} from "@/state/slices/chatSlice";
import { saveChat, loadChats as loadChatsFromDB } from "@/utils/db";

jest.mock("@/utils/db");

// Mock Date.now() for consistent timestamp testing
const mockNow = 1234567890000;
jest.spyOn(Date, "now").mockImplementation(() => mockNow);

const initialState: ChatState = {
  chats: [],
  currentChatId: null,
  selectedContexts: ["Problem Details", "Code"],
  currentProblemSlug: null,
  loading: "idle",
  currentRequestId: undefined,
};

describe("chatSlice", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should return the initial state", () => {
    expect(chatReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  describe("addMessage extraReducers", () => {
    const messageId = "msg1";
    const chatId = "chat1";
    const text = "Hello";
    const isUser = true;

    it("should handle addMessage.pending for a new chat", () => {
      const action = {
        type: addMessage.pending.type,
        meta: { arg: { text, isUser, messageId, chatId } },
      };
      const state = chatReducer(initialState, action);
      expect(state.chats.length).toBe(1);
      expect(state.chats[0].id).toBe(chatId);
      expect(state.chats[0].messages.length).toBe(1);
      expect(state.chats[0].messages[0]).toEqual({
        id: messageId,
        text,
        isUser,
        status: "sending",
      });
      expect(state.currentChatId).toBe(chatId);
    });

    it("should handle addMessage.pending for an existing chat", () => {
      const existingState: ChatState = {
        ...initialState,
        chats: [
          {
            id: chatId,
            messages: [] as ChatMessage[],
            lastUpdated: mockNow - 1000,
          },
        ],
        currentChatId: chatId,
      };
      const action = {
        type: addMessage.pending.type,
        meta: { arg: { text, isUser, messageId, chatId } },
      };
      const state = chatReducer(existingState, action);
      expect(state.chats.length).toBe(1);
      expect(state.chats[0].messages.length).toBe(1);
      expect(state.chats[0].messages[0]).toEqual({
        id: messageId,
        text,
        isUser,
        status: "sending",
      });
      // Should update timestamp when adding message
      expect(state.chats[0].lastUpdated).toBe(mockNow);
    });

    it("should handle addMessage.fulfilled", () => {
      const pendingState: ChatState = {
        ...initialState,
        chats: [
          {
            id: chatId,
            messages: [{ id: messageId, text, isUser, status: "sending" }],
            lastUpdated: mockNow,
          },
        ],
        currentChatId: chatId,
      };
      const action = {
        type: addMessage.fulfilled.type,
        payload: { chatId, messageId },
      };
      const state = chatReducer(pendingState, action);
      expect(state.chats[0].messages[0].status).toBe("succeeded");
    });

    it("should handle addMessage.rejected", () => {
      const pendingState: ChatState = {
        ...initialState,
        chats: [
          {
            id: chatId,
            messages: [{ id: messageId, text, isUser, status: "sending" }],
            lastUpdated: mockNow,
          },
        ],
        currentChatId: chatId,
      };
      const action = {
        type: addMessage.rejected.type,
        payload: { chatId, messageId },
      };
      const state = chatReducer(pendingState, action);
      expect(state.chats[0].messages[0].status).toBe("failed");
    });
  });

  it("should handle addContext", () => {
    const state = chatReducer(initialState, addContext("New Context"));
    expect(state.selectedContexts).toEqual([
      "Problem Details",
      "Code",
      "New Context",
    ]);
  });

  it("should not add a context if it already exists", () => {
    const state = chatReducer(initialState, addContext("Code"));
    expect(state.selectedContexts).toEqual(["Problem Details", "Code"]);
  });

  it("should handle removeContext", () => {
    const state = chatReducer(initialState, removeContext("Code"));
    expect(state.selectedContexts).toEqual(["Problem Details"]);
  });

  it("should handle setCurrentChat", () => {
    const state = chatReducer(initialState, setCurrentChat("chat1"));
    expect(state.currentChatId).toBe("chat1");
  });

  describe("newChat", () => {
    it("should create a new chat with timestamp", () => {
      const state = chatReducer(initialState, newChat());
      expect(state.chats.length).toBe(1);
      expect(state.currentChatId).toBe(state.chats[0].id);
      expect(state.chats[0].lastUpdated).toBe(mockNow);
      expect(state.chats[0].messages).toEqual([]);
    });

    it("should reuse existing empty chat instead of creating new one", () => {
      const stateWithEmptyChat: ChatState = {
        ...initialState,
        chats: [
          { id: "empty-chat", messages: [], lastUpdated: mockNow - 1000 },
          {
            id: "chat-with-messages",
            messages: [
              { id: "msg1", text: "Hello", isUser: true, status: "succeeded" },
            ],
            lastUpdated: mockNow - 2000,
          },
        ],
        currentChatId: "chat-with-messages",
      };

      const state = chatReducer(stateWithEmptyChat, newChat());

      // Should not create a new chat
      expect(state.chats.length).toBe(2);
      // Should switch to the empty chat
      expect(state.currentChatId).toBe("empty-chat");
      // Should update the timestamp of the empty chat
      expect(state.chats[0].lastUpdated).toBe(mockNow);
    });

    it("should create new chat when all existing chats have messages", () => {
      const stateWithChats: ChatState = {
        ...initialState,
        chats: [
          {
            id: "chat1",
            messages: [
              { id: "msg1", text: "Hello", isUser: true, status: "succeeded" },
            ],
            lastUpdated: mockNow - 1000,
          },
        ],
        currentChatId: "chat1",
      };

      const state = chatReducer(stateWithChats, newChat());

      expect(state.chats.length).toBe(2);
      expect(state.currentChatId).not.toBe("chat1");
      expect(state.chats[1].messages).toEqual([]);
      expect(state.chats[1].lastUpdated).toBe(mockNow);
    });
  });

  describe("updateChatTimestamp", () => {
    it("should update timestamp of specified chat", () => {
      const oldTimestamp = mockNow - 5000;
      const stateWithChat: ChatState = {
        ...initialState,
        chats: [{ id: "chat1", messages: [], lastUpdated: oldTimestamp }],
        currentChatId: "chat1",
      };

      const state = chatReducer(stateWithChat, updateChatTimestamp("chat1"));

      expect(state.chats[0].lastUpdated).toBe(mockNow);
    });

    it("should not affect other chats", () => {
      const oldTimestamp1 = mockNow - 5000;
      const oldTimestamp2 = mockNow - 3000;
      const stateWithChats: ChatState = {
        ...initialState,
        chats: [
          { id: "chat1", messages: [], lastUpdated: oldTimestamp1 },
          { id: "chat2", messages: [], lastUpdated: oldTimestamp2 },
        ],
        currentChatId: "chat1",
      };

      const state = chatReducer(stateWithChats, updateChatTimestamp("chat1"));

      expect(state.chats[0].lastUpdated).toBe(mockNow);
      expect(state.chats[1].lastUpdated).toBe(oldTimestamp2); // unchanged
    });

    it("should do nothing if chat not found", () => {
      const stateWithChat: ChatState = {
        ...initialState,
        chats: [{ id: "chat1", messages: [], lastUpdated: mockNow - 1000 }],
        currentChatId: "chat1",
      };

      const state = chatReducer(
        stateWithChat,
        updateChatTimestamp("nonexistent"),
      );

      expect(state).toEqual(stateWithChat);
    });
  });

  describe("loadChats thunk", () => {
    it("should load chats and set the most recent as current", async () => {
      const mockChats: Chat[] = [
        { id: "chat1", messages: [], lastUpdated: mockNow - 2000 },
        { id: "chat2", messages: [], lastUpdated: mockNow }, // Most recent
      ];
      (loadChatsFromDB as jest.Mock).mockResolvedValue(mockChats);
      const dispatch = jest.fn();
      const thunk = loadChats("two-sum");
      await thunk(dispatch, () => ({ chat: initialState }), undefined);
      const { calls } = dispatch.mock;
      expect(calls.length).toBe(2);
      expect(calls[0][0].type).toBe("chat/loadChats/pending");
      expect(calls[1][0].type).toBe("chat/loadChats/fulfilled");
      expect(calls[1][0].payload).toEqual(mockChats);

      const pendingState = chatReducer(initialState, calls[0][0]);
      const finalState = chatReducer(pendingState, calls[1][0]);
      expect(finalState.chats).toEqual(mockChats);
      // Should select the most recent chat (chat2)
      expect(finalState.currentChatId).toBe("chat2");
      expect(finalState.currentProblemSlug).toBe("two-sum");
    });

    it("should create a new chat if none are loaded", async () => {
      (loadChatsFromDB as jest.Mock).mockResolvedValue([]);
      const dispatch = jest.fn();
      const thunk = loadChats("two-sum");
      await thunk(dispatch, () => ({ chat: initialState }), undefined);
      const { calls } = dispatch.mock;
      const pendingState = chatReducer(initialState, calls[0][0]);
      const finalState = chatReducer(pendingState, calls[1][0]);
      expect(finalState.chats.length).toBe(1);
      expect(finalState.currentChatId).toBe(finalState.chats[0].id);
      expect(finalState.currentProblemSlug).toBe("two-sum");
    });

    it("should merge new chats with existing ones", async () => {
      // Setup state with an existing chat
      const existingChat: Chat = {
        id: "chat1",
        messages: [],
        lastUpdated: mockNow - 1000,
      };
      const currentState: ChatState = {
        ...initialState,
        chats: [existingChat],
        currentChatId: existingChat.id,
        currentProblemSlug: "two-sum",
      };

      // Setup mock for loading chats
      const newChat: Chat = { id: "chat2", messages: [], lastUpdated: mockNow };
      (loadChatsFromDB as jest.Mock).mockResolvedValue([newChat]);

      // Run the thunk
      const dispatch = jest.fn();
      const thunk = loadChats("two-sum");
      await thunk(dispatch, () => ({ chat: currentState }), undefined);

      const pendingAction = {
        type: loadChats.pending.type,
        meta: { arg: "two-sum", requestId: "test" },
      };

      const fulfilledAction = {
        type: loadChats.fulfilled.type,
        payload: [newChat],
        meta: { arg: "two-sum", requestId: "test" },
      };

      // Apply actions in sequence
      let state = chatReducer(currentState, pendingAction);
      state = chatReducer(state, fulfilledAction);

      // Verify both chats are present
      expect(state.chats).toEqual(
        expect.arrayContaining([existingChat, newChat]),
      );
      expect(state.currentProblemSlug).toBe("two-sum");
    });

    it("should handle rejection on chat load failure", async () => {
      const error = new Error("Failed to load chats");
      (loadChatsFromDB as jest.Mock).mockRejectedValue(error);

      const dispatch = jest.fn();
      const thunk = loadChats("two-sum");
      await thunk(dispatch, () => ({ chat: initialState }), undefined);

      const { calls } = dispatch.mock;
      expect(calls.length).toBe(2);
      expect(calls[0][0].type).toBe("chat/loadChats/pending");
      expect(calls[1][0].type).toBe("chat/loadChats/rejected");

      const pendingState = chatReducer(initialState, calls[0][0]);
      const finalState = chatReducer(pendingState, calls[1][0]);
      expect(finalState.loading).toBe("idle");
    });

    it("should handle different problem slug in between load", async () => {
      const mockChats: Chat[] = [
        { id: "chat1", messages: [], lastUpdated: mockNow },
      ];
      (loadChatsFromDB as jest.Mock).mockResolvedValue(mockChats);

      // Start with problem1
      let state = chatReducer(initialState, {
        type: "chat/loadChats/pending",
        meta: { arg: "problem1", requestId: "test1" },
      });

      // Change to problem2 before first load completes
      state = chatReducer(state, {
        type: "chat/loadChats/pending",
        meta: { arg: "problem2", requestId: "test2" },
      });

      // Complete problem1's load (should be ignored)
      state = chatReducer(state, {
        type: "chat/loadChats/fulfilled",
        payload: mockChats,
        meta: { arg: "problem1", requestId: "test1" },
      });

      // Verify state matches problem2's state
      expect(state.currentProblemSlug).toBe("problem2");
      expect(state.chats).toEqual([]);
    });
  });

  describe("chat storage operations", () => {
    const message: ChatMessage = {
      id: "msg1",
      text: "Hello",
      isUser: true,
      status: "sending",
    };

    it("should save chat with timestamp and handle success", async () => {
      const state: ChatState = {
        ...initialState,
        chats: [{ id: "chat1", messages: [message], lastUpdated: mockNow }],
        currentChatId: "chat1",
      };

      (saveChat as jest.Mock).mockResolvedValue(undefined);

      const dispatch = jest.fn();
      const thunk = addMessage({
        text: message.text,
        isUser: message.isUser,
        problemSlug: "test-problem",
        messageId: message.id,
        chatId: "chat1",
      });

      await thunk(dispatch, () => ({ chat: state }), undefined);

      expect(saveChat).toHaveBeenCalledWith(
        "test-problem",
        "chat1",
        expect.any(Array),
        mockNow, // lastUpdated timestamp
      );

      const finalState = chatReducer(
        state,
        dispatch.mock.calls[dispatch.mock.calls.length - 1][0],
      );
      expect(finalState.chats[0].messages[0].status).toBe("succeeded");
    });

    it("should handle save failure", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const state: ChatState = {
        ...initialState,
        chats: [{ id: "chat1", messages: [message], lastUpdated: mockNow }],
        currentChatId: "chat1",
      };

      const error = new Error("Failed to save");
      (saveChat as jest.Mock).mockRejectedValue(error);

      const dispatch = jest.fn();
      const thunk = addMessage({
        text: message.text,
        isUser: message.isUser,
        problemSlug: "test-problem",
        messageId: message.id,
        chatId: "chat1",
      });

      await thunk(dispatch, () => ({ chat: state }), undefined);

      const finalState = chatReducer(
        state,
        dispatch.mock.calls[dispatch.mock.calls.length - 1][0],
      );
      expect(finalState.chats[0].messages[0].status).toBe("failed");
      consoleErrorSpy.mockRestore();
    });
  });

  describe("streaming message actions", () => {
    const chatId = "chat1";
    const messageId = "msg1";
    const initialChatState: ChatState = {
      ...initialState,
      chats: [{ id: chatId, messages: [], lastUpdated: mockNow - 1000 }],
      currentChatId: chatId,
    };

    describe("startStreamingMessage", () => {
      it("should add a new streaming message to the chat", () => {
        const action = startStreamingMessage({
          chatId,
          messageId,
          text: "",
        });
        const state = chatReducer(initialChatState, action);

        expect(state.chats[0].messages.length).toBe(1);
        expect(state.chats[0].messages[0]).toEqual({
          id: messageId,
          text: "",
          isUser: false,
          status: "streaming",
          thinking: [],
        });
        expect(state.chats[0].lastUpdated).toBe(mockNow);
      });

      it("should do nothing if chat doesn't exist", () => {
        const action = startStreamingMessage({
          chatId: "nonexistent",
          messageId,
          text: "",
        });
        const state = chatReducer(initialChatState, action);

        expect(state.chats[0].messages.length).toBe(0);
      });
    });

    describe("updateStreamingMessage", () => {
      it("should append text chunk to streaming message", () => {
        // First add a streaming message
        let state = chatReducer(
          initialChatState,
          startStreamingMessage({
            chatId,
            messageId,
            text: "Hello",
          }),
        );

        // Then update it with more text
        const action = updateStreamingMessage({
          chatId,
          messageId,
          textChunk: " world",
        });
        state = chatReducer(state, action);

        expect(state.chats[0].messages[0].text).toBe("Hello world");
        expect(state.chats[0].messages[0].status).toBe("streaming");
      });

      it("should only update streaming messages", () => {
        // Add a non-streaming message
        const nonStreamingState: ChatState = {
          ...initialState,
          chats: [
            {
              id: chatId,
              messages: [
                {
                  id: messageId,
                  text: "Complete",
                  isUser: false,
                  status: "succeeded",
                },
              ],
              lastUpdated: mockNow - 1000,
            },
          ],
          currentChatId: chatId,
        };

        const action = updateStreamingMessage({
          chatId,
          messageId,
          textChunk: " more",
        });
        const state = chatReducer(nonStreamingState, action);

        // Message should not be updated
        expect(state.chats[0].messages[0].text).toBe("Complete");
      });

      it("should do nothing if chat or message doesn't exist", () => {
        const action = updateStreamingMessage({
          chatId: "nonexistent",
          messageId,
          textChunk: " more",
        });
        const state = chatReducer(initialChatState, action);

        expect(state).toEqual(initialChatState);
      });
    });

    describe("finishStreamingMessage", () => {
      it("should mark streaming message as succeeded", () => {
        // First add a streaming message
        let state = chatReducer(
          initialChatState,
          startStreamingMessage({
            chatId,
            messageId,
            text: "Complete message",
          }),
        );

        // Then finish it
        const action = finishStreamingMessage({
          chatId,
          messageId,
        });
        state = chatReducer(state, action);

        expect(state.chats[0].messages[0].status).toBe("succeeded");
        expect(state.chats[0].lastUpdated).toBe(mockNow);
      });

      it("should only finish streaming messages", () => {
        const nonStreamingState: ChatState = {
          ...initialState,
          chats: [
            {
              id: chatId,
              messages: [
                {
                  id: messageId,
                  text: "Already done",
                  isUser: false,
                  status: "succeeded",
                },
              ],
              lastUpdated: mockNow - 1000,
            },
          ],
          currentChatId: chatId,
        };

        const action = finishStreamingMessage({
          chatId,
          messageId,
        });
        const state = chatReducer(nonStreamingState, action);

        // Status should remain unchanged and timestamp should not be updated for non-streaming messages
        expect(state.chats[0].messages[0].status).toBe("succeeded");
        expect(state.chats[0].lastUpdated).toBe(mockNow - 1000);
      });
    });

    describe("failStreamingMessage", () => {
      it("should mark streaming message as failed with error text", () => {
        // First add a streaming message
        let state = chatReducer(
          initialChatState,
          startStreamingMessage({
            chatId,
            messageId,
            text: "Partial message",
          }),
        );

        // Then fail it
        const action = failStreamingMessage({
          chatId,
          messageId,
          errorMessage: "API Error occurred",
        });
        state = chatReducer(state, action);

        expect(state.chats[0].messages[0].status).toBe("failed");
        expect(state.chats[0].messages[0].text).toBe("API Error occurred");
      });

      it("should only fail streaming messages", () => {
        const nonStreamingState: ChatState = {
          ...initialState,
          chats: [
            {
              id: chatId,
              messages: [
                {
                  id: messageId,
                  text: "Good message",
                  isUser: false,
                  status: "succeeded",
                },
              ],
              lastUpdated: mockNow - 1000,
            },
          ],
          currentChatId: chatId,
        };

        const action = failStreamingMessage({
          chatId,
          messageId,
          errorMessage: "Error",
        });
        const state = chatReducer(nonStreamingState, action);

        // Message should remain unchanged
        expect(state.chats[0].messages[0].status).toBe("succeeded");
        expect(state.chats[0].messages[0].text).toBe("Good message");
      });
    });

    describe("finishStreamingMessageAndSave async thunk", () => {
      it("should save chat and mark message as succeeded", async () => {
        const streamingState: ChatState = {
          ...initialState,
          chats: [
            {
              id: chatId,
              messages: [
                {
                  id: messageId,
                  text: "Complete",
                  isUser: false,
                  status: "streaming",
                },
              ],
              lastUpdated: mockNow,
            },
          ],
          currentChatId: chatId,
        };

        (saveChat as jest.Mock).mockResolvedValue(undefined);

        const dispatch = jest.fn();
        const thunk = finishStreamingMessageAndSave({
          chatId,
          messageId,
          problemSlug: "test-problem",
        });

        await thunk(dispatch, () => ({ chat: streamingState }), undefined);

        expect(saveChat).toHaveBeenCalledWith(
          "test-problem",
          chatId,
          expect.any(Array),
          mockNow,
        );

        const { calls } = dispatch.mock;
        expect(calls.length).toBe(2);
        expect(calls[0][0].type).toBe(
          "chat/finishStreamingMessageAndSave/pending",
        );
        expect(calls[1][0].type).toBe(
          "chat/finishStreamingMessageAndSave/fulfilled",
        );

        // Test the pending reducer
        const pendingState = chatReducer(streamingState, calls[0][0]);
        expect(pendingState.chats[0].messages[0].status).toBe("succeeded");
        expect(pendingState.chats[0].lastUpdated).toBe(mockNow);
      });

      it("should handle save failure", async () => {
        const consoleErrorSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const streamingState: ChatState = {
          ...initialState,
          chats: [
            {
              id: chatId,
              messages: [
                {
                  id: messageId,
                  text: "Complete",
                  isUser: false,
                  status: "streaming",
                },
              ],
              lastUpdated: mockNow,
            },
          ],
          currentChatId: chatId,
        };

        const error = new Error("Save failed");
        (saveChat as jest.Mock).mockRejectedValue(error);

        const dispatch = jest.fn();
        const thunk = finishStreamingMessageAndSave({
          chatId,
          messageId,
          problemSlug: "test-problem",
        });

        await thunk(dispatch, () => ({ chat: streamingState }), undefined);

        const { calls } = dispatch.mock;
        expect(calls[calls.length - 1][0].type).toBe(
          "chat/finishStreamingMessageAndSave/rejected",
        );

        // Test the rejected reducer
        const rejectedState = chatReducer(
          streamingState,
          calls[calls.length - 1][0],
        );
        expect(rejectedState.chats[0].messages[0].status).toBe("failed");

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
