import { FC, useState, useEffect, useRef } from "react";
import { ArrowRight, Bot, Link, X, ChevronDown } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/state/store.ts";
import { addContext, removeContext } from "@/state/slices/chatSlice.ts";
import { setSelectedModel } from "@/state/slices/settingsSlice.ts";
import { MODEL_DISPLAY_NAMES } from "@/utils/models";
import { setContextOpen, setModelMenuOpen } from "@/state/slices/uiSlice.ts";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  hasTestResult?: boolean;
}

const MessageInput: FC<MessageInputProps> = ({
  onSendMessage,
  hasTestResult = false,
}) => {
  const [message, setMessage] = useState("");
  const dispatch = useDispatch();

  const { isContextOpen, isModelMenuOpen } = useSelector(
    (state: RootState) => state.ui,
  );
  // select the chat slice then derive selectedContexts to avoid returning new references
  const chatSlice = useSelector((state: RootState) => state.chat);
  const selectedContexts: string[] = chatSlice?.selectedContexts ?? [];
  const { selectedModel } = useSelector((state: RootState) => state.settings);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // If message is empty, reset to single line height
    if (message === "") {
      textarea.style.height = "auto";
      textarea.style.overflowY = "hidden";
      return;
    }

    // Store the current scroll position
    const scrollTop = textarea.scrollTop;

    // Temporarily set to auto to get the natural scroll height
    textarea.style.height = "auto";

    // Get the scroll height (natural content height)
    const scrollHeight = textarea.scrollHeight;

    // Get computed styles to calculate line height
    const styles = window.getComputedStyle(textarea);
    const lineHeightStr = styles.lineHeight;
    const fontSize = parseFloat(styles.fontSize);
    const lineHeight =
      lineHeightStr === "normal" ? fontSize * 1.2 : parseFloat(lineHeightStr);

    // Calculate max height (6 rows)
    const maxHeight = lineHeight * 6;

    // Set height to scroll height, but not exceeding max
    const newHeight = Math.min(scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;

    // Enable scrolling only when content exceeds max height
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";

    // Restore scroll position if needed (when at max height)
    if (scrollTop > 0 && scrollHeight > maxHeight) {
      textarea.scrollTop = scrollTop;
    }
  }, [message]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        dispatch(setContextOpen(false));
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        dispatch(setModelMenuOpen(false));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dispatch]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleAddContext = (context: string) => {
    dispatch(addContext(context));
    dispatch(setContextOpen(false));
  };

  const handleRemoveContext = (context: string) => {
    dispatch(removeContext(context));
  };

  const handleModelSelect = (model: string) => {
    dispatch(setSelectedModel(model));
    dispatch(setModelMenuOpen(false));
  };

  // explicit colors used as a fallback so the button bg is visible
  const enabledBg = "#e5e7eb"; // tailwind bg-gray-200
  const disabledBg = "#6b7280"; // tailwind bg-gray-500

  return (
    <div className="bg-[#2a2a2a] rounded-lg p-1 flex flex-col gap-1">
      <div className="flex items-center gap-1 px-1 pt-1 flex-wrap">
        <div className="relative" ref={contextMenuRef}>
          <button
            id="gemini-chat-add-context-button"
            onClick={() => dispatch(setContextOpen(!isContextOpen))}
            className="flex items-center gap-1 border border-gray-400 rounded-md px-1.5 py-0.5 hover:bg-gray-700"
            aria-label="Add Context"
          >
            <Link className="text-gray-300" size={12} />
            <span className="text-xs text-gray-300 font-medium">
              Add Context
            </span>
          </button>
          {isContextOpen && (
            <div className="absolute bottom-full mb-2 w-40 bg-[#3a3a3a] border border-gray-500 rounded-md shadow-lg z-10">
              <button
                onClick={() => handleAddContext("Problem Details")}
                className="block w-full text-left px-3 py-1 text-sm text-white/80 hover:bg-gray-700"
              >
                Problem Details
              </button>
              <button
                onClick={() => handleAddContext("Code")}
                className="block w-full text-left px-3 py-1 text-sm text-white/80 hover:bg-gray-700"
              >
                Code
              </button>
              <button
                onClick={() => handleAddContext("Test Result")}
                className={`block w-full text-left px-3 py-1 text-sm ${hasTestResult ? "text-white/80 hover:bg-gray-700" : "text-white/40 cursor-not-allowed"}`}
                disabled={!hasTestResult}
                title={hasTestResult ? undefined : "Please run the code first"}
              >
                Test Result
              </button>
            </div>
          )}
        </div>
        {selectedContexts.map((context) => (
          <div
            key={context}
            className="flex items-center gap-1 border border-gray-400 rounded-md px-1.5 py-0.5 text-gray-400"
          >
            <span
              id={`context-label-${context.replace(/\s+/g, "-")}`}
              className="text-xs font-medium"
            >
              {context}
            </span>
            <button
              onClick={() => handleRemoveContext(context)}
              className="p-0.5 rounded-full hover:bg-gray-600"
              aria-label={`Remove ${context}`}
            >
              <X size={12} className="text-gray-400" />
            </button>
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        id="gemini-chat-input"
        className="bg-transparent placeholder-gray-400 focus:outline-none resize-none text-[clamp(12px,2.5cqw,16px)] px-1 pt-1 my-1 custom-scrollbar"
        style={{
          color: "rgba(255, 255, 255, 0.9)",
        }}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Shift+Enter to insert a line break."
        aria-label="Message input"
        rows={1}
      />
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <div className="relative" ref={modelMenuRef}>
            <button
              id="gemini-chat-model-selector-button"
              onClick={() => dispatch(setModelMenuOpen(!isModelMenuOpen))}
              className="flex items-center gap-1 border border-gray-400 rounded-md px-1.5 py-0.5 hover:bg-gray-700"
            >
              <Bot size={14} className="text-purple-400" />
              <span className="text-xs text-gray-300 font-medium">
                {MODEL_DISPLAY_NAMES[selectedModel] || selectedModel}
              </span>
              <ChevronDown className="text-gray-300" size={14} />
            </button>
            {isModelMenuOpen && (
              <div className="absolute bottom-full mb-2 w-44 bg-[#3a3a3a] border border-gray-500 rounded-md shadow-lg z-10">
                {Object.entries(MODEL_DISPLAY_NAMES).map(
                  ([model, displayName]) => (
                    <button
                      key={model}
                      onClick={() => handleModelSelect(model)}
                      className="block w-full text-left px-3 py-1 text-sm text-white/80 hover:bg-gray-700"
                    >
                      {displayName}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
        <button
          id="gemini-chat-send-button"
          type="button"
          onClick={handleSend}
          style={{ backgroundColor: message.trim() ? enabledBg : disabledBg }}
          className={`p-1 rounded-full ${!message.trim() ? "text-gray-800 cursor-not-allowed" : "text-black"}`}
          disabled={!message.trim()}
          aria-label="Send"
        >
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
