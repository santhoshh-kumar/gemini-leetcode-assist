import { FC, ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./ChatMessage.css";
import CopyButton from "./CopyButton";
import ThinkingDropdown from "./ThinkingDropdown";
import { PROCESSING_MESSAGE } from "@/constants/chat";
import { Copy, RotateCcw, Save, FileText } from "lucide-react";

const markdownComponents = {
  code({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: ReactNode;
  }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeText = String(children).replace(/\n$/, "");
    return match ? (
      <div className="relative">
        <CopyButton textToCopy={codeText} />
        <SyntaxHighlighter
          className="custom-scrollbar"
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

type MessageShape = {
  id?: string;
  text: string;
  sender?: "user" | "bot" | string;
  isUser?: boolean;
};

type ChatMessageProps =
  | {
      text: string;
      isUser: boolean;
      status?: "sending" | "succeeded" | "failed" | "streaming";
      thinking?: string[] | null;
      thinkingStartTime?: number;
      thinkingEndTime?: number;
      onCopyText?: (setFeedback: (msg: string | null) => void) => void;
      onCopyMarkdown?: (setFeedback: (msg: string | null) => void) => void;
      onSave?: (setFeedback: (msg: string | null) => void) => void;
      onRetry?: () => void;
    }
  | {
      message: MessageShape & {
        status?: "sending" | "succeeded" | "failed" | "streaming";
        thinking?: string[] | null;
        thinkingStartTime?: number;
        thinkingEndTime?: number;
      };
      onCopyText?: (setFeedback: (msg: string | null) => void) => void;
      onCopyMarkdown?: (setFeedback: (msg: string | null) => void) => void;
      onSave?: (setFeedback: (msg: string | null) => void) => void;
      onRetry?: () => void;
    };

const ChatMessage: FC<ChatMessageProps> = (props) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  // Support two prop shapes used across code/tests
  const text = "text" in props ? props.text : props.message?.text || "";
  const isUser =
    "isUser" in props ? props.isUser : props.message?.isUser ?? (props.message?.sender === "user");
  const status =
    "status" in props
      ? props.status
      : "message" in props
        ? props.message?.status
        : undefined;
  const thinking =
    "thinking" in props
      ? props.thinking
      : "message" in props
        ? props.message?.thinking
        : undefined;
  const thinkingStartTime =
    "thinkingStartTime" in props
      ? props.thinkingStartTime
      : "message" in props
        ? props.message?.thinkingStartTime
        : undefined;
  const thinkingEndTime =
    "thinkingEndTime" in props
      ? props.thinkingEndTime
      : "message" in props
        ? props.message?.thinkingEndTime
        : undefined;

  const onCopyText = "onCopyText" in props ? props.onCopyText : undefined;
  const onCopyMarkdown = "onCopyMarkdown" in props ? props.onCopyMarkdown : undefined;
  const onSave = "onSave" in props ? props.onSave : undefined;
  const onRetry = "onRetry" in props ? props.onRetry : undefined;

  // Calculate thinking duration in seconds
  const thinkingDuration =
    thinkingStartTime != null && thinkingEndTime != null
      ? Math.round((thinkingEndTime - thinkingStartTime) / 1000)
      : undefined;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 user-message items-center">
        {status === "failed" && (
          <span className="text-xs text-red-500 mr-2">Failed</span>
        )}
        <div
          className={`max-w-[85%] rounded-lg px-4 py-2 text-[clamp(13px,2.5cqw,15px)] text-white ${status === "sending" ? "opacity-70" : ""}`}
          style={{ backgroundColor: "rgba(25, 74, 151, 0.45)" }}
        >
          {text}
        </div>
      </div>
    );
  }

  const hasThinking = thinking && thinking.length > 0;
  const isStreaming = status === "streaming";
  const isProcessing = text === PROCESSING_MESSAGE && isStreaming;
  const isFailed = status === "failed";

  // Show action buttons only for completed assistant messages
  const showActions = !isUser && !isStreaming && !isProcessing && !isFailed;

  return (
    <div className="flex justify-start mb-4 bot-message">
      <div className={`text-white max-w-[100%] markdown-container ${isFailed ? 'error-message' : ''}`}>
        {hasThinking && (
          <ThinkingDropdown
            thinking={thinking}
            isStreaming={isStreaming}
            thinkingDuration={thinkingDuration}
          />
        )}

        {isProcessing ? (
          <span className="shimmer">{text}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={markdownComponents}
          >
            {text}
          </ReactMarkdown>
        )}

        {isFailed && onRetry && (
          <div className="flex items-center justify-center mt-4">
            <button
              className="retry-button"
              onClick={onRetry}
              aria-label="Retry"
              title="Retry"
            >
              <RotateCcw size={12} className="mr-2" />
              Try Again
            </button>
          </div>
        )}

        {showActions && (
          <div className="flex items-center justify-between mt-1 mb-1">
            <div className="chat-action-group flex items-center gap-1">
              {/* Copy as plain text (very small, low-opacity icon) */}
              <button
                className="chat-action-btn w-5 h-5"
              onClick={() => onCopyText?.(setFeedback)}
              aria-label="Copy as text"
              title="Copy as text"
            >
              <Copy size={13} />
            </button>

              {/* Copy as markdown (very small, low-opacity icon) */}
                <button
                  className="chat-action-btn w-5 h-5"
                onClick={() => onCopyMarkdown?.(setFeedback)}
                aria-label="Copy as markdown"
                title="Copy as markdown"
              >
                <FileText size={13} />
              </button>

              {/* Retry (very small, low-opacity icon) */}
                <button
                  className="chat-action-btn w-5 h-5"
                onClick={onRetry}
                aria-label="Retry"
                title="Retry"
              >
                <RotateCcw size={13} />
              </button>

              {/* Save (very small, low-opacity icon) */}
                <button
                  className="chat-action-btn w-5 h-5"
                onClick={() => onSave?.(setFeedback)}
                aria-label="Save"
                title="Save"
              >
                <Save size={13} />
              </button>
              </div>
              {feedback && (
                <div className="text-[13px] text-green-500">{feedback}</div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default ChatMessage;
