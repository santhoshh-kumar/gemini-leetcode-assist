import { FC, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./ChatMessage.css";
import CopyButton from "./CopyButton";

interface ThinkingDropdownProps {
  thinking: string[];
  isStreaming?: boolean;
  thinkingDuration?: number; // Duration in seconds
}

const ThinkingDropdown: FC<ThinkingDropdownProps> = ({
  thinking,
  isStreaming = false,
  thinkingDuration,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Early return if no thinking data
  if (!thinking || !Array.isArray(thinking) || thinking.length === 0) {
    return null;
  }

  // Join all thinking lines into one continuous text
  const fullThinkingText = thinking.join("\n\n");

  // Strip markdown from header (remove **, *, `, etc)
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold (**text**)
      .replace(/\*(.+?)\*/g, "$1") // Remove italic (*text*)
      .replace(/`(.+?)`/g, "$1") // Remove inline code (`code`)
      .replace(/~(.+?)~/g, "$1") // Remove strikethrough (~text~)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to plain text
      .replace(/#+\s/g, ""); // Remove heading markers
  };

  // Extract header from the last thought line (first sentence or line)
  const getLastThoughtHeader = () => {
    if (!thinking || thinking.length === 0) return "";
    const lastLine = thinking[thinking.length - 1];
    // Get first sentence (up to first period, newline, or max 100 chars)
    const match = lastLine.match(/^[^\n.!?]+[.!?]?/);
    const header = match ? match[0].trim() : lastLine.slice(0, 100).trim();
    return stripMarkdown(header);
  };

  const lastThoughtHeader = getLastThoughtHeader();

  // Calculate the header text based on streaming state
  const getHeaderText = () => {
    // Show duration when not streaming AND duration exists (including 0)
    if (!isStreaming && thinkingDuration != null) {
      return `Thought for ${thinkingDuration}s`;
    }
    // Otherwise show the last thinking header
    return lastThoughtHeader || "Thinking...";
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-left group"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse thinking" : "Expand thinking"}
      >
        <span className="text-[13px] font-normal text-white/70 group-hover:text-white/80 transition-colors italic">
          {getHeaderText()}
        </span>
        <span className="text-white/60 group-hover:text-white/70 transition-colors">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isExpanded && (
        <div
          className="mt-2 pl-3 rounded-sm opacity-70"
          style={{
            borderLeft: "0.3px solid rgba(255, 255, 255, 0.38)",
          }}
        >
          <div className="markdown-container">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ className, children, ...props }) {
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
              }}
            >
              {fullThinkingText}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingDropdown;
