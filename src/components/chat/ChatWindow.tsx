import { FC, useRef, useEffect, useState, useMemo } from "react";
import Draggable from "react-draggable";
import { Resizable } from "react-resizable";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/state/store";
import {
  setChatPosition,
  setChatSize,
  toggleChat,
  toggleMinimize,
  setChatHistoryOpen,
} from "@/state/slices/uiSlice";
import ChatMessage from "./ChatMessage";
import MessageInput from "./MessageInput";
import ChatHistory from "./ChatHistory";
import {
  addMessage,
  loadChats,
  newChat,
  startStreamingMessage,
  updateStreamingMessage,
  finishStreamingMessageAndSave,
  failStreamingMessage,
  updateThinkingState,
  setThinkingStartTime,
  setThinkingEndTime,
} from "@/state/slices/chatSlice";
import { nanoid } from "@reduxjs/toolkit";
import { setError, clearError } from "@/state/slices/apiSlice";
import { callGeminiApi } from "@/utils/gemini";
import { loadApiKey } from "@/state/slices/settingsSlice";
import { X, Bot, Maximize2, Plus, History, Minimize2 } from "lucide-react";

const ChatWindow: FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const nodeRef = useRef(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  // When true we should auto-scroll to bottom as new content arrives.
  // When the user scrolls up and distanceFromBottom > threshold we set this to false
  // and respect user's position until they scroll back down within the threshold.
  const autoScrollEnabledRef = useRef<boolean>(true);
  const {
    isChatOpen,
    isChatMinimized,
    chatPosition,
    chatSize,
    isChatHistoryOpen,
    isContextOpen,
  } = useSelector((state: RootState) => state.ui);
  const { chats, currentChatId, selectedContexts } = useSelector(
    (state: RootState) => state.chat,
  );
  const { apiKey, selectedModel } = useSelector(
    (state: RootState) => state.settings,
  );
  const { isLoading, error } = useSelector((state: RootState) => state.api);
  const { currentProblemSlug } = useSelector(
    (state: RootState) => state.problem,
  );

  useEffect(() => {
    dispatch(loadApiKey());
  }, [dispatch]);

  useEffect(() => {
    if (currentProblemSlug) {
      dispatch(loadChats(currentProblemSlug));
    }
  }, [currentProblemSlug, dispatch]);

  const [problemTitle, setProblemTitle] = useState<string | null>(null);
  const [hastestResult, setHastestResult] = useState(false);

  const scrollToBottom = () => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    } else if (messagesContainerRef.current) {
      // Fallback: scroll the container directly
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const SCROLL_THRESHOLD = 80; // px - how close to bottom we consider 'at bottom'

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollEnabledRef.current = distanceFromBottom <= SCROLL_THRESHOLD;
  };

  useEffect(() => {
    const loadProblemTitle = async () => {
      try {
        if (currentProblemSlug) {
          const key = `leetcode-problem-${currentProblemSlug}`;
          const result = await chrome.storage.local.get(key);
          const problemData = result && result[key];
          if (problemData) {
            setHastestResult(!!problemData.testResult);
          }
          if (problemData && problemData.title) {
            // Remove leading numbering like "1. " or "12. " from titles
            const cleaned = String(problemData.title)
              .replace(/^\s*\d+\.\s*/, "")
              .trim();
            setProblemTitle(cleaned);
            return;
          }

          // Fallback: prettify slug into a readable title
          const prettify = (s: string) =>
            s
              .replace(/[_-]+/g, " ")
              .split(" ")
              .filter(Boolean)
              .map((w) => {
                const lower = w.toLowerCase();
                return lower.charAt(0).toUpperCase() + lower.slice(1);
              })
              .join(" ");

          setProblemTitle(prettify(currentProblemSlug));
        }
      } catch (e) {
        console.error("Error loading problem title:", e);
      }
    };

    loadProblemTitle();
  }, [currentProblemSlug]);

  // Update hastestResult when context menu opens
  useEffect(() => {
    if (isContextOpen && currentProblemSlug) {
      const key = `leetcode-problem-${currentProblemSlug}`;
      chrome.storage.local.get(key).then((result) => {
        const problemData = result[key];
        setHastestResult(!!(problemData && problemData.testResult));
      });
    }
  }, [isContextOpen, currentProblemSlug]);

  const handleNewChat = () => {
    dispatch(newChat());
    dispatch(setChatHistoryOpen(false));
  };

  const handleToggleHistory = () => {
    dispatch(setChatHistoryOpen(!isChatHistoryOpen));
  };

  const handleSendMessage = async (text: string) => {
    if (!currentProblemSlug) return;

    dispatch(clearError());
    if (!apiKey) {
      dispatch(setError("API key not set."));
      return;
    }

    const userMessageId = nanoid();
    const chatId = currentChatId || nanoid();

    dispatch(
      addMessage({
        text,
        isUser: true,
        problemSlug: currentProblemSlug,
        messageId: userMessageId,
        chatId,
      }),
    );

    const assistantMessageId = nanoid();

    try {
      let problemDetails: string | null = null;
      let userCode: string | null = null;
      let testResult: string | null = null;

      if (selectedContexts.length > 0 && currentProblemSlug) {
        const key = `leetcode-problem-${currentProblemSlug}`;
        const result = await chrome.storage.local.get(key);
        const problemData = result[key];

        if (problemData) {
          if (selectedContexts.includes("Problem Details")) {
            problemDetails = JSON.stringify({
              title: problemData.title,
              description: problemData.description,
              constraints: problemData.constraints,
              examples: problemData.examples,
            });
          }
          if (selectedContexts.includes("Code")) {
            userCode = problemData.code;
          }
          if (selectedContexts.includes("Test Result")) {
            testResult = problemData.testResult ? JSON.stringify(problemData.testResult) : null;
          }
        }
      }

      const currentChat = chats
        ? chats.find((chat) => chat.id === chatId)
        : null;
      const chatHistory = currentChat ? currentChat.messages.slice(-10) : [];

      // Start streaming message with empty text
      dispatch(
        startStreamingMessage({
          chatId,
          messageId: assistantMessageId,
          text: "",
        }),
      );

      // Use the streaming API
      const streamGenerator = callGeminiApi(
        apiKey,
        selectedModel,
        chatHistory,
        problemDetails,
        userCode,
        testResult,
        text,
        true, // streamThoughts
      );

      for await (const chunk of streamGenerator) {
        // Handle thinking start time
        if (chunk.thinkingStartTime) {
          dispatch(
            setThinkingStartTime({
              chatId,
              messageId: assistantMessageId,
              timestamp: chunk.thinkingStartTime,
            }),
          );
        }

        // Handle thinking end time
        if (chunk.thinkingEndTime) {
          dispatch(
            setThinkingEndTime({
              chatId,
              messageId: assistantMessageId,
              timestamp: chunk.thinkingEndTime,
            }),
          );
        }

        if (chunk.thought) {
          dispatch(
            updateThinkingState({
              chatId,
              messageId: assistantMessageId,
              thought: chunk.thought,
            }),
          );
        } else if (chunk.text !== undefined) {
          dispatch(
            updateStreamingMessage({
              chatId,
              messageId: assistantMessageId,
              textChunk: chunk.text,
            }),
          );
        }
        // Scroll to bottom as new content streams in, but only if the user
        // is at (or near) the bottom. If the user scrolled up we respect
        // their position and avoid forcing the viewport back down.
        if (autoScrollEnabledRef.current) {
          scrollToBottom();
        }
      }

      // Finish streaming and save to storage
      dispatch(
        finishStreamingMessageAndSave({
          chatId,
          messageId: assistantMessageId,
          problemSlug: currentProblemSlug,
        }),
      );
    } catch (error) {
      dispatch(
        failStreamingMessage({
          chatId,
          messageId: assistantMessageId,
          errorMessage: (error as Error).message,
        }),
      );
      dispatch(setError((error as Error).message));
    }
  };

  const messages = useMemo(() => {
    const currentChat = chats.find((chat) => chat.id === currentChatId);
    return currentChat ? currentChat.messages : [];
  }, [chats, currentChatId]);

  // Auto-scroll when messages change or when chat is opened
  useEffect(() => {
    if (isChatOpen && !isChatMinimized) {
      // Only auto-scroll when enabled. This keeps behaviour consistent:
      // if the user intentionally scrolled up, we won't yank them down.
      if (autoScrollEnabledRef.current) {
        scrollToBottom();
      }
    }
  }, [messages, isChatOpen, isChatMinimized, isLoading, error]);

  if (!isChatOpen) {
    return null;
  }

  return (
    <div className="isolate">
      <Draggable
        nodeRef={nodeRef}
        handle=".handle"
        position={chatPosition}
        onDrag={(_, data) => {
          dispatch(setChatPosition({ x: data.x, y: data.y }));
        }}
      >
        <Resizable
          width={chatSize.width}
          height={isChatMinimized ? 40 : chatSize.height}
          onResize={(
            _event: React.SyntheticEvent,
            data: { size: { width: number; height: number } },
          ) => {
            dispatch(
              setChatSize({ width: data.size.width, height: data.size.height }),
            );
          }}
          minConstraints={isChatMinimized ? [300, 40] : [300, 200]}
          maxConstraints={[800, 1000]}
        >
          <div
            ref={nodeRef}
            className="@container absolute bg-[#1E1E1E]/90 rounded-lg border border-white/20 flex flex-col pointer-events-auto overflow-hidden glass transform-gpu"
            style={{
              width: chatSize.width,
              height: isChatMinimized ? 40 : chatSize.height,
              boxShadow:
                "0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div
              className="handle flex items-center justify-between w-full h-10 px-4 cursor-move flex-shrink-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(43, 90, 160, 0.75) 0%, rgba(36, 75, 140, 0.75) 100%)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(0, 0, 0, 0.25)",
                boxShadow:
                  "0 1px 0 rgba(255, 255, 255, 0.1) inset, 0 1px 3px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-white/80" />
                <span className="text-sm font-medium text-white/90">
                  Gemini Assistant
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNewChat}
                  className="hover:bg-white/20 p-1 rounded transition-colors"
                  aria-label="New Chat"
                  title="New Chat"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={handleToggleHistory}
                  className={`hover:bg-white/20 p-1 rounded transition-colors ${
                    isChatHistoryOpen ? "bg-white/20" : ""
                  }`}
                  aria-label="Chat History"
                  title="Chat History"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => dispatch(toggleMinimize())}
                  className="hover:bg-white/20 p-1 rounded"
                  aria-label="Minimize"
                >
                  {isChatMinimized ? (
                    <Maximize2 size={16} />
                  ) : (
                    <Minimize2 size={16} />
                  )}
                </button>
                <button
                  onClick={() => dispatch(toggleChat())}
                  className="hover:bg-red-500/50 p-1 rounded"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isChatMinimized && (
              <>
                <ChatHistory />
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-grow p-4 overflow-y-auto custom-scrollbar"
                >
                  {messages.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-white">
                      <h2 className="text-xl">
                        <span className="user-greeting">Hello, LeetCoder</span>
                      </h2>
                      <h1>
                        <span className="text-white/70">
                          How can I assist you with{" "}
                          {problemTitle ? (
                            <>
                              <strong className="text-white/75">
                                {problemTitle}
                              </strong>{" "}
                              problem
                            </>
                          ) : (
                            "this problem"
                          )}
                          ?
                        </span>
                      </h1>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatMessage
                          key={msg.id}
                          text={msg.text}
                          isUser={msg.isUser}
                          status={msg.status}
                          thinking={msg.thinking}
                          thinkingStartTime={msg.thinkingStartTime}
                          thinkingEndTime={msg.thinkingEndTime}
                        />
                      ))}
                    </>
                  )}

                  {isLoading && <ChatMessage text="..." isUser={false} />}
                  {error && <ChatMessage text={error} isUser={false} />}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-2">
                  {apiKey ? (
                    <MessageInput onSendMessage={handleSendMessage} hastestResult={hastestResult} />
                  ) : (
                    <div className="text-center text-xs text-white/60 p-2">
                      Please set your Gemini API key in the extension settings.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Resizable>
      </Draggable>
    </div>
  );
};

export default ChatWindow;
