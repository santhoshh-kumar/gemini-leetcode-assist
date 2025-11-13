import {
  createSlice,
  PayloadAction,
  nanoid,
  createAsyncThunk,
} from "@reduxjs/toolkit";
import { saveChat, loadChats as loadChatsFromDB } from "@/utils/db";
import { PROCESSING_MESSAGE } from "@/constants/chat";

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  status: "sending" | "succeeded" | "failed" | "streaming";
  thinking?: string[];
  thinkingStartTime?: number; // Unix timestamp in ms
  thinkingEndTime?: number; // Unix timestamp in ms
}

export interface Chat {
  id: string;
  messages: ChatMessage[];
  title?: string;
  lastUpdated?: number; // Unix timestamp in milliseconds
}

/**
 * Selects the most recent chat from an array of chats based on lastUpdated timestamp.
 * Safely handles missing lastUpdated values by treating them as 0.
 * @param chats - Array of chats to search
 * @returns The most recent chat, or undefined if the array is empty
 */
export function getMostRecentChat(chats: Chat[]): Chat | undefined {
  if (chats.length === 0) {
    return undefined;
  }

  return chats.reduce((latest, chat) =>
    (chat.lastUpdated ?? 0) > (latest.lastUpdated ?? 0) ? chat : latest,
  );
}

export interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  selectedContexts: string[];
  currentProblemSlug: string | null;
  loading: "idle" | "pending";
  currentRequestId: string | undefined;
}

const initialState: ChatState = {
  chats: [],
  currentChatId: null,
  selectedContexts: ["Problem Details", "Code"],
  currentProblemSlug: null,
  loading: "idle",
  currentRequestId: undefined,
};

export const loadChats = createAsyncThunk(
  "chat/loadChats",
  async (problemSlug: string) => {
    const chats = await loadChatsFromDB(problemSlug);
    return chats;
  },
);

export const addMessage = createAsyncThunk(
  "chat/addMessage",
  async (
    payload: {
      text: string;
      isUser: boolean;
      problemSlug: string;
      messageId: string;
      chatId: string;
    },
    { getState, rejectWithValue },
  ) => {
    const { problemSlug, chatId, messageId } = payload;
    const state = getState() as { chat: { chats: Chat[] } };
    const chat = state.chat.chats.find((c) => c.id === chatId);

    if (!chat) {
      console.error("Chat not found:", { problemSlug, chatId, messageId });
      return rejectWithValue({ chatId, messageId });
    }

    try {
      await saveChat(
        problemSlug,
        chatId,
        structuredClone(chat.messages),
        chat.lastUpdated,
      );
      return { chatId, messageId };
    } catch (error) {
      console.error("Failed to save chat:", {
        problemSlug,
        chatId,
        messageId,
        error,
      });
      return rejectWithValue({ chatId, messageId });
    }
  },
);

export const finishStreamingMessageAndSave = createAsyncThunk(
  "chat/finishStreamingMessageAndSave",
  async (
    payload: {
      chatId: string;
      messageId: string;
      problemSlug: string;
    },
    { getState, rejectWithValue },
  ) => {
    const { problemSlug, chatId, messageId } = payload;
    const state = getState() as { chat: { chats: Chat[] } };
    const chat = state.chat.chats.find((c) => c.id === chatId);

    if (!chat) {
      console.error("Chat not found:", { problemSlug, chatId, messageId });
      return rejectWithValue({ chatId, messageId });
    }

    try {
      await saveChat(
        problemSlug,
        chatId,
        structuredClone(chat.messages),
        chat.lastUpdated,
      );
      return { chatId, messageId };
    } catch (error) {
      console.error("Failed to save streaming message:", {
        problemSlug,
        chatId,
        messageId,
        error,
      });
      return rejectWithValue({ chatId, messageId });
    }
  },
);

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addContext: (state, action: PayloadAction<string>) => {
      if (!state.selectedContexts.includes(action.payload)) {
        state.selectedContexts.push(action.payload);
      }
    },
    removeContext: (state, action: PayloadAction<string>) => {
      state.selectedContexts = state.selectedContexts.filter(
        (context) => context !== action.payload,
      );
    },
    setCurrentChat: (state, action: PayloadAction<string>) => {
      state.currentChatId = action.payload;
    },
    newChat: (state) => {
      // First, check if there's already an empty chat
      const emptyChat = state.chats.find((c) => c.messages.length === 0);

      if (emptyChat) {
        // Navigate to the existing empty chat and update its timestamp
        state.currentChatId = emptyChat.id;
        emptyChat.lastUpdated = Date.now();
      } else {
        // Create a new chat only if no empty chat exists
        const newChatId = nanoid();
        state.chats.push({
          id: newChatId,
          messages: [],
          lastUpdated: Date.now(),
        });
        state.currentChatId = newChatId;
      }
    },
    updateChatTimestamp: (state, action: PayloadAction<string>) => {
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.lastUpdated = Date.now();
      }
    },
    updateThinkingState: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        thought: string;
      }>,
    ) => {
      const { chatId, messageId, thought } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message) {
          // Initialize thinking array if not exists, then append new thought
          if (!message.thinking) {
            message.thinking = [];
          }
          message.thinking.push(thought);
          // Clear processing text when first thought arrives
          if (message.text === PROCESSING_MESSAGE) {
            message.text = "";
          }
        }
      }
    },
    startStreamingMessage: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        text: string;
      }>,
    ) => {
      const { chatId, messageId, text } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.messages.push({
          id: messageId,
          text,
          isUser: false,
          status: "streaming",
          thinking: [],
        });
        chat.lastUpdated = Date.now();
      }
    },
    updateStreamingMessage: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        textChunk: string;
      }>,
    ) => {
      const { chatId, messageId, textChunk } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message && message.status === "streaming") {
          if (message.text === PROCESSING_MESSAGE) {
            message.text = textChunk;
          } else {
            message.text += textChunk;
          }
        }
      }
    },
    finishStreamingMessage: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
      }>,
    ) => {
      const { chatId, messageId } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message && message.status === "streaming") {
          message.status = "succeeded";
          chat.lastUpdated = Date.now();
        }
      }
    },
    setThinkingStartTime: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        timestamp: number;
      }>,
    ) => {
      const { chatId, messageId, timestamp } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message) {
          message.thinkingStartTime = timestamp;
        }
      }
    },
    setThinkingEndTime: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        timestamp: number;
      }>,
    ) => {
      const { chatId, messageId, timestamp } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message) {
          message.thinkingEndTime = timestamp;
        }
      }
    },
    failStreamingMessage: (
      state,
      action: PayloadAction<{
        chatId: string;
        messageId: string;
        errorMessage: string;
      }>,
    ) => {
      const { chatId, messageId, errorMessage } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        const message = chat.messages.find((m) => m.id === messageId);
        if (message && message.status === "streaming") {
          message.status = "failed";
          message.text = errorMessage;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadChats.pending, (state, action) => {
        state.loading = "pending";
        state.currentRequestId = action.meta.requestId;
        if (state.currentProblemSlug !== action.meta.arg) {
          state.chats = [];
          state.currentChatId = null;
        }
        state.currentProblemSlug = action.meta.arg;
      })
      .addCase(loadChats.fulfilled, (state, action) => {
        if (
          state.loading === "pending" &&
          state.currentRequestId === action.meta.requestId
        ) {
          state.loading = "idle";
          state.currentRequestId = undefined;

          if (action.meta.arg !== state.currentProblemSlug) {
            return;
          }

          const loadedChats = action.payload;
          const existingChats = state.chats;

          if (existingChats.length === 0) {
            state.chats = loadedChats;
            if (state.chats.length > 0) {
              // Select the most recent chat (highest lastUpdated timestamp)
              const mostRecentChat = getMostRecentChat(state.chats);
              state.currentChatId = mostRecentChat?.id ?? null;
            } else {
              const newChatId = nanoid();
              state.chats.push({
                id: newChatId,
                messages: [],
                lastUpdated: Date.now(),
              });
              state.currentChatId = newChatId;
            }
            return;
          }

          const existingChatMap = new Map(existingChats.map((c) => [c.id, c]));

          for (const loadedChat of loadedChats) {
            if (!existingChatMap.has(loadedChat.id)) {
              state.chats.push(loadedChat);
            }
          }

          if (
            !state.currentChatId ||
            !state.chats.find((c) => c.id === state.currentChatId)
          ) {
            if (state.chats.length > 0) {
              // Select the most recent chat (highest lastUpdated timestamp)
              const mostRecentChat = getMostRecentChat(state.chats);
              state.currentChatId = mostRecentChat?.id ?? null;
            }
          }
        }
      })
      .addCase(loadChats.rejected, (state, action) => {
        if (
          state.loading === "pending" &&
          state.currentRequestId === action.meta.requestId
        ) {
          state.loading = "idle";
          state.currentRequestId = undefined;
        }
      })
      .addCase(addMessage.pending, (state, action) => {
        const { text, isUser, messageId, chatId } = action.meta.arg;
        let chat = state.chats.find((c) => c.id === chatId);
        if (!chat) {
          chat = { id: chatId, messages: [], lastUpdated: Date.now() };
          state.chats.push(chat);
          state.currentChatId = chatId;
        }
        chat.messages.push({ id: messageId, text, isUser, status: "sending" });
        chat.lastUpdated = Date.now();
      })
      .addCase(addMessage.fulfilled, (state, action) => {
        const { chatId, messageId } = action.payload;
        const chat = state.chats.find((c) => c.id === chatId);
        if (chat) {
          const message = chat.messages.find((m) => m.id === messageId);
          if (message) {
            message.status = "succeeded";
          }
        }
      })
      .addCase(addMessage.rejected, (state, action) => {
        const { chatId, messageId } = action.payload as {
          chatId: string;
          messageId: string;
        };
        const chat = state.chats.find((c) => c.id === chatId);
        if (chat) {
          const message = chat.messages.find((m) => m.id === messageId);
          if (message) {
            message.status = "failed";
          }
        }
      })
      .addCase(finishStreamingMessageAndSave.pending, (state, action) => {
        const { chatId, messageId } = action.meta.arg;
        const chat = state.chats.find((c) => c.id === chatId);
        if (chat) {
          const message = chat.messages.find((m) => m.id === messageId);
          if (message && message.status === "streaming") {
            message.status = "succeeded";
            chat.lastUpdated = Date.now();
          }
        }
      })
      .addCase(finishStreamingMessageAndSave.fulfilled, (_state, _action) => {
        // Message is already marked as succeeded in pending case
        // This case is mainly for completion tracking if needed
      })
      .addCase(finishStreamingMessageAndSave.rejected, (state, action) => {
        const { chatId, messageId } = action.payload as {
          chatId: string;
          messageId: string;
        };
        const chat = state.chats.find((c) => c.id === chatId);
        if (chat) {
          const message = chat.messages.find((m) => m.id === messageId);
          if (message) {
            message.status = "failed";
          }
        }
      });
  },
});

export const {
  addContext,
  removeContext,
  setCurrentChat,
  newChat,
  updateChatTimestamp,
  updateThinkingState,
  setThinkingStartTime,
  setThinkingEndTime,
  startStreamingMessage,
  updateStreamingMessage,
  finishStreamingMessage,
  failStreamingMessage,
} = chatSlice.actions;
export default chatSlice.reducer;
